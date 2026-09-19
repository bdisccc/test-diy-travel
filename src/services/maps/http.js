import { mapConfig } from './config.js'
import { mapRequestPolicy, recordMapUsage, recordProviderQuota } from './usage.js'

export class MapServiceError extends Error {
  constructor(message, code = 'MAP_SERVICE_ERROR', status = 0, details = null) {
    super(message)
    this.name = 'MapServiceError'
    this.code = code
    this.status = status
    this.details = details
  }
}

function friendlyMessage(code, fallback = '') {
  if (code === 'QUOTA_REACHED') return 'This free location feature has reached today’s capacity. Your saved trip still works; try again after the provider quota resets.'
  if (code === 'OFFLINE') return 'You appear to be offline. Saved trip information is still available.'
  if (code === 'TIMEOUT') return 'The location service took too long to respond. Please try again.'
  if (code === 'NOT_CONFIGURED') return 'Location search is not connected yet. Add the free map proxy URL in your environment settings.'
  if (code === 'RATE_LIMITED') return 'Too many location requests were made too quickly. Please wait a moment and try again.'
  if (code === 'WORKER_VERSION_MISMATCH') return 'DIY Travel is connected to an older local map Worker. Stop the old Wrangler process and start this project’s worker again.'
  return fallback || 'This location feature is temporarily unavailable.'
}

export function hasMapsProxy() {
  return Boolean(mapConfig.mapsApiBase)
}

export async function mapsFetch(path, {
  method = 'GET',
  body = null,
  signal = null,
  timeoutMs = 12000,
  usageKind = '',
} = {}) {
  if (!hasMapsProxy()) throw new MapServiceError(friendlyMessage('NOT_CONFIGURED'), 'NOT_CONFIGURED')
  const policy = mapRequestPolicy(usageKind)
  if (!policy.allowed) throw new MapServiceError(friendlyMessage('QUOTA_REACHED'), 'QUOTA_REACHED', 429, policy)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new MapServiceError(friendlyMessage('OFFLINE'), 'OFFLINE')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs)
  const abortFromCaller = () => controller.abort('cancelled')
  if (signal) {
    if (signal.aborted) controller.abort('cancelled')
    else signal.addEventListener('abort', abortFromCaller, { once: true })
  }

  try {
    const response = await fetch(`${mapConfig.mapsApiBase}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    let payload = null
    try { payload = await response.json() } catch {}

    const workerVersion = response.headers.get('X-Worker-Version') || ''
    const expectedWorkerVersion = String(mapConfig.expectedWorkerVersion || '')
    const localProxy = /^(?:https?:\/\/)?(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(mapConfig.mapsApiBase)
    if (localProxy && expectedWorkerVersion && workerVersion !== expectedWorkerVersion) {
      throw new MapServiceError(
        friendlyMessage('WORKER_VERSION_MISMATCH'),
        'WORKER_VERSION_MISMATCH',
        response.status,
        {
          expectedWorkerVersion,
          workerVersion: workerVersion || 'missing',
          originalResponse: payload,
        },
      )
    }

    if (!response.ok) {
      let code = payload?.code || 'MAP_SERVICE_ERROR'
      if (response.status === 429) code = payload?.code === 'QUOTA_REACHED' ? 'QUOTA_REACHED' : 'RATE_LIMITED'
      if (usageKind) recordMapUsage(usageKind, { quotaError: code === 'QUOTA_REACHED' })
      throw new MapServiceError(
        payload?.message || friendlyMessage(code),
        code,
        response.status,
        payload,
      )
    }

    if (usageKind) {
      recordMapUsage(usageKind)
      recordProviderQuota(usageKind, response.headers)
    }
    return { data: payload, headers: response.headers }
  } catch (error) {
    if (error instanceof MapServiceError) throw error
    if (error?.name === 'AbortError') {
      if (signal?.aborted) throw error
      throw new MapServiceError(friendlyMessage('TIMEOUT'), 'TIMEOUT')
    }
    throw new MapServiceError(error?.message || friendlyMessage('MAP_SERVICE_ERROR'), 'MAP_SERVICE_ERROR')
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', abortFromCaller)
  }
}

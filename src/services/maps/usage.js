import { FREE_USAGE_LIMITS, QUOTA_THRESHOLDS } from './config.js'

const STORAGE_KEY = 'diy-travel-map-usage-v1'
const SESSION = {
  searchRequests: 0,
  autocompleteRequests: 0,
  poiRequests: 0,
  routeRequests: 0,
  imageRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  quotaErrors: 0,
}

const PROVIDER_QUOTA = {}

const REQUEST_LIMITS = Object.freeze({
  searchRequests: FREE_USAGE_LIMITS.geocodingPerDay,
  autocompleteRequests: FREE_USAGE_LIMITS.autocompletePerDay,
  poiRequests: FREE_USAGE_LIMITS.poiPerDay,
  routeRequests: FREE_USAGE_LIMITS.routesPerDay,
})

function dayKey() {
  return new Date().toISOString().slice(0, 10)
}

function emptyDaily() {
  return { day: dayKey(), ...SESSION }
}

function loadDaily() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (parsed.day === dayKey()) return { ...emptyDaily(), ...parsed }
  } catch {}
  return emptyDaily()
}

function saveDaily(record) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)) } catch {}
}

export function recordMapUsage(kind, { cacheHit = null, quotaError = false } = {}) {
  if (kind && kind in SESSION) SESSION[kind] += 1
  if (cacheHit === true) SESSION.cacheHits += 1
  if (cacheHit === false) SESSION.cacheMisses += 1
  if (quotaError) SESSION.quotaErrors += 1

  const daily = loadDaily()
  if (kind && kind in daily) daily[kind] += 1
  if (cacheHit === true) daily.cacheHits += 1
  if (cacheHit === false) daily.cacheMisses += 1
  if (quotaError) daily.quotaErrors += 1
  saveDaily(daily)
}

export function recordProviderQuota(kind, headers) {
  if (!kind || !headers) return
  const limit = Number(headers.get?.('X-Provider-Limit'))
  const remaining = Number(headers.get?.('X-Provider-Remaining'))
  const reset = headers.get?.('X-Provider-Reset') || ''
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining)) return
  PROVIDER_QUOTA[kind] = { limit, remaining: Math.max(0, remaining), reset }
}

export function mapRequestPolicy(kind) {
  if (!kind || kind === 'imageRequests') return { allowed: true, level: 'normal', ratio: 0 }

  const provider = PROVIDER_QUOTA[kind]
  const daily = loadDaily()
  const localLimit = REQUEST_LIMITS[kind]
  const ratio = provider
    ? Math.max(0, Math.min(1, (provider.limit - provider.remaining) / provider.limit))
    : localLimit
      ? Math.max(0, Math.min(1, Number(daily[kind] || 0) / localLimit))
      : 0

  if (ratio >= QUOTA_THRESHOLDS.stopAt) return { allowed: false, level: 'stopped', ratio, reset: provider?.reset || '' }
  if (ratio >= QUOTA_THRESHOLDS.essentialOnlyAt && ['poiRequests', 'autocompleteRequests'].includes(kind)) {
    return { allowed: false, level: 'essential-only', ratio, reset: provider?.reset || '' }
  }
  if (ratio >= QUOTA_THRESHOLDS.conserveAt) return { allowed: true, level: 'conserve', ratio, reset: provider?.reset || '' }
  return { allowed: true, level: 'normal', ratio, reset: provider?.reset || '' }
}

export function getMapUsageSnapshot() {
  return {
    session: { ...SESSION },
    daily: loadDaily(),
    providerQuota: { ...PROVIDER_QUOTA },
  }
}

import { mapConfig } from './config.js'
import { cached } from './cache.js'
import { mapsFetch } from './http.js'
import { formatDistance, haversineMeters } from './distanceService.js'
import { recordMapUsage } from './usage.js'

export const ROUTE_MODES = Object.freeze({
  WALK: 'walking',
  BIKE: 'cycling',
  DRIVE: 'driving',
})

const SPEED_KMH = Object.freeze({ WALK: 4.8, BIKE: 14, DRIVE: 32 })

function formatMinutes(minutes) {
  const value = Math.max(1, Math.round(Number(minutes) || 0))
  if (value < 60) return `${value} min`
  const hours = Math.floor(value / 60)
  const rest = value % 60
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

export function localRouteEstimate(origin, destination, mode) {
  const straightMeters = haversineMeters(origin, destination)
  if (straightMeters == null) return null
  const factor = mode === 'WALK' ? 1.14 : mode === 'BIKE' ? 1.18 : 1.24
  const distanceMeters = Math.max(1, Math.round(straightMeters * factor))
  const speed = SPEED_KMH[mode] || SPEED_KMH.WALK
  const minutes = (distanceMeters / 1000) / speed * 60 + (mode === 'DRIVE' ? 3 : 0)
  return {
    provider: 'Local estimate',
    providerKind: 'local-estimate',
    providerMode: mode,
    distanceMeters,
    durationMillis: Math.round(minutes * 60 * 1000),
    geometry: null,
    localizedValues: {
      duration: { text: `≈ ${formatMinutes(minutes)}` },
      distance: { text: formatDistance(distanceMeters, true) },
    },
    warnings: ['Approximate planning estimate. Select this mode to request a detailed route.'],
  }
}

export function getRouteEstimates(origin, destination) {
  return ['WALK', 'BIKE', 'DRIVE'].map((mode) => {
    const route = localRouteEstimate(origin, destination, mode)
    return {
      mode,
      route,
      minutes: route ? Math.max(1, Math.round(route.durationMillis / 60000)) : null,
      availability: route ? 'estimate' : 'unavailable',
      provider: route?.provider || '',
    }
  })
}

function routeKey(origin, destination, mode) {
  return [
    mode,
    Number(origin.latitude).toFixed(5),
    Number(origin.longitude).toFixed(5),
    Number(destination.latitude).toFixed(5),
    Number(destination.longitude).toFixed(5),
  ].join(':')
}

function normalizeRoute(payload, mode) {
  const feature = payload?.features?.[0]
  const summary = feature?.properties?.summary || {}
  const distanceMeters = Number(summary.distance || 0)
  const durationSeconds = Number(summary.duration || 0)
  if (!feature || !distanceMeters || !durationSeconds) return null
  return {
    provider: 'HeiGIT openrouteservice',
    providerKind: 'openrouteservice',
    providerMode: mode,
    distanceMeters,
    durationMillis: Math.round(durationSeconds * 1000),
    geometry: feature.geometry || null,
    bbox: payload.bbox || feature.bbox || null,
    segments: feature.properties?.segments || [],
    localizedValues: {
      duration: { text: formatMinutes(durationSeconds / 60) },
      distance: { text: formatDistance(distanceMeters) },
    },
    warnings: Array.isArray(payload?.metadata?.query?.warnings) ? payload.metadata.query.warnings : [],
  }
}

export async function getRoute(origin, destination, mode, { signal = null, bypassCache = false, alternatives = false } = {}) {
  if (!ROUTE_MODES[mode]) throw new Error('Unsupported route mode')
  const key = routeKey(origin, destination, mode)
  const result = await cached(`route:${key}`, mapConfig.cache.routeMs, async () => {
    const { data } = await mapsFetch('/route', {
      method: 'POST',
      body: {
        origin: { latitude: Number(origin.latitude), longitude: Number(origin.longitude) },
        destination: { latitude: Number(destination.latitude), longitude: Number(destination.longitude) },
        mode: ROUTE_MODES[mode],
        alternatives: Boolean(alternatives),
      },
      signal,
      timeoutMs: 18000,
      usageKind: 'routeRequests',
    })
    return normalizeRoute(data, mode)
  }, { bypass: bypassCache })
  recordMapUsage('', { cacheHit: result.cacheHit })
  return result.value
}

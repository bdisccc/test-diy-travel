import { cached, coordinateCell } from '../maps/cache.js'
import { mapConfig } from '../maps/config.js'
import { mapsFetch } from '../maps/http.js'

function validPoint(point) {
  return Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude))
}

function emptyCoverage(reason = 'unavailable') {
  return {
    available: false,
    configured: reason !== 'not-configured',
    provider: 'mobility-database',
    catalogOnly: true,
    reason,
    gtfsFeeds: [],
    gtfsCount: 0,
    activeGtfsCount: 0,
    officialGtfsCount: 0,
    realtimeCount: 0,
    hasRealtime: false,
  }
}

export async function getTransitCatalogCoverage(location, {
  radiusKm = 35,
  limit = 12,
  signal = null,
  bypassCache = false,
} = {}) {
  if (!validPoint(location)) return emptyCoverage('missing-coordinates')

  const radius = Math.max(5, Math.min(100, Number(radiusKm) || 35))
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 12))
  const key = [
    coordinateCell(location.latitude, location.longitude, 2),
    radius,
    safeLimit,
  ].join(':')

  const result = await cached(`transit-catalog:${key}`, mapConfig.cache.transitCoverageMs, async () => {
    const { data } = await mapsFetch('/mobility/coverage', {
      method: 'POST',
      body: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        radiusKm: radius,
        limit: safeLimit,
      },
      signal,
      timeoutMs: 20000,
    })
    return {
      ...emptyCoverage(data?.reason || ''),
      ...(data || {}),
      gtfsFeeds: Array.isArray(data?.gtfsFeeds) ? data.gtfsFeeds : [],
      gtfsCount: Number(data?.gtfsCount || 0),
      activeGtfsCount: Number(data?.activeGtfsCount || 0),
      officialGtfsCount: Number(data?.officialGtfsCount || 0),
      realtimeCount: Number(data?.realtimeCount || 0),
      hasRealtime: Boolean(data?.hasRealtime),
    }
  }, { bypass: bypassCache })

  return result.value
}

export async function getMobilityCatalogStatus({ signal = null } = {}) {
  const { data } = await mapsFetch('/mobility/health', {
    signal,
    timeoutMs: 15000,
  })
  return data || { ok: false, configured: false, provider: 'mobility-database' }
}

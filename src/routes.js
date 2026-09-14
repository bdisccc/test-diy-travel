import { getBusMapsTransitComparison, resetBusMapsCache } from './busMaps.js'
import { getOtpTransitComparison, resetOtpCache } from './otpRouting.js'

const LOCAL_CACHE = new Map()

function coords(point) {
  const lat = Number(point?.latitude)
  const lon = Number(point?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('This location is missing map coordinates. Search and select it from Google Maps first.')
  }
  return { lat, lon }
}

function haversineKm(from, to) {
  const a = coords(from)
  const b = coords(to)
  const toRad = (value) => value * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function formatDistance(km) {
  if (!Number.isFinite(km)) return ''
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`
}

function formatMinutes(total) {
  const minutes = Math.max(1, Math.round(total))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

function localEstimate(origin, destination, mode) {
  const straight = haversineKm(origin, destination)
  const distanceKm = straight * (mode === 'WALK' ? 1.14 : 1.24)
  let minutes
  if (mode === 'WALK') {
    minutes = distanceKm / 4.8 * 60
  } else {
    const speed = distanceKm < 5 ? 24 : distanceKm < 20 ? 34 : 48
    minutes = distanceKm / speed * 60 + 5
  }
  return {
    provider: 'Local estimate · open with Maps for navigation',
    providerKind: 'local-estimate',
    providerMode: mode,
    distanceMeters: Math.round(distanceKm * 1000),
    duration: `${Math.round(minutes * 60)}s`,
    durationMillis: Math.round(minutes * 60 * 1000),
    localizedValues: {
      duration: { text: `≈ ${formatMinutes(minutes)}` },
      distance: { text: `≈ ${formatDistance(distanceKm)}` },
    },
    travelAdvisory: null,
    warnings: ['Estimate only; open the map link for live navigation.'],
    legs: [],
    transitSummary: null,
    nextDepartureTime: '',
  }
}

function result(mode, route, error = '', availability = route ? 'available' : 'no-route') {
  return {
    mode,
    route,
    minutes: route ? Math.max(1, Math.round(Number(route.durationMillis || 0) / 60000)) : null,
    error,
    availability,
    provider: route?.provider || '',
  }
}

function providerAvailability(busMapsError, otpError) {
  if (busMapsError && otpError) return 'providers-unavailable'
  if (busMapsError || otpError) return 'schedule-unavailable'
  return 'no-route'
}


function modeAvailable(grouped, mode) {
  return grouped?.[mode]?.[0] || null
}

export function resetRouteSessionCache() {
  LOCAL_CACHE.clear()
  resetBusMapsCache()
  resetOtpCache()
}

export async function getRouteComparison({ origin, destination, departureTime = null, bypassCache = false }) {
  const a = coords(origin)
  const b = coords(destination)
  const key = `${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}|${departureTime ? String(departureTime).slice(0, 16) : 'now'}`
  if (!bypassCache && LOCAL_CACHE.has(key)) return LOCAL_CACHE.get(key)

  const walk = localEstimate(origin, destination, 'WALK')
  const drive = localEstimate(origin, destination, 'DRIVE')

  let busMaps = { BUS: [], RAIL: [], FERRY: [] }
  let otp = { BUS: [], RAIL: [], FERRY: [] }
  let busMapsError = ''
  let otpError = ''

  try {
    busMaps = await getBusMapsTransitComparison({ origin, destination, departureTime, bypassCache })
  } catch (error) {
    busMapsError = error?.message || 'BusMaps unavailable'
  }

  const missingModes = ['BUS', 'RAIL', 'FERRY'].filter((mode) => !modeAvailable(busMaps, mode))
  if (missingModes.length) {
    try {
      otp = await getOtpTransitComparison({ origin, destination, departureTime, bypassCache })
    } catch (error) {
      otpError = error?.message || 'OpenTripPlanner unavailable'
    }
  }

  const transitResult = (mode) => {
    const primary = modeAvailable(busMaps, mode)
    if (primary) return result(mode, primary)
    const fallback = modeAvailable(otp, mode)
    if (fallback) return result(mode, fallback)
    const availability = providerAvailability(busMapsError, otpError)
    const debug = [busMapsError && `BusMaps: ${busMapsError}`, otpError && `OpenTripPlanner: ${otpError}`].filter(Boolean).join(' | ')
    return result(mode, null, debug, availability)
  }

  const results = [
    result('WALK', walk),
    transitResult('BUS'),
    transitResult('RAIL'),
    transitResult('FERRY'),
    result('DRIVE', drive),
  ]
  LOCAL_CACHE.set(key, results)
  return results
}

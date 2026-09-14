const BUSMAPS_CACHE = new Map()

const BUSMAPS_ROUTES_URL = '/api/transit/busmaps/routes'

function coords(point) {
  const lat = Number(point?.latitude)
  const lon = Number(point?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Missing coordinates')
  return { lat, lon }
}

function formatDistance(meters) {
  const value = Number(meters)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1000) return `${Math.max(1, Math.round(value))} m`
  const km = value / 1000
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`
}

function formatMinutes(seconds) {
  const total = Math.max(1, Math.round(Number(seconds || 0) / 60))
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`
}

function formatClock(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function haversineMeters(a, b) {
  const toRad = (value) => value * Math.PI / 180
  const lat1 = toRad(Number(a?.latitude))
  const lat2 = toRad(Number(b?.latitude))
  const dLat = lat2 - lat1
  const dLon = toRad(Number(b?.longitude) - Number(a?.longitude))
  if (![lat1, lat2, dLat, dLon].every(Number.isFinite)) return 0
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function cacheKey(origin, destination, departureTime) {
  const a = coords(origin)
  const b = coords(destination)
  const time = departureTime ? String(departureTime).slice(0, 16) : 'now'
  return `${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}|${time}`
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const text = await response.text()
    const contentType = String(response.headers.get('content-type') || '').toLowerCase()

    let body = null
    if (text) {
      try { body = JSON.parse(text) } catch {}
    }

    if (!response.ok) {
      const code = body?.error || body?.code || `BUSMAPS_HTTP_${response.status}`
      const error = new Error(code)
      error.code = code
      error.status = response.status
      throw error
    }

    if (!body || (!contentType.includes('json') && typeof body !== 'object')) {
      const error = new Error('BUSMAPS_INVALID_RESPONSE')
      error.code = 'BUSMAPS_INVALID_RESPONSE'
      throw error
    }
    return body
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('BUSMAPS_TIMEOUT')
      timeoutError.code = 'BUSMAPS_TIMEOUT'
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function sectionMode(section) {
  return String(section?.transport?.mode || section?.mode || section?.type || '').toLowerCase()
}

function classifyRoute(route) {
  const transitSections = (route?.sections || []).filter((section) => section?.type === 'transit' || (section.transport && sectionMode(section) !== 'pedestrian'))
  if (!transitSections.length) return ''
  const modes = transitSections.map(sectionMode)
  if (modes.some((mode) => /ferry|boat|ship|water/.test(mode))) return 'FERRY'
  if (modes.some((mode) => /subway|metro|train|rail|tram|monorail|funicular/.test(mode))) return 'RAIL'
  if (modes.some((mode) => /bus|coach|trolley|shuttle/.test(mode))) return 'BUS'
  return 'TRANSIT'
}

function transitLineLabel(section) {
  const transport = section?.transport || {}
  const mode = String(transport.mode || '').replaceAll('_', ' ')
  const line = transport.shortName || transport.name || transport.longName || ''
  const headsign = transport.headsign || ''
  const base = [mode, line].filter(Boolean).join(' · ')
  return headsign ? `${base}${base ? ' · ' : ''}to ${headsign}` : base
}

function normalizeRoute(route, mode, origin, destination) {
  const sections = Array.isArray(route?.sections) ? route.sections : []
  const transitSections = sections.filter((section) => section?.type === 'transit' || (section.transport && sectionMode(section) !== 'pedestrian'))
  if (!transitSections.length) return null

  const first = transitSections[0]
  const last = transitSections[transitSections.length - 1]
  const firstIndex = sections.indexOf(first)
  const lastIndex = sections.lastIndexOf(last)
  const walkBefore = sections.slice(0, Math.max(0, firstIndex)).filter((section) => sectionMode(section) === 'pedestrian' || section?.type === 'pedestrian')
  const walkAfter = sections.slice(lastIndex + 1).filter((section) => sectionMode(section) === 'pedestrian' || section?.type === 'pedestrian')
  const sum = (list, field) => list.reduce((total, section) => total + Number(section?.travelSummary?.[field] || 0), 0)
  const totalMeters = sections.reduce((total, section) => total + Number(section?.travelSummary?.length || 0), 0) || haversineMeters(origin, destination)
  const seconds = Number(route?.duration || 0)
  if (!seconds) return null

  const departureIso = first?.departure?.rtDeparture || first?.departure?.time || ''
  const arrivalIso = last?.arrival?.rtArrival || last?.arrival?.time || ''
  const lines = [...new Set(transitSections.map(transitLineLabel).filter(Boolean))]
  const stopCount = transitSections.reduce((total, section) => total + Number(section?.intermediateStops?.length || 0), 0)
  const hasRealtime = transitSections.some((section) => section?.departure?.rtDeparture || section?.arrival?.rtArrival)

  return {
    provider: 'BusMaps official GTFS',
    providerKind: 'busmaps',
    providerMode: mode,
    distanceMeters: totalMeters,
    duration: `${seconds}s`,
    durationMillis: seconds * 1000,
    localizedValues: {
      duration: { text: formatMinutes(seconds) },
      distance: { text: formatDistance(totalMeters) },
    },
    travelAdvisory: null,
    warnings: [],
    legs: [],
    nextDepartureTime: '',
    realtime: hasRealtime,
    alerts: Array.isArray(route?.alerts) ? route.alerts : [],
    transitSummary: {
      departureStop: first?.departure?.place?.name || '',
      arrivalStop: last?.arrival?.place?.name || '',
      departureTime: formatClock(departureIso),
      departureTimeIso: departureIso,
      scheduledDepartureTime: formatClock(first?.departure?.time || ''),
      arrivalTime: formatClock(arrivalIso),
      arrivalTimeIso: arrivalIso,
      scheduledArrivalTime: formatClock(last?.arrival?.time || ''),
      headsign: first?.transport?.headsign || '',
      platform: first?.departure?.platformCode || '',
      arrivalPlatform: last?.arrival?.platformCode || '',
      stopCount,
      transfers: Number(route?.transfers ?? Math.max(0, transitSections.length - 1)),
      lineSummary: lines.join(' → '),
      firstVehicleType: String(first?.transport?.mode || '').toUpperCase(),
      firstVehicleName: String(first?.transport?.mode || '').toUpperCase(),
      walkBeforeDistance: formatDistance(sum(walkBefore, 'length')),
      walkBeforeDuration: sum(walkBefore, 'duration') ? formatMinutes(sum(walkBefore, 'duration')) : '',
      walkAfterDistance: formatDistance(sum(walkAfter, 'length')),
      walkAfterDuration: sum(walkAfter, 'duration') ? formatMinutes(sum(walkAfter, 'duration')) : '',
    },
  }
}

export async function getBusMapsTransitComparison({ origin, destination, departureTime = null, bypassCache = false }) {
  const key = cacheKey(origin, destination, departureTime)
  if (!bypassCache && BUSMAPS_CACHE.has(key)) return BUSMAPS_CACHE.get(key)

  const a = coords(origin)
  const b = coords(destination)
  const params = new URLSearchParams({
    origin: `${a.lat},${a.lon}`,
    destination: `${b.lat},${b.lon}`,
    maxRoutes: '6',
    transfers: '4',
    lang: 'en',
  })
  if (departureTime) params.set('departureTime', departureTime)

  const data = await fetchJson(`${BUSMAPS_ROUTES_URL}?${params.toString()}`)
  const grouped = { BUS: [], RAIL: [], FERRY: [] }
  const routes = Array.isArray(data?.routes) ? data.routes : []
  routes.forEach((raw) => {
    const mode = classifyRoute(raw)
    if (!grouped[mode]) return
    const route = normalizeRoute({ ...raw, alerts: data?.alerts || [] }, mode, origin, destination)
    if (route) grouped[mode].push(route)
  })

  Object.values(grouped).forEach((list) => list.sort((a, b) => a.durationMillis - b.durationMillis))
  for (const mode of Object.keys(grouped)) {
    if (grouped[mode].length > 1) grouped[mode][0].nextDepartureTime = grouped[mode][1].transitSummary?.departureTime || ''
  }

  BUSMAPS_CACHE.set(key, grouped)
  return grouped
}

export function resetBusMapsCache() {
  BUSMAPS_CACHE.clear()
}

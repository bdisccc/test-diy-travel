const OPEN_ROUTE_CACHE = new Map()

const TRANSITOUS_PLAN_URL = import.meta.env.DEV ? '/open-transit/api/v6/plan' : 'https://api.transitous.org/api/v6/plan'
const VALHALLA_ROUTE_URL = import.meta.env.DEV ? '/open-route/route' : 'https://valhalla1.openstreetmap.de/route'

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

function formatMinutes(totalMinutes) {
  const total = Math.max(1, Math.round(Number(totalMinutes || 0)))
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`
}

function formatClock(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function haversineMeters(a, b) {
  const p1 = coords(a)
  const p2 = coords(b)
  const rad = (value) => value * Math.PI / 180
  const dLat = rad(p2.lat - p1.lat)
  const dLon = rad(p2.lon - p1.lon)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p1.lat)) * Math.cos(rad(p2.lat)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function routeCacheKey(provider, origin, destination, extra = '') {
  const a = coords(origin)
  const b = coords(destination)
  return `${provider}|${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}|${extra}`
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeValhalla(data, providerMode) {
  const summary = data?.trip?.summary || {}
  const seconds = Number(summary.time || 0)
  const kilometers = Number(summary.length || 0)
  if (!seconds || !Number.isFinite(seconds)) return null
  const durationMillis = seconds * 1000
  const distanceMeters = Number.isFinite(kilometers) ? kilometers * 1000 : 0
  return {
    provider: 'Valhalla + OpenStreetMap',
    providerKind: 'open-street',
    providerMode,
    distanceMeters,
    duration: `${seconds}s`,
    durationMillis,
    localizedValues: {
      duration: { text: formatMinutes(seconds / 60) },
      distance: { text: formatDistance(distanceMeters) },
    },
    travelAdvisory: null,
    warnings: [],
    legs: [],
    transitSummary: null,
    nextDepartureTime: '',
  }
}

async function valhallaRoute(origin, destination, mode) {
  const costing = mode === 'WALK' ? 'pedestrian' : 'auto'
  const key = routeCacheKey('valhalla', origin, destination, costing)
  if (OPEN_ROUTE_CACHE.has(key)) return OPEN_ROUTE_CACHE.get(key)
  const a = coords(origin)
  const b = coords(destination)
  const payload = {
    locations: [{ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }],
    costing,
    units: 'kilometers',
    directions_type: 'none',
    id: 'diy-travel-v1.7',
  }
  const url = `${VALHALLA_ROUTE_URL}?json=${encodeURIComponent(JSON.stringify(payload))}`
  const data = await fetchJson(url, { headers: { 'X-Client-Id': 'diy-travel-prototype' } })
  const normalized = normalizeValhalla(data, mode)
  if (!normalized) throw new Error('No open street route found')
  OPEN_ROUTE_CACHE.set(key, normalized)
  return normalized
}

const BUS_MODES = new Set(['BUS', 'COACH', 'TROLLEYBUS', 'SHUTTLE'])
const FERRY_MODES = new Set(['FERRY', 'WATER', 'WATERBUS', 'SHIP'])
const RAIL_MODES = new Set([
  'RAIL', 'TRAIN', 'SUBWAY', 'TRAM', 'SUBURBAN', 'HIGH_SPEED', 'LONG_DISTANCE',
  'REGIONAL', 'METRO', 'MONORAIL', 'LIGHT_RAIL', 'FUNICULAR', 'CABLE_CAR',
])
const NON_TRANSIT_MODES = new Set(['WALK', 'FOOT', 'BIKE', 'BICYCLE', 'CAR', 'TAXI'])

function legMode(leg) {
  return String(leg?.mode || leg?.transportMode || leg?.routeType || '').toUpperCase()
}

function primaryModeForItinerary(itinerary) {
  const modes = (itinerary?.legs || []).map(legMode).filter((mode) => mode && !NON_TRANSIT_MODES.has(mode))
  if (modes.some((mode) => FERRY_MODES.has(mode) || /FERRY|BOAT|SHIP/.test(mode))) return 'FERRY'
  if (modes.some((mode) => RAIL_MODES.has(mode) || /RAIL|TRAIN|SUBWAY|TRAM|METRO|MONORAIL/.test(mode))) return 'RAIL'
  if (modes.some((mode) => BUS_MODES.has(mode) || /BUS|COACH|SHUTTLE/.test(mode))) return 'BUS'
  return modes.length ? 'TRANSIT' : ''
}

function placeName(place) {
  return place?.name || place?.stop?.name || place?.parent?.name || ''
}

function lineName(leg) {
  return leg?.routeShortName || leg?.routeLongName || leg?.routeName || leg?.tripShortName || leg?.displayName || leg?.agencyName || legMode(leg)
}

function normalizeMotisItinerary(itinerary, mode, origin, destination) {
  const legs = Array.isArray(itinerary?.legs) ? itinerary.legs : []
  const transitLegs = legs.filter((leg) => !NON_TRANSIT_MODES.has(legMode(leg)))
  if (!transitLegs.length) return null
  const first = transitLegs[0]
  const last = transitLegs[transitLegs.length - 1]
  const seconds = Number(itinerary.duration || 0)
  if (!seconds) return null

  const walkBefore = legs.slice(0, Math.max(0, legs.indexOf(first))).filter((leg) => ['WALK', 'FOOT'].includes(legMode(leg)))
  const lastIndex = legs.lastIndexOf(last)
  const walkAfter = legs.slice(lastIndex + 1).filter((leg) => ['WALK', 'FOOT'].includes(legMode(leg)))
  const walkSeconds = (list) => list.reduce((sum, leg) => sum + Number(leg.duration || 0), 0)
  const walkMeters = (list) => list.reduce((sum, leg) => sum + Number(leg.distance || leg.distanceMeters || 0), 0)
  const totalMeters = legs.reduce((sum, leg) => sum + Number(leg.distance || leg.distanceMeters || 0), 0) || haversineMeters(origin, destination)
  const lines = [...new Set(transitLegs.map(lineName).filter(Boolean))]

  return {
    provider: 'Transitous / MOTIS',
    providerKind: 'open-transit',
    providerMode: mode,
    distanceMeters: totalMeters,
    duration: `${seconds}s`,
    durationMillis: seconds * 1000,
    localizedValues: {
      duration: { text: formatMinutes(seconds / 60) },
      distance: { text: totalMeters ? formatDistance(totalMeters) : '' },
    },
    travelAdvisory: null,
    warnings: [],
    legs: [],
    nextDepartureTime: '',
    transitSummary: {
      departureStop: placeName(first.from),
      arrivalStop: placeName(last.to),
      departureTime: formatClock(first.startTime || itinerary.startTime),
      departureTimeIso: first.startTime || itinerary.startTime || '',
      arrivalTime: formatClock(last.endTime || itinerary.endTime),
      arrivalTimeIso: last.endTime || itinerary.endTime || '',
      headsign: first.headsign || first.tripHeadsign || '',
      stopCount: transitLegs.reduce((sum, leg) => sum + Math.max(0, Number(leg.intermediateStops?.length || leg.stopCount || 0)), 0),
      transfers: Number(itinerary.transfers ?? Math.max(0, transitLegs.length - 1)),
      lineSummary: lines.join(' → '),
      firstVehicleType: legMode(first),
      firstVehicleName: legMode(first),
      walkBeforeDistance: formatDistance(walkMeters(walkBefore)),
      walkBeforeDuration: walkSeconds(walkBefore) ? formatMinutes(walkSeconds(walkBefore) / 60) : '',
      walkAfterDistance: formatDistance(walkMeters(walkAfter)),
      walkAfterDuration: walkSeconds(walkAfter) ? formatMinutes(walkSeconds(walkAfter) / 60) : '',
    },
  }
}

async function transitousRoutes(origin, destination, departureTime) {
  const key = routeCacheKey('transitous', origin, destination, departureTime || 'now')
  if (OPEN_ROUTE_CACHE.has(key)) return OPEN_ROUTE_CACHE.get(key)
  const a = coords(origin)
  const b = coords(destination)
  const params = new URLSearchParams({
    fromPlace: `${a.lat},${a.lon}`,
    toPlace: `${b.lat},${b.lon}`,
    transitModes: 'TRANSIT',
    directModes: '',
    detailedLegs: 'false',
    detailedTransfers: 'false',
    useRoutedTransfers: 'true',
    withFares: 'true',
    numItineraries: '6',
    maxItineraries: '6',
    maxTransfers: '4',
    maxDirectTime: '0',
    searchWindow: '3600',
    maxPreTransitTime: '1800',
    maxPostTransitTime: '1800',
    realtimeMode: 'REALTIME',
    language: 'en',
  })
  if (departureTime) params.set('time', departureTime)

  const data = await fetchJson(`${TRANSITOUS_PLAN_URL}?${params.toString()}`)
  const itineraries = Array.isArray(data?.itineraries) ? data.itineraries : []
  const grouped = { BUS: [], RAIL: [], FERRY: [] }
  itineraries.forEach((itinerary) => {
    const mode = primaryModeForItinerary(itinerary)
    if (!grouped[mode]) return
    const route = normalizeMotisItinerary(itinerary, mode, origin, destination)
    if (route) grouped[mode].push(route)
  })

  Object.values(grouped).forEach((routes) => routes.sort((a, b) => a.durationMillis - b.durationMillis))
  for (const mode of ['BUS', 'RAIL', 'FERRY']) {
    const routes = grouped[mode]
    if (routes.length > 1) routes[0].nextDepartureTime = routes[1].transitSummary?.departureTime || ''
  }
  OPEN_ROUTE_CACHE.set(key, grouped)
  return grouped
}

export async function getOpenRouteComparison({ origin, destination, departureTime = null }) {
  const results = []

  const [walkResult, driveResult, transitResult] = await Promise.allSettled([
    valhallaRoute(origin, destination, 'WALK'),
    valhallaRoute(origin, destination, 'DRIVE'),
    transitousRoutes(origin, destination, departureTime),
  ])

  const walkRoute = walkResult.status === 'fulfilled' ? walkResult.value : null
  const driveRoute = driveResult.status === 'fulfilled' ? driveResult.value : null
  const transit = transitResult.status === 'fulfilled' ? transitResult.value : { BUS: [], RAIL: [], FERRY: [] }

  results.push({ mode: 'WALK', route: walkRoute, minutes: walkRoute ? Math.round(walkRoute.durationMillis / 60000) : null, error: walkRoute ? '' : 'Not applicable', provider: walkRoute?.provider || '' })
  for (const mode of ['BUS', 'RAIL', 'FERRY']) {
    const route = transit[mode]?.[0] || null
    results.push({ mode, route, minutes: route ? Math.round(route.durationMillis / 60000) : null, error: route ? '' : 'Not applicable', provider: route?.provider || '' })
  }
  results.push({ mode: 'DRIVE', route: driveRoute, minutes: driveRoute ? Math.round(driveRoute.durationMillis / 60000) : null, error: driveRoute ? '' : 'Not applicable', provider: driveRoute?.provider || '' })
  return results
}

export function resetOpenRouteCache() {
  OPEN_ROUTE_CACHE.clear()
}

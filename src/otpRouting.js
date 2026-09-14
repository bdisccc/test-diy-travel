const OTP_CACHE = new Map()
const OTP_GRAPHQL_URL = '/api/transit/otp/gtfs/v1'

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

function formatSeconds(seconds) {
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

function cacheKey(origin, destination, departureTime) {
  const a = coords(origin)
  const b = coords(destination)
  return `${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}|${departureTime ? String(departureTime).slice(0, 16) : 'now'}`
}

const QUERY = `
query DiyTravelPlan($origin: PlanLabeledLocationInput!, $destination: PlanLabeledLocationInput!, $dateTime: PlanDateTimeInput, $modes: PlanModesInput) {
  planConnection(
    origin: $origin
    destination: $destination
    dateTime: $dateTime
    first: 8
    searchWindow: "PT2H"
    modes: $modes
  ) {
    routingErrors { code description inputField }
    edges {
      node {
        duration
        start
        end
        numberOfTransfers
        walkDistance
        walkTime
        legs {
          mode
          transitLeg
          duration
          distance
          start { scheduledTime estimated { time } }
          end { scheduledTime estimated { time } }
          from { name lat lon stop { gtfsId name platformCode } }
          to { name lat lon stop { gtfsId name platformCode } }
          route { shortName longName mode }
          trip { tripHeadsign }
        }
      }
    }
  }
}`

function classifyLegMode(mode) {
  const value = String(mode || '').toUpperCase()
  if (['BUS', 'COACH', 'TROLLEYBUS'].includes(value)) return 'BUS'
  if (['RAIL', 'SUBWAY', 'TRAM', 'MONORAIL', 'FUNICULAR', 'GONDOLA', 'CABLE_CAR'].includes(value)) return 'RAIL'
  if (value === 'FERRY') return 'FERRY'
  return ''
}

function primaryMode(itinerary) {
  const transit = (itinerary?.legs || []).filter((leg) => leg?.transitLeg)
  const modes = transit.map((leg) => classifyLegMode(leg.mode)).filter(Boolean)
  if (modes.includes('FERRY')) return 'FERRY'
  if (modes.includes('RAIL')) return 'RAIL'
  if (modes.includes('BUS')) return 'BUS'
  return ''
}

function legLine(leg) {
  const mode = String(leg?.mode || '').replaceAll('_', ' ')
  const line = leg?.route?.shortName || leg?.route?.longName || ''
  const headsign = leg?.trip?.tripHeadsign || ''
  const base = [mode, line].filter(Boolean).join(' · ')
  return headsign ? `${base}${base ? ' · ' : ''}to ${headsign}` : base
}

function normalizeItinerary(itinerary, mode) {
  const legs = Array.isArray(itinerary?.legs) ? itinerary.legs : []
  const transitLegs = legs.filter((leg) => leg?.transitLeg)
  if (!transitLegs.length) return null
  const first = transitLegs[0]
  const last = transitLegs[transitLegs.length - 1]
  const firstIndex = legs.indexOf(first)
  const lastIndex = legs.lastIndexOf(last)
  const walkBefore = legs.slice(0, Math.max(0, firstIndex)).filter((leg) => String(leg.mode).toUpperCase() === 'WALK')
  const walkAfter = legs.slice(lastIndex + 1).filter((leg) => String(leg.mode).toUpperCase() === 'WALK')
  const walkMeters = (list) => list.reduce((sum, leg) => sum + Number(leg.distance || 0), 0)
  const walkSeconds = (list) => list.reduce((sum, leg) => sum + Number(leg.duration || 0), 0)
  const totalMeters = legs.reduce((sum, leg) => sum + Number(leg.distance || 0), 0)
  const seconds = Number(itinerary?.duration || 0)
  if (!seconds) return null
  const startIso = first?.start?.estimated?.time || first?.start?.scheduledTime || itinerary?.start || ''
  const endIso = last?.end?.estimated?.time || last?.end?.scheduledTime || itinerary?.end || ''
  const lines = [...new Set(transitLegs.map(legLine).filter(Boolean))]
  const hasRealtime = transitLegs.some((leg) => leg?.start?.estimated?.time || leg?.end?.estimated?.time)

  return {
    provider: 'OpenTripPlanner · local GTFS',
    providerKind: 'otp',
    providerMode: mode,
    distanceMeters: totalMeters,
    duration: `${seconds}s`,
    durationMillis: seconds * 1000,
    localizedValues: {
      duration: { text: formatSeconds(seconds) },
      distance: { text: formatDistance(totalMeters) },
    },
    travelAdvisory: null,
    warnings: [],
    legs: [],
    nextDepartureTime: '',
    realtime: hasRealtime,
    transitSummary: {
      departureStop: first?.from?.stop?.name || first?.from?.name || '',
      arrivalStop: last?.to?.stop?.name || last?.to?.name || '',
      departureTime: formatClock(startIso),
      departureTimeIso: startIso,
      scheduledDepartureTime: formatClock(first?.start?.scheduledTime || ''),
      arrivalTime: formatClock(endIso),
      arrivalTimeIso: endIso,
      scheduledArrivalTime: formatClock(last?.end?.scheduledTime || ''),
      headsign: first?.trip?.tripHeadsign || '',
      platform: first?.from?.stop?.platformCode || '',
      arrivalPlatform: last?.to?.stop?.platformCode || '',
      stopCount: 0,
      transfers: Number(itinerary?.numberOfTransfers ?? Math.max(0, transitLegs.length - 1)),
      lineSummary: lines.join(' → '),
      firstVehicleType: String(first?.mode || '').toUpperCase(),
      firstVehicleName: String(first?.mode || '').toUpperCase(),
      walkBeforeDistance: formatDistance(walkMeters(walkBefore)),
      walkBeforeDuration: walkSeconds(walkBefore) ? formatSeconds(walkSeconds(walkBefore)) : '',
      walkAfterDistance: formatDistance(walkMeters(walkAfter)),
      walkAfterDuration: walkSeconds(walkAfter) ? formatSeconds(walkSeconds(walkAfter)) : '',
    },
  }
}

async function postGraphQl(body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 18000)
  try {
    const response = await fetch(OTP_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'OTPTimeout': '15000' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch {}
    if (!response.ok) {
      const code = json?.error || json?.code || (response.status === 404 ? 'OTP_NOT_CONFIGURED' : `OTP_HTTP_${response.status}`)
      const error = new Error(code)
      error.code = code
      error.status = response.status
      throw error
    }
    if (!json) {
      const error = new Error('OTP_INVALID_RESPONSE')
      error.code = 'OTP_INVALID_RESPONSE'
      throw error
    }
    if (json?.errors?.length) {
      const error = new Error('OTP_QUERY_ERROR')
      error.code = 'OTP_QUERY_ERROR'
      error.debug = json.errors.map((item) => item.message).join('; ')
      throw error
    }
    return json
  } finally {
    clearTimeout(timeout)
  }
}

export async function getOtpTransitComparison({ origin, destination, departureTime = null, bypassCache = false }) {
  const key = cacheKey(origin, destination, departureTime)
  if (!bypassCache && OTP_CACHE.has(key)) return OTP_CACHE.get(key)
  const a = coords(origin)
  const b = coords(destination)
  const variables = {
    origin: { label: 'Origin', location: { coordinate: { latitude: a.lat, longitude: a.lon } } },
    destination: { label: 'Destination', location: { coordinate: { latitude: b.lat, longitude: b.lon } } },
    dateTime: { earliestDeparture: departureTime || new Date().toISOString() },
    modes: {
      transitOnly: true,
      transit: {
        access: ['WALK'],
        egress: ['WALK'],
        transfer: ['WALK'],
        transit: [
          { mode: 'BUS' }, { mode: 'COACH' }, { mode: 'TROLLEYBUS' },
          { mode: 'RAIL' }, { mode: 'SUBWAY' }, { mode: 'TRAM' },
          { mode: 'MONORAIL' }, { mode: 'FUNICULAR' }, { mode: 'FERRY' },
        ],
      },
    },
  }

  const json = await postGraphQl({ query: QUERY, variables })
  const edges = json?.data?.planConnection?.edges || []
  const grouped = { BUS: [], RAIL: [], FERRY: [] }
  edges.forEach((edge) => {
    const itinerary = edge?.node
    const mode = primaryMode(itinerary)
    if (!grouped[mode]) return
    const route = normalizeItinerary(itinerary, mode)
    if (route) grouped[mode].push(route)
  })
  Object.values(grouped).forEach((list) => list.sort((a, b) => a.durationMillis - b.durationMillis))
  for (const mode of Object.keys(grouped)) {
    if (grouped[mode].length > 1) grouped[mode][0].nextDepartureTime = grouped[mode][1].transitSummary?.departureTime || ''
  }
  OTP_CACHE.set(key, grouped)
  return grouped
}

export function resetOtpCache() {
  OTP_CACHE.clear()
}

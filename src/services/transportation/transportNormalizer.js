import { normalizeTransportMode, isTransitMode, transportModeLabel } from './transportModes.js'

function formatMinutesFromSeconds(seconds) {
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

function normalizePlace(place = {}) {
  return {
    id: place.stopId || place.id || '',
    name: place.name || 'Transit stop',
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    platform: place.track || place.scheduledTrack || '',
    stopCode: place.stopCode || '',
    modes: Array.isArray(place.modes) ? place.modes.map(normalizeTransportMode) : [],
  }
}

export function normalizeTransitLeg(leg = {}) {
  const mode = normalizeTransportMode(leg.mode)
  const intermediateStops = Array.isArray(leg.intermediateStops) ? leg.intermediateStops.map(normalizePlace) : []
  const distanceMeters = Number(leg.distance || 0)
  return {
    type: mode,
    label: transportModeLabel(mode),
    from: normalizePlace(leg.from),
    to: normalizePlace(leg.to),
    departureTime: leg.startTime || leg.scheduledStartTime || '',
    scheduledDepartureTime: leg.scheduledStartTime || '',
    arrivalTime: leg.endTime || leg.scheduledEndTime || '',
    scheduledArrivalTime: leg.scheduledEndTime || '',
    durationMinutes: Math.max(1, Math.round(Number(leg.duration || 0) / 60)),
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : 0,
    routeName: leg.displayName || leg.routeShortName || leg.routeLongName || '',
    headsign: leg.headsign || '',
    stops: intermediateStops.length,
    intermediateStops,
    realtime: Boolean(leg.realTime),
    cancelled: Boolean(leg.cancelled),
    alerts: Array.isArray(leg.alerts) ? leg.alerts : [],
  }
}

export function normalizeTransitJourney(itinerary = {}, provider = 'motis') {
  const legs = Array.isArray(itinerary.legs) ? itinerary.legs.map(normalizeTransitLeg) : []
  const transitLegs = legs.filter((leg) => isTransitMode(leg.type))
  if (!transitLegs.length) return null
  const walkingDistanceMeters = legs
    .filter((leg) => leg.type === 'WALK')
    .reduce((total, leg) => total + Number(leg.distanceMeters || 0), 0)
  const totalDistanceMeters = legs.reduce((total, leg) => total + Number(leg.distanceMeters || 0), 0)
  const modes = [...new Set(legs.map((leg) => leg.type).filter(Boolean))]
  const transitModes = [...new Set(transitLegs.map((leg) => leg.type))]
  const primaryMode = transitModes[0] || 'TRANSIT'
  const durationSeconds = Number(itinerary.duration || 0)
  return {
    id: itinerary.id || `${provider}-${itinerary.startTime || ''}-${itinerary.endTime || ''}-${primaryMode}`,
    provider,
    providerKind: provider,
    primaryMode,
    modes,
    transitModes,
    origin: legs[0]?.from || null,
    destination: legs.at(-1)?.to || null,
    departureTime: itinerary.startTime || legs[0]?.departureTime || '',
    arrivalTime: itinerary.endTime || legs.at(-1)?.arrivalTime || '',
    departureLabel: formatClock(itinerary.startTime || legs[0]?.departureTime),
    arrivalLabel: formatClock(itinerary.endTime || legs.at(-1)?.arrivalTime),
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    durationLabel: formatMinutesFromSeconds(durationSeconds),
    transfers: Math.max(0, Number(itinerary.transfers || 0)),
    walkingDistanceMeters,
    totalDistanceMeters,
    realtime: transitLegs.some((leg) => leg.realtime),
    alerts: transitLegs.flatMap((leg) => leg.alerts || []),
    legs,
  }
}

export function normalizeTransitPlan(payload = {}) {
  const provider = payload.provider || payload.meta?.provider || 'motis'
  const itineraries = Array.isArray(payload.itineraries) ? payload.itineraries : []
  return {
    available: payload.available !== false,
    provider,
    providerLabel: payload.providerLabel || (provider === 'transitous-dev' ? 'Transitous · MOTIS (development only)' : 'MOTIS'),
    reason: payload.reason || '',
    journeys: itineraries.map((item) => normalizeTransitJourney(item, provider)).filter(Boolean),
  }
}

export function bestJourneyByMode(journeys = []) {
  const best = new Map()
  journeys.forEach((journey) => {
    const mode = journey.primaryMode
    if (!mode) return
    const previous = best.get(mode)
    if (!previous || journey.durationMinutes < previous.durationMinutes) best.set(mode, journey)
  })
  return [...best.values()].sort((a, b) => a.durationMinutes - b.durationMinutes)
}

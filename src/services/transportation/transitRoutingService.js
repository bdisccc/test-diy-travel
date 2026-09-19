import { cached, coordinateCell } from '../maps/cache.js'
import { mapsFetch } from '../maps/http.js'
import { haversineMeters } from '../maps/distanceService.js'
import { normalizeTransitPlan } from './transportNormalizer.js'
import { normalizeTransportMode } from './transportModes.js'

function validPoint(point) {
  return Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude))
}

function formatOffset(minutes) {
  if (!Number.isFinite(Number(minutes))) return ''
  const value = Number(minutes)
  const sign = value >= 0 ? '+' : '-'
  const absolute = Math.abs(value)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const mins = String(absolute % 60).padStart(2, '0')
  return `${sign}${hours}:${mins}`
}

export function itineraryDateTime(date, time, utcOffsetMinutes, bufferMinutes = 0) {
  const day = String(date || '').trim()
  const clock = String(time || '').trim()
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
  const safeClock = /^\d{2}:\d{2}$/.test(clock) ? clock : '09:00'
  const base = new Date(`${day}T${safeClock}:00Z`)
  if (!Number.isNaN(base.getTime()) && Number(bufferMinutes)) base.setUTCMinutes(base.getUTCMinutes() + Number(bufferMinutes))
  const shiftedDay = Number.isNaN(base.getTime()) ? day : base.toISOString().slice(0, 10)
  const shiftedClock = Number.isNaN(base.getTime()) ? safeClock : base.toISOString().slice(11, 16)
  return `${shiftedDay}T${shiftedClock}:00${formatOffset(utcOffsetMinutes)}`
}

function transitKey(origin, destination, dateTime) {
  return [
    Number(origin.latitude).toFixed(4),
    Number(origin.longitude).toFixed(4),
    Number(destination.latitude).toFixed(4),
    Number(destination.longitude).toFixed(4),
    String(dateTime || '').slice(0, 16),
  ].join(':')
}

export async function getTransitJourneys(origin, destination, {
  date = '',
  time = '',
  utcOffsetMinutes = null,
  arriveBy = false,
  bufferMinutes = 0,
  signal = null,
  bypassCache = false,
} = {}) {
  if (!validPoint(origin) || !validPoint(destination)) return { available: false, provider: '', reason: 'missing-coordinates', journeys: [] }
  const dateTime = itineraryDateTime(date, time, utcOffsetMinutes, bufferMinutes)
  const key = transitKey(origin, destination, dateTime)
  const result = await cached(`transit-plan:${key}:${arriveBy ? 'arrive' : 'depart'}`, 60 * 1000, async () => {
    const { data } = await mapsFetch('/transit/plan', {
      method: 'POST',
      body: {
        origin: { latitude: Number(origin.latitude), longitude: Number(origin.longitude) },
        destination: { latitude: Number(destination.latitude), longitude: Number(destination.longitude) },
        time: dateTime,
        arriveBy: Boolean(arriveBy),
      },
      signal,
      timeoutMs: 20000,
    })
    return normalizeTransitPlan(data)
  }, { bypass: bypassCache })
  return result.value
}

function normalizeStop(stop = {}, location) {
  const latitude = Number(stop.lat ?? stop.latitude)
  const longitude = Number(stop.lon ?? stop.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const modes = Array.isArray(stop.modes) ? [...new Set(stop.modes.map(normalizeTransportMode))] : []
  return {
    locationId: `transit_${stop.stopId || stop.id || `${latitude}_${longitude}`}`,
    provider: stop.provider || 'motis',
    providerId: stop.stopId || stop.id || '',
    name: stop.name || 'Transit stop',
    address: stop.description || '',
    latitude,
    longitude,
    modes,
    transitMode: modes.find((mode) => mode !== 'WALK') || 'TRANSIT',
    distanceMeters: haversineMeters(location, { latitude, longitude }),
    metadata: {
      platform: stop.track || stop.scheduledTrack || '',
      stopCode: stop.stopCode || '',
      importance: Number(stop.importance || 0),
    },
  }
}

export async function getNearbyTransitStops(location, {
  radiusMeters = 1800,
  limit = 30,
  signal = null,
  bypassCache = false,
} = {}) {
  if (!validPoint(location)) return []
  const radius = Math.max(150, Math.min(3000, Number(radiusMeters) || 1800))
  const key = `transit-stops:${coordinateCell(location.latitude, location.longitude, 3)}:${radius}`
  const result = await cached(key, 5 * 60 * 1000, async () => {
    const { data } = await mapsFetch('/transit/stops', {
      method: 'POST',
      body: { latitude: Number(location.latitude), longitude: Number(location.longitude), radiusMeters: radius, limit },
      signal,
      timeoutMs: 15000,
    })
    const raw = Array.isArray(data?.stops) ? data.stops : []
    return raw
      .map((stop) => normalizeStop(stop, location))
      .filter(Boolean)
      .sort((a, b) => Number(a.distanceMeters || Infinity) - Number(b.distanceMeters || Infinity))
      .slice(0, Math.max(1, Number(limit) || 30))
  }, { bypass: bypassCache })
  return result.value
}

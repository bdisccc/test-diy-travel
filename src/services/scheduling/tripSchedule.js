import {
  emptyLocationFields,
  haversineKm as mapHaversineKm,
  isMappedLocation,
  locationIdentityKeys,
  locationMapUrl,
} from '../maps/index.js'
import { formatDate } from '../../utils/formatters.js'

const emptyMapFields = emptyLocationFields()

export function enumerateDates(startDate, endDate) {
  if (!startDate || !endDate) return []
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []
  const dates = []
  const cursor = new Date(start)
  while (cursor <= end && dates.length < 60) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function addMinutes(time, minutes) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return ''
  const [hour, minute] = time.split(':').map(Number)
  const total = (hour * 60 + minute + Number(minutes || 0)) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}


function timePartsToInput(parts) {
  if (!parts || typeof parts.hour !== 'number') return ''
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute ?? 0).padStart(2, '0')}`
}

export function hoursForDate(openingHours, date) {
  if (!openingHours || !date) return { open: '', close: '', summary: 'Hours unavailable', status: 'unavailable' }
  const targetDate = new Date(`${date}T12:00:00`)
  const dayNumber = targetDate.getDay()
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(targetDate)
  const descriptions = openingHours.weekdayDescriptions || []
  const description = descriptions.find((item) => item.toLowerCase().startsWith(dayName.toLowerCase())) || ''
  const explicitlyClosed = /closed/i.test(description)
  const periods = (openingHours.periods || []).filter((period) => period.open && period.open.day === dayNumber)
  if (!periods.length) {
    if (explicitlyClosed) return { open: '', close: '', summary: description || `${dayName}: Closed`, status: 'closed' }
    return { open: '', close: '', summary: description || `${dayName}: Hours unavailable`, status: 'unavailable' }
  }
  const first = periods[0]
  const last = periods[periods.length - 1]
  const open = timePartsToInput(first.open)
  const close = timePartsToInput(last.close)
  return { open, close, summary: description || (close ? `${open} — ${close}` : 'Open 24 hours'), status: 'open' }
}

export function placeWithDateHours(place, date) {
  const next = { ...place, visitDate: date }
  if (place?.regularOpeningHours) {
    const hours = hoursForDate(place.regularOpeningHours, date)
    return {
      ...next,
      open: hours.status === 'open' ? hours.open : (hours.status === 'unavailable' ? place.open || '' : ''),
      close: hours.status === 'open' ? hours.close : (hours.status === 'unavailable' ? place.close || '' : ''),
      hoursSummary: hours.summary,
      hoursStatus: hours.status,
    }
  }
  return next
}

export function inferPlaceCategory(primaryType, types = []) {
  const allTypes = [primaryType, ...types]
    .filter(Boolean)
    .map((type) => String(type).toLowerCase().replace(/[\s-]+/g, '_'))
  if (allTypes.some((type) => /shopping|mall|store|shop|market|supermarket|convenience|department/.test(type))) return 'Shopping'
  if (allTypes.some((type) => /cafe|coffee|bakery|ice_cream/.test(type))) return 'Cafe'
  if (allTypes.some((type) => /restaurant|food|bar|fast_food/.test(type))) return 'Food'
  if (allTypes.some((type) => /museum|gallery|arts_centre/.test(type))) return 'Museum'
  if (allTypes.some((type) => /park|garden|nature|beach|viewpoint/.test(type))) return 'Nature'
  if (allTypes.some((type) => /lodging|hotel|hostel|motel|guest_house|apartment/.test(type))) return 'Hotel'
  if (allTypes.some((type) => /transit|station|subway|metro|rail|train|tram|bus|platform|ferry|airport/.test(type))) return 'Transport'
  if (allTypes.some((type) => /cinema|theatre|theme_park|amusement|entertainment/.test(type))) return 'Entertainment'
  return 'Attraction'
}

export function createBlankPlaceForm(defaultDate = '') {
  return {
    name: '', category: 'Attraction', open: '', close: '', duration: 60,
    priority: 'High', visitDate: defaultDate, plannedStart: '', suggestedStart: '', timeSource: 'suggested',
    ...emptyLocationFields(),
    primaryType: '', primaryTypeDisplayName: '', types: [], regularOpeningHours: null, currentOpeningHours: null,
    hoursSummary: '', hoursStatus: 'unavailable', notes: '',
  }
}

export function createBlankHotel(startDate, endDate) {
  return {
    id: Date.now(), name: '', checkInDate: startDate || '', checkIn: '15:00',
    checkOutDate: endDate || '', checkOut: '11:00', ...emptyMapFields,
  }
}

export function isMapped(place) {
  return isMappedLocation(place)
}

export function firstHotelForArrival(hotels = []) {
  if (!hotels.length) return null
  return [...hotels].sort((a, b) => `${a.checkInDate || ''} ${a.checkIn || ''}`.localeCompare(`${b.checkInDate || ''} ${b.checkIn || ''}`))[0]
}

export function transportDescriptor(endpoint) {
  const detail = [endpoint.airline, endpoint.flightNumber].filter(Boolean).join(' ')
  return detail || endpoint.type || 'Travel'
}

export function clockToMinutes(value, fallback = null) {
  if (!value || !/^\d{2}:\d{2}$/.test(String(value))) return fallback
  const [hour, minute] = String(value).split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback
  return hour * 60 + minute
}

function minutesToClock(value) {
  if (!Number.isFinite(Number(value))) return ''
  const normalized = ((Math.round(Number(value)) % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}


export function placeIdentityKeys(place) {
  return locationIdentityKeys(place)
}

export function isPlaceAlreadySaved(candidate, savedPlaces = []) {
  const candidateKeys = new Set(placeIdentityKeys(candidate))
  if (!candidateKeys.size) return false
  return savedPlaces.some((saved) => placeIdentityKeys(saved).some((key) => candidateKeys.has(key)))
}

function haversineKm(a, b) {
  return mapHaversineKm(a, b)
}

export function estimateTransferMinutes(from, to) {
  const distanceKm = haversineKm(from, to)
  if (distanceKm == null) return { distanceKm: null, minutes: 15 }
  if (distanceKm <= 1) return { distanceKm, minutes: Math.max(5, Math.round(distanceKm * 14)) }
  if (distanceKm <= 5) return { distanceKm, minutes: Math.round(10 + distanceKm * 5) }
  return { distanceKm, minutes: Math.round(18 + distanceKm * 3.5) }
}

function placeHoursMinutes(place) {
  if (place?.hoursStatus === 'closed') return { open: 0, close: 0, closed: true }
  const open = clockToMinutes(place.open, 8 * 60)
  let close = clockToMinutes(place.close, 23 * 60)
  if (close === 0 && open > 0) close = 24 * 60
  if (close <= open) close += 24 * 60
  return { open, close, closed: false }
}

function priorityBonus(priority) {
  if (priority === 'Must Visit') return 120
  if (priority === 'High') return 60
  return 0
}

export function hotelForDate(hotels = [], date = '') {
  return hotels.find((hotel) => hotel.checkInDate <= date && hotel.checkOutDate >= date) || null
}

export function dayStartPreference(data, date) {
  const trip = data?.trip || {}
  const arrival = trip.arrival || {}
  const hotels = Array.isArray(trip.hotels) ? trip.hotels : []
  const stay = hotelForDate(hotels, date) || firstHotelForArrival(hotels)
  const saved = trip.dayStartPreferences?.[date]
  if (saved) return saved
  if (arrival?.date === date && arrival?.time) return isMapped(stay) ? 'arrival_stay' : 'arrival_places'
  return isMapped(stay) ? 'stay' : 'first_place'
}

export function dayStartPreferenceLabel(mode) {
  if (mode === 'arrival_stay') return 'Airport → stay/base → places'
  if (mode === 'arrival_places') return 'Airport → first destination'
  if (mode === 'stay') return 'Stay/base → places'
  return 'Start at first destination'
}

export function dayArrangementPreference(data, date) {
  const raw = data?.trip?.dayArrangementPreferences?.[date] || {}
  return {
    strategy: raw.strategy || 'balanced',
    endMode: raw.endMode || 'none',
    endPlaceId: raw.endPlaceId || '',
  }
}

export function arrangementLabel(pref) {
  const strategy = pref?.strategy === 'nearest' ? 'Nearest first' : pref?.strategy === 'closing' ? 'Earlier closing first' : 'Balanced'
  if (pref?.endMode === 'stay') return `${strategy} · return to stay/base`
  if (pref?.endMode === 'shopping') return `${strategy} · shopping last`
  if (pref?.endMode === 'place') return `${strategy} · chosen final place`
  return `${strategy} · end at final destination`
}

export function applySmartSuggestionsForDate(data, date) {
  if (!date) return data
  let schedule
  try {
    schedule = smartPlaceSchedule(data, date)
  } catch (error) {
    console.warn('Smart suggestion refresh skipped:', error)
    return data
  }
  return {
    ...data,
    places: (data.places || []).map((place) => {
      if (place.visitDate !== date || place.timeSource === 'manual') return place
      const suggestion = schedule.get(place.id)
      return { ...place, suggestedStart: suggestion?.start || '' }
    }),
  }
}

export function applyAllSmartSuggestions(data) {
  let next = data
  enumerateDates(data?.trip?.startDate, data?.trip?.endDate).forEach((date) => {
    next = applySmartSuggestionsForDate(next, date)
  })
  return next
}

export function findNextAvailableDay(data, placeId, fromDate) {
  const dates = enumerateDates(data?.trip?.startDate, data?.trip?.endDate)
  const startIndex = dates.indexOf(fromDate)
  const target = (data?.places || []).find((place) => String(place.id) === String(placeId))
  if (!target) return null
  for (const date of dates.slice(Math.max(0, startIndex + 1))) {
    const candidateData = {
      ...data,
      places: (data.places || []).map((place) => String(place.id) === String(placeId)
        ? { ...placeWithDateHours(place, date), plannedStart: '', suggestedStart: '', timeSource: 'suggested' }
        : place),
    }
    try {
      const suggestion = smartPlaceSchedule(candidateData, date).get(target.id)
      if (suggestion?.start && !suggestion.scheduleWarning) return { date, start: suggestion.start, end: suggestion.end || '' }
    } catch {
      // Keep looking at later days.
    }
  }
  return null
}

export function smartPlaceSchedule(data, date) {
  const places = (Array.isArray(data?.places) ? data.places : [])
    .filter((place) => place && place.visitDate === date && place.hoursStatus !== 'closed')
  if (!places.length) return new Map()

  const trip = data?.trip || {}
  const arrival = trip.arrival || {}
  const departure = trip.departure || {}
  const hotels = Array.isArray(trip.hotels) ? trip.hotels : []
  const stay = hotelForDate(hotels, date) || firstHotelForArrival(hotels)
  const hasArrivalThisDay = arrival?.date === date && Boolean(arrival.time)
  const startPreference = dayStartPreference(data, date)
  const arrangement = dayArrangementPreference(data, date)
  const endTarget = arrangement.endMode === 'stay' && isMapped(stay) ? stay : null
  let currentMinute = 9 * 60
  let currentLocation = null

  if (hasArrivalThisDay && (startPreference === 'arrival_stay' || startPreference === 'arrival_places')) {
    currentMinute = clockToMinutes(arrival.time, currentMinute) + Number(arrival.transferBufferMinutes || 0)
    currentLocation = isMapped(arrival) ? arrival : null

    if (startPreference === 'arrival_stay' && isMapped(stay)) {
      if (isMapped(arrival)) {
        const transfer = estimateTransferMinutes(arrival, stay)
        currentMinute += transfer.minutes
      }
      currentLocation = stay
    }
  } else if (startPreference === 'stay' && isMapped(stay)) {
    currentLocation = stay
  }

  let dayEnd = 23 * 60 + 30
  if (departure?.date === date && departure.time) {
    dayEnd = Math.max(currentMinute, clockToMinutes(departure.time, dayEnd) - 120)
  }

  const manual = places
    .filter((place) => place.timeSource === 'manual' && /^\d{2}:\d{2}$/.test(String(place.plannedStart || '')))
    .sort((a, b) => String(a.plannedStart || '').localeCompare(String(b.plannedStart || '')))
  const remaining = places.filter((place) => !manual.some((manualPlace) => manualPlace.id === place.id))
  const result = new Map()

  function chooseAndSchedule(windowEnd) {
    let scheduledSomething = true
    while (remaining.length && scheduledSomething) {
      scheduledSomething = false
      const candidates = remaining.map((place, index) => {
        const { open, close, closed } = placeHoursMinutes(place)
        const transfer = currentLocation && isMapped(place) ? estimateTransferMinutes(currentLocation, place) : { distanceKm: null, minutes: currentLocation ? 15 : 0 }
        const start = Math.max(currentMinute + transfer.minutes, open)
        const end = start + Number(place.duration || 60)
        const feasible = !closed && end <= Math.min(close, windowEnd)
        const distancePenalty = transfer.distanceKm == null ? 18 : transfer.distanceKm * 12
        const closeUrgency = close
        let score
        if (arrangement.strategy === 'nearest') score = distancePenalty * 8 + closeUrgency * 0.15 - priorityBonus(place.priority)
        else if (arrangement.strategy === 'closing') score = closeUrgency * 1.5 + distancePenalty - priorityBonus(place.priority)
        else score = closeUrgency + distancePenalty - priorityBonus(place.priority)

        const remainingCount = remaining.length
        if (arrangement.endMode === 'shopping' && String(place.category || '').toLowerCase() === 'shopping' && remainingCount > 1) score += 5000
        if (arrangement.endMode === 'place' && String(place.id) === String(arrangement.endPlaceId) && remainingCount > 1) score += 5000
        if (endTarget && isMapped(place)) {
          const endDistance = haversineKm(place, endTarget)
          if (endDistance != null) score += endDistance * (remainingCount <= 2 ? 40 : 3)
        }
        return { place, index, open, close, transfer, start, end, feasible, score }
      }).filter((item) => item.feasible).sort((a, b) => a.score - b.score || a.start - b.start)

      const chosen = candidates[0]
      if (!chosen) return
      remaining.splice(chosen.index, 1)
      result.set(chosen.place.id, {
        start: minutesToClock(chosen.start),
        end: minutesToClock(chosen.end),
        suggested: true,
        distanceKm: chosen.transfer.distanceKm,
        transferMinutes: chosen.transfer.minutes,
        scheduleNote: chosen.transfer.distanceKm != null
          ? `Suggested by closing time + ${chosen.transfer.distanceKm.toFixed(1)} km from the previous stop`
          : 'Suggested by opening/closing hours and your day window',
      })
      currentMinute = chosen.end
      if (isMapped(chosen.place)) currentLocation = chosen.place
      scheduledSomething = true
    }
  }

  manual.forEach((place) => {
    const fixedStart = clockToMinutes(place.plannedStart, currentMinute)
    chooseAndSchedule(Math.max(currentMinute, fixedStart))
    const { open, close, closed } = placeHoursMinutes(place)
    const duration = Number(place.duration || 60)
    const fixedEnd = fixedStart + duration
    const conflict = closed || fixedStart < currentMinute || fixedStart < open || fixedEnd > close || fixedEnd > dayEnd
    result.set(place.id, {
      start: place.plannedStart,
      end: minutesToClock(fixedEnd),
      suggested: false,
      scheduleWarning: conflict ? 'Your fixed time may conflict with travel time, opening hours, or another stop.' : '',
    })
    currentMinute = Math.max(currentMinute, fixedEnd)
    if (isMapped(place)) currentLocation = place
  })

  chooseAndSchedule(dayEnd)

  remaining.forEach((place) => {
    const { open, close, closed } = placeHoursMinutes(place)
    const transfer = currentLocation && isMapped(place) ? estimateTransferMinutes(currentLocation, place) : { distanceKm: null, minutes: 15 }
    const earliestStart = Math.max(currentMinute + transfer.minutes, open)
    const reason = closed
      ? `Closed on ${formatDate(date)} — move this stop to another day.`
      : earliestStart + Number(place.duration || 60) > close
        ? `Doesn't fit before ${place.close || 'closing time'} — consider moving it to another day.`
        : `Doesn't fit in today's available time window — consider moving it to another day.`
    result.set(place.id, { start: '', end: '', suggested: true, distanceKm: transfer.distanceKm, transferMinutes: transfer.minutes, scheduleWarning: reason })
  })

  return result
}

export function buildDayItems(data, date) {
  const items = []
  const trip = data?.trip || {}
  const arrival = trip.arrival || {}
  const departure = trip.departure || {}
  const smartSchedule = smartPlaceSchedule(data || {}, date)
  const startPreference = dayStartPreference(data, date)
  const arrangement = dayArrangementPreference(data, date)
  const hotels = Array.isArray(trip.hotels) ? trip.hotels : []
  const stay = hotelForDate(hotels, date) || firstHotelForArrival(hotels)

  if (arrival?.date === date && (startPreference === 'arrival_stay' || startPreference === 'arrival_places')) {
    items.push({
      key: 'arrival', kind: 'arrival', start: arrival.time || '', end: '',
      title: `Arrive · ${arrival.location || 'Arrival point'}`,
      subtitle: `${transportDescriptor(arrival)}${arrival.from ? ` · from ${arrival.from}` : ''}`,
      detail: arrival.address || 'Arrival location', mapUri: locationMapUrl(arrival), locationData: arrival, sort: arrival.time || '00:00',
    })
  }

  if (arrival?.date === date && startPreference === 'arrival_stay' && isMapped(stay)) {
    const airportReady = addMinutes(arrival.time || '09:00', Number(arrival.transferBufferMinutes || 0))
    const transferToStay = isMapped(arrival) ? estimateTransferMinutes(arrival, stay) : { minutes: 15 }
    const stayArrivalTime = addMinutes(airportReady, transferToStay.minutes)
    items.push({
      key: `arrival-stay-${stay.id || date}`, kind: 'stay', start: stayArrivalTime, end: '',
      title: `Stay/base · ${stay.name || 'Accommodation'}`,
      subtitle: stay.address || 'Stay/base',
      detail: `First stop after the airport${stay.checkIn ? ` · check-in from ${stay.checkIn}` : ''}`,
      mapUri: locationMapUrl(stay), locationData: stay, sort: stayArrivalTime || '00:01',
    })
  }

  if (startPreference === 'stay' && isMapped(stay)) {
    items.push({
      key: `day-start-stay-${date}`, kind: 'start', start: '09:00', end: '',
      title: `Start · ${stay.name || 'Stay/base'}`,
      subtitle: stay.address || 'Stay/base', detail: 'Your day starts here',
      mapUri: locationMapUrl(stay), locationData: stay, sort: '00:01',
    })
  }

  ;(trip.hotels || []).forEach((hotel) => {
    if (hotel.checkInDate === date && startPreference !== 'stay' && !(startPreference === 'arrival_stay' && String(stay?.id) === String(hotel.id))) {
      const arrivesThisDay = arrival?.date === date && arrival.time
      const checkInAvailable = hotel.checkIn || '15:00'
      const arrivalReady = arrivesThisDay ? addMinutes(arrival.time, Number(arrival.transferBufferMinutes || 0)) : ''
      const arrivesAfterCheckInOpens = arrivalReady && arrivalReady >= checkInAvailable
      const placesBeforeStay = arrivesThisDay && startPreference === 'arrival_places'
      const displayStart = placesBeforeStay ? 'Later' : (arrivesAfterCheckInOpens ? 'After arrival' : checkInAvailable)
      const sort = placesBeforeStay ? '97:30' : (arrivesAfterCheckInOpens ? addMinutes(arrivalReady, 1) : checkInAvailable)
      items.push({
        key: `hotel-checkin-${hotel.id}`, kind: 'hotel', start: displayStart, end: '',
        title: `Stay check-in · ${hotel.name || 'Accommodation'}`,
        subtitle: hotel.address || 'Accommodation',
        detail: `Check-in available from ${checkInAvailable}`,
        mapUri: locationMapUrl(hotel), locationData: hotel, sort,
      })
    }
    if (hotel.checkOutDate === date) {
      items.push({
        key: `hotel-checkout-${hotel.id}`, kind: 'hotel', start: hotel.checkOut || '', end: '',
        title: `Stay check-out · ${hotel.name || 'Accommodation'}`,
        subtitle: hotel.address || 'Accommodation', detail: 'Check-out', mapUri: locationMapUrl(hotel), locationData: hotel, sort: hotel.checkOut || '11:00',
      })
    }
  })

  ;(Array.isArray(data?.places) ? data.places : []).filter((place) => place && place.visitDate === date && place.hoursStatus !== 'closed').forEach((place) => {
    const schedule = smartSchedule.get(place.id) || {}
    const effectiveStart = schedule.start || (place.timeSource === 'manual' ? place.plannedStart : (place.suggestedStart || place.plannedStart)) || ''
    const effectiveEnd = schedule.end || (effectiveStart ? addMinutes(effectiveStart, place.duration) : '')
    const scheduleCopy = schedule.scheduleWarning
      ? schedule.scheduleWarning
      : schedule.suggested
        ? schedule.scheduleNote
        : ''
    const hoursCopy = place.hoursSummary || (place.open || place.close ? `Open ${place.open || '?'} — ${place.close || '?'}` : 'Hours unavailable')
    items.push({
      key: `place-${place.id}`, kind: 'place', start: effectiveStart, end: effectiveEnd,
      title: place.name,
      subtitle: `${place.category} · ${place.duration} min${place.priority ? ` · ${place.priority}` : ''}`,
      detail: [hoursCopy, scheduleCopy].filter(Boolean).join(' · '),
      notes: place.notes || '',
      mapUri: locationMapUrl(place), locationData: place,
      sort: effectiveStart || '98:59', suggestedTime: Boolean(schedule.suggested), scheduleWarning: schedule.scheduleWarning || '',
    })
  })

  if (arrangement.endMode === 'stay' && isMapped(stay) && (data?.places || []).some((place) => place.visitDate === date && place.hoursStatus !== 'closed')) {
    items.push({
      key: `return-stay-${date}`, kind: 'return', start: '', end: '',
      title: `Return · ${stay.name || 'Stay/base'}`,
      subtitle: stay.address || 'Stay/base', detail: 'Preferred end point for this day',
      mapUri: locationMapUrl(stay), locationData: stay, sort: '98:58',
    })
  }

  if (departure?.date === date) {
    items.push({
      key: 'departure', kind: 'departure', start: departure.time || '', end: '',
      title: `Depart · ${departure.location || 'Departure point'}`,
      subtitle: `${transportDescriptor(departure)}${departure.to ? ` · to ${departure.to}` : ''}`,
      detail: departure.address || 'Departure location', mapUri: locationMapUrl(departure), locationData: departure, sort: departure.time || '99:00',
    })
  }

  return items.sort((a, b) => String(a.sort || '').localeCompare(String(b.sort || '')))
}


export function buildBasicDayItems(data, date) {
  const items = []
  const trip = data?.trip || {}
  const arrival = trip.arrival || {}
  const departure = trip.departure || {}
  const startPreference = dayStartPreference(data, date)
  const arrangement = dayArrangementPreference(data, date)
  const stay = hotelForDate(trip.hotels || [], date) || firstHotelForArrival(trip.hotels || [])

  if (arrival.date === date && (startPreference === 'arrival_stay' || startPreference === 'arrival_places')) {
    items.push({
      key: 'arrival', kind: 'arrival', start: arrival.time || '', end: '',
      title: `Arrive · ${arrival.location || 'Arrival point'}`,
      subtitle: `${transportDescriptor(arrival)}${arrival.from ? ` · from ${arrival.from}` : ''}`,
      detail: arrival.address || 'Arrival location', mapUri: locationMapUrl(arrival), locationData: arrival, sort: arrival.time || '00:00',
    })
  }

  if (arrival.date === date && startPreference === 'arrival_stay' && isMapped(stay)) {
    const airportReady = addMinutes(arrival.time || '09:00', Number(arrival.transferBufferMinutes || 0))
    const transferToStay = isMapped(arrival) ? estimateTransferMinutes(arrival, stay) : { minutes: 15 }
    const stayArrivalTime = addMinutes(airportReady, transferToStay.minutes)
    items.push({ key: `arrival-stay-${stay.id || date}`, kind: 'stay', start: stayArrivalTime, end: '', title: `Stay/base · ${stay.name || 'Accommodation'}`, subtitle: stay.address || 'Stay/base', detail: 'First stop after the airport', mapUri: locationMapUrl(stay), locationData: stay, sort: stayArrivalTime || '00:01' })
  }

  if (startPreference === 'stay' && isMapped(stay)) {
    items.push({ key: `day-start-stay-${date}`, kind: 'start', start: '09:00', end: '', title: `Start · ${stay.name || 'Stay/base'}`, subtitle: stay.address || 'Stay/base', detail: 'Your day starts here', mapUri: locationMapUrl(stay), locationData: stay, sort: '00:01' })
  }

  ;(trip.hotels || []).forEach((hotel) => {
    if (hotel.checkInDate === date && startPreference !== 'stay' && !(startPreference === 'arrival_stay' && String(stay?.id) === String(hotel.id))) items.push({ key: `hotel-checkin-${hotel.id}`, kind: 'hotel', start: hotel.checkIn || '15:00', end: '', title: `Stay check-in · ${hotel.name || 'Accommodation'}`, subtitle: hotel.address || 'Accommodation', detail: 'Check-in', mapUri: locationMapUrl(hotel), locationData: hotel, sort: hotel.checkIn || '15:00' })
    if (hotel.checkOutDate === date) items.push({ key: `hotel-checkout-${hotel.id}`, kind: 'hotel', start: hotel.checkOut || '11:00', end: '', title: `Stay check-out · ${hotel.name || 'Accommodation'}`, subtitle: hotel.address || 'Accommodation', detail: 'Check-out', mapUri: locationMapUrl(hotel), locationData: hotel, sort: hotel.checkOut || '11:00' })
  })

  ;(data?.places || []).filter((place) => place.visitDate === date).forEach((place) => {
    const start = (place.timeSource === 'manual' ? place.plannedStart : (place.suggestedStart || place.plannedStart)) || ''
    items.push({ key: `place-${place.id}`, kind: 'place', start, end: start ? addMinutes(start, place.duration) : '', title: place.name || 'Place', subtitle: `${place.category || 'Place'} · ${place.duration || 60} min${place.priority ? ` · ${place.priority}` : ''}`, detail: place.hoursSummary || 'Hours unavailable', notes: place.notes || '', mapUri: locationMapUrl(place), locationData: place, sort: start || '98:59', suggestedTime: false, scheduleWarning: '' })
  })

  if (arrangement.endMode === 'stay' && isMapped(stay) && (data?.places || []).some((place) => place.visitDate === date)) {
    items.push({ key: `return-stay-${date}`, kind: 'return', start: '', end: '', title: `Return · ${stay.name || 'Stay/base'}`, subtitle: stay.address || 'Stay/base', detail: 'Preferred end point for this day', mapUri: locationMapUrl(stay), locationData: stay, sort: '98:58' })
  }

  if (departure.date === date) {
    items.push({ key: 'departure', kind: 'departure', start: departure.time || '', end: '', title: `Depart · ${departure.location || 'Departure point'}`, subtitle: `${transportDescriptor(departure)}${departure.to ? ` · to ${departure.to}` : ''}`, detail: departure.address || 'Departure location', mapUri: locationMapUrl(departure), locationData: departure, sort: departure.time || '99:00' })
  }

  return items.sort((a, b) => String(a.sort || '').localeCompare(String(b.sort || '')))
}


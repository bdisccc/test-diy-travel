import { Component, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlarmClock,
  ArrowLeft,
  BedDouble,
  BusFront,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Car,
  Clock3,
  ExternalLink,
  Footprints,
  FolderOpen,
  Hotel,
  ListChecks,
  Map as MapIcon,
  LoaderCircle,
  MapPin,
  Navigation,
  PackageCheck,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  Search,
  Ship,
  ShoppingBag,
  Sparkles,
  TrainFront,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import { getGooglePlaceDetails, hasGoogleMapsKey, searchGooglePlaces } from './googleMaps.js'
import { getRouteComparison } from './routes.js'
import { regionalTransitSource } from './regionalTransit.js'

const STORAGE_KEY = 'diy-travel-app-v1'
const PLAN_LIBRARY_KEY = 'diy-travel-plan-library-v1'
const ACTIVE_PLAN_KEY = 'diy-travel-active-plan-v1'

const emptyMapFields = {
  address: '',
  googlePlaceId: '',
  latitude: null,
  longitude: null,
  googleMapsURI: '',
  websiteURI: '',
  utcOffsetMinutes: null,
  source: 'manual',
}

const demoState = {
  trip: {
    name: 'Taiwan DIY Trip',
    city: 'Taiwan',
    startDate: '2026-12-05',
    endDate: '2026-12-11',
    currency: 'NT$',
    homeCurrency: '₱',
    dayStartPreferences: {},
    dayArrangementPreferences: {},
    arrival: {
      type: 'Flight',
      airline: '',
      flightNumber: '',
      from: 'Manila',
      location: 'Kaohsiung International Airport',
      date: '2026-12-05',
      time: '19:10',
      transferBufferMinutes: 60,
      ...emptyMapFields,
    },
    departure: {
      type: 'Flight',
      airline: '',
      flightNumber: '',
      to: 'Manila',
      location: 'Kaohsiung International Airport',
      date: '2026-12-11',
      time: '11:40',
      ...emptyMapFields,
    },
    hotels: [
      {
        id: 401,
        name: 'Ximending Hotel',
        checkInDate: '2026-12-07',
        checkIn: '15:00',
        checkOutDate: '2026-12-10',
        checkOut: '11:00',
        ...emptyMapFields,
      },
    ],
  },
  places: [
    {
      id: 1,
      name: 'Chiang Kai-shek Memorial Hall',
      category: 'Attraction',
      open: '09:00',
      close: '18:00',
      duration: 90,
      priority: 'Must Visit',
      visitDate: '2026-12-08',
      plannedStart: '09:15',
      ...emptyMapFields,
    },
    {
      id: 2,
      name: 'Taipei 101',
      category: 'Attraction',
      open: '11:00',
      close: '21:30',
      duration: 120,
      priority: 'High',
      visitDate: '2026-12-08',
      plannedStart: '11:20',
      ...emptyMapFields,
    },
    {
      id: 3,
      name: 'Ximending',
      category: 'Shopping',
      open: '11:00',
      close: '23:00',
      duration: 150,
      priority: 'High',
      visitDate: '2026-12-08',
      plannedStart: '16:30',
      ...emptyMapFields,
    },
    {
      id: 4,
      name: 'Shilin Night Market',
      category: 'Food',
      open: '16:00',
      close: '00:00',
      duration: 120,
      priority: 'Optional',
      visitDate: '2026-12-09',
      plannedStart: '18:00',
      ...emptyMapFields,
    },
  ],
  progress: {},
  budget: {
    total: 20000,
    shopping: 6000,
    spentOther: 2590,
    dailyTargets: {},
  },
  shopping: [
    { id: 201, name: 'EasyCard', planned: 500, actual: 500, quantity: 1, priority: 'Must Buy', bought: true },
    { id: 202, name: 'Sneakers', planned: 2500, actual: 0, quantity: 1, priority: 'Want', bought: false },
    { id: 203, name: 'Pineapple cakes', planned: 450, actual: 0, quantity: 2, priority: 'Must Buy', bought: false },
    { id: 204, name: 'Random anime stuff', planned: 1000, actual: 0, quantity: 1, priority: 'If Budget Allows', bought: false },
  ],
  packingBags: [
    { id: 'bag-carry-on', name: 'Carry-on' },
    { id: 'bag-day', name: 'Day bag' },
  ],
  packing: [
    { id: 301, name: 'Passport', checked: true, bagId: 'bag-carry-on' },
    { id: 302, name: 'Power bank', checked: true, bagId: 'bag-day' },
    { id: 303, name: 'Universal adapter', checked: false, bagId: 'bag-carry-on' },
    { id: 304, name: 'Umbrella', checked: false, bagId: 'bag-day' },
    { id: 305, name: 'Medicine', checked: false, bagId: 'bag-day' },
  ],
  expenses: [
    { id: 501, date: '2026-12-08', category: 'Food', note: 'Lunch', amount: 320 },
    { id: 502, date: '2026-12-08', category: 'Transport', note: 'MRT / EasyCard top-up', amount: 180 },
  ],
}

const navItems = [
  { id: 'plan', label: 'Plan', icon: MapIcon },
  { id: 'today', label: 'Today', icon: Navigation },
  { id: 'budget', label: 'Budget', icon: WalletCards },
  { id: 'checklist', label: 'Checklist', icon: ListChecks },
]

const CURRENCY_OPTIONS = [
  { value: 'NT$', label: 'NT$ · New Taiwan Dollar' },
  { value: '₱', label: '₱ · Philippine Peso' },
  { value: '$', label: '$ · US Dollar' },
  { value: 'S$', label: 'S$ · Singapore Dollar' },
  { value: 'HK$', label: 'HK$ · Hong Kong Dollar' },
  { value: 'RM', label: 'RM · Malaysian Ringgit' },
  { value: '฿', label: '฿ · Thai Baht' },
  { value: '¥', label: '¥ · Japanese Yen / Chinese Yuan' },
  { value: '₩', label: '₩ · Korean Won' },
  { value: '€', label: '€ · Euro' },
  { value: '£', label: '£ · British Pound' },
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

class ViewErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('DIY Travel view recovered from a render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <section className="page-section">
          <div className="card view-error-card">
            <Sparkles size={22} />
            <div><strong>This view hit an unexpected data issue.</strong><span>Your trip data is still saved. Refresh the page or edit the affected stop in Plan; the rest of the app remains available.</span></div>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}

function normalizeData(saved) {
  if (!saved || typeof saved !== 'object') return clone(demoState)
  const base = clone(demoState)
  const savedTrip = saved.trip || {}
  const arrival = { ...base.trip.arrival, ...(savedTrip.arrival || {}) }
  const departure = { ...base.trip.departure, ...(savedTrip.departure || {}) }

  let hotels = savedTrip.hotels
  if (!Array.isArray(hotels)) {
    const oldHotel = savedTrip.hotel
    hotels = oldHotel
      ? [{
          id: 401,
          ...emptyMapFields,
          name: oldHotel.name || '',
          checkInDate: savedTrip.startDate || arrival.date || base.trip.startDate,
          checkIn: oldHotel.checkIn || '15:00',
          checkOutDate: savedTrip.endDate || departure.date || base.trip.endDate,
          checkOut: oldHotel.checkOut || '11:00',
        }]
      : base.trip.hotels
  }

  const startDate = savedTrip.startDate || arrival.date || base.trip.startDate
  const endDate = savedTrip.endDate || departure.date || base.trip.endDate

  return {
    ...base,
    ...saved,
    trip: {
      ...base.trip,
      ...savedTrip,
      startDate,
      endDate,
      dayStartPreferences: { ...(base.trip.dayStartPreferences || {}), ...(savedTrip.dayStartPreferences || {}) },
      dayArrangementPreferences: { ...(base.trip.dayArrangementPreferences || {}), ...(savedTrip.dayArrangementPreferences || {}) },
      arrival: { ...arrival, date: arrival.date || startDate },
      departure: { ...departure, date: departure.date || endDate },
      hotels: hotels.map((hotel, index) => ({
        id: hotel.id || Date.now() + index,
        ...emptyMapFields,
        checkInDate: startDate,
        checkIn: '15:00',
        checkOutDate: endDate,
        checkOut: '11:00',
        ...hotel,
      })),
    },
    places: (saved.places || base.places).map((place, index) => ({
      ...emptyMapFields,
      visitDate: startDate,
      plannedStart: '',
      suggestedStart: '',
      duration: 60,
      priority: 'High',
      category: 'Attraction',
      ...place,
      id: place.id || Date.now() + index,
      timeSource: place.timeSource || 'suggested',
      hoursStatus: place.hoursStatus || (/closed/i.test(place.hoursSummary || '')
        ? 'closed'
        : (place.source === 'google' && place.regularOpeningHours
          ? 'open'
          : ((place.open || place.close) ? 'manual' : 'unavailable'))),
    })),
    progress: saved.progress || {},
    budget: {
      ...base.budget,
      ...(saved.budget || {}),
      dailyTargets: { ...(base.budget.dailyTargets || {}), ...((saved.budget || {}).dailyTargets || {}) },
    },
    shopping: (saved.shopping || base.shopping).map((item) => ({ purchaseDate: '', location: '', ...item })),
    packingBags: (() => {
      const existing = Array.isArray(saved.packingBags) && saved.packingBags.length
        ? saved.packingBags
        : (base.packingBags?.length ? base.packingBags : [{ id: 'bag-main', name: 'Main bag' }])
      return existing.map((bag, index) => ({ id: bag.id || `bag-${index + 1}`, name: bag.name || `Bag ${index + 1}` }))
    })(),
    packing: (() => {
      const bags = Array.isArray(saved.packingBags) && saved.packingBags.length
        ? saved.packingBags
        : (base.packingBags?.length ? base.packingBags : [{ id: 'bag-main', name: 'Main bag' }])
      const defaultBagId = bags[0]?.id || 'bag-main'
      return (saved.packing || base.packing).map((item) => ({ ...item, bagId: item.bagId || defaultBagId }))
    })(),
    expenses: Array.isArray(saved.expenses) ? saved.expenses : [],
  }
}

function isoToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function makePlanId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function planRecord(data, id = makePlanId(), createdAt = new Date().toISOString()) {
  return {
    id,
    createdAt,
    updatedAt: new Date().toISOString(),
    data: clone(normalizeData(data)),
  }
}

function createBlankTripData() {
  const start = new Date()
  start.setHours(12, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 5)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)
  const base = clone(demoState)
  return normalizeData({
    ...base,
    trip: {
      ...base.trip,
      name: 'Untitled DIY Trip',
      city: '',
      startDate,
      endDate,
      arrival: {
        ...base.trip.arrival,
        airline: '',
        flightNumber: '',
        from: '',
        location: '',
        date: startDate,
        time: '',
        ...emptyMapFields,
      },
      departure: {
        ...base.trip.departure,
        airline: '',
        flightNumber: '',
        to: '',
        location: '',
        date: endDate,
        time: '',
        ...emptyMapFields,
      },
      hotels: [],
    },
    places: [],
    progress: {},
    shopping: [],
    packingBags: [{ id: 'bag-main', name: 'Main bag' }],
    packing: [],
    expenses: [],
    budget: { total: 0, shopping: 0, spentOther: 0, dailyTargets: {} },
  })
}

function getPlanStatus(data) {
  const today = isoToday()
  const start = data?.trip?.startDate || ''
  const end = data?.trip?.endDate || ''
  if (end && end < today) return 'past'
  if (start && start > today) return 'future'
  return 'current'
}

function loadInitialWorkspace() {
  let current
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    current = saved ? normalizeData(JSON.parse(saved)) : clone(demoState)
  } catch {
    current = clone(demoState)
  }

  try {
    const raw = localStorage.getItem(PLAN_LIBRARY_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed) && parsed.length) {
      const normalized = parsed.map((record) => ({
        ...record,
        data: normalizeData(record.data),
      }))
      const requested = localStorage.getItem(ACTIVE_PLAN_KEY)
      const active = normalized.find((record) => record.id === requested) || normalized[0]
      return { plans: normalized, activePlanId: active.id, data: clone(active.data) }
    }
  } catch {
    // migrate the old single-trip storage below
  }

  const first = planRecord(current)
  return { plans: [first], activePlanId: first.id, data: clone(first.data) }
}

function formatMoney(value, currency) {
  return `${currency}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function formatShortDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function formatDayName(date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${date}T12:00:00`))
}

function enumerateDates(startDate, endDate) {
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

function addMinutes(time, minutes) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return ''
  const [hour, minute] = time.split(':').map(Number)
  const total = (hour * 60 + minute + Number(minutes || 0)) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function serializeOpeningHours(hours) {
  if (!hours) return null
  return {
    weekdayDescriptions: Array.isArray(hours.weekdayDescriptions) ? [...hours.weekdayDescriptions] : [],
    periods: Array.isArray(hours.periods)
      ? hours.periods.map((period) => ({
          open: period.open ? { day: period.open.day, hour: period.open.hour, minute: period.open.minute } : null,
          close: period.close ? { day: period.close.day, hour: period.close.hour, minute: period.close.minute } : null,
        }))
      : [],
  }
}

function timePartsToInput(parts) {
  if (!parts || typeof parts.hour !== 'number') return ''
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute ?? 0).padStart(2, '0')}`
}

function hoursForDate(openingHours, date) {
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

function placeWithDateHours(place, date) {
  const next = { ...place, visitDate: date }
  if (place?.source === 'google' && place?.regularOpeningHours) {
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

function inferPlaceCategory(primaryType, types = []) {
  const allTypes = [primaryType, ...types].filter(Boolean)
  if (allTypes.some((type) => ['shopping_mall', 'store', 'department_store', 'market'].includes(type))) return 'Shopping'
  if (allTypes.some((type) => ['restaurant', 'cafe', 'bakery', 'bar', 'food'].includes(type))) return 'Food'
  if (allTypes.some((type) => ['park', 'national_park', 'natural_feature', 'beach'].includes(type))) return 'Nature'
  if (allTypes.some((type) => ['lodging', 'hotel'].includes(type))) return 'Hotel'
  if (allTypes.some((type) => ['transit_station', 'train_station', 'subway_station', 'bus_station', 'airport'].includes(type))) return 'Transport'
  return 'Attraction'
}

function createBlankPlaceForm(defaultDate = '') {
  return {
    name: '', category: 'Attraction', open: '', close: '', duration: 60,
    priority: 'High', visitDate: defaultDate, plannedStart: '', suggestedStart: '', timeSource: 'suggested',
    address: '', googlePlaceId: '', latitude: null, longitude: null, googleMapsURI: '', websiteURI: '',
    primaryType: '', primaryTypeDisplayName: '', regularOpeningHours: null, currentOpeningHours: null,
    hoursSummary: '', hoursStatus: 'unavailable', source: 'manual',
  }
}

function createBlankHotel(startDate, endDate) {
  return {
    id: Date.now(), name: '', checkInDate: startDate || '', checkIn: '15:00',
    checkOutDate: endDate || '', checkOut: '11:00', ...emptyMapFields,
  }
}

function isMapped(place) {
  return Boolean(place && (place.googlePlaceId || (place.latitude != null && place.longitude != null)))
}

function firstHotelForArrival(hotels = []) {
  if (!hotels.length) return null
  return [...hotels].sort((a, b) => `${a.checkInDate || ''} ${a.checkIn || ''}`.localeCompare(`${b.checkInDate || ''} ${b.checkIn || ''}`))[0]
}

function transportDescriptor(endpoint) {
  const detail = [endpoint.airline, endpoint.flightNumber].filter(Boolean).join(' ')
  return detail || endpoint.type || 'Travel'
}

function clockToMinutes(value, fallback = null) {
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

function haversineKm(a, b) {
  const lat1 = Number(a?.latitude)
  const lng1 = Number(a?.longitude)
  const lat2 = Number(b?.latitude)
  const lng2 = Number(b?.longitude)
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null
  const toRad = (value) => value * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function estimateTransferMinutes(from, to) {
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

function hotelForDate(hotels = [], date = '') {
  return hotels.find((hotel) => hotel.checkInDate <= date && hotel.checkOutDate >= date) || null
}

function dayStartPreference(data, date) {
  const trip = data?.trip || {}
  const arrival = trip.arrival || {}
  const hotels = Array.isArray(trip.hotels) ? trip.hotels : []
  const stay = hotelForDate(hotels, date) || firstHotelForArrival(hotels)
  const saved = trip.dayStartPreferences?.[date]
  if (saved) return saved
  if (arrival?.date === date && arrival?.time) return isMapped(stay) ? 'arrival_stay' : 'arrival_places'
  return isMapped(stay) ? 'stay' : 'first_place'
}

function dayStartPreferenceLabel(mode) {
  if (mode === 'arrival_stay') return 'Airport → stay/base → places'
  if (mode === 'arrival_places') return 'Airport → first destination'
  if (mode === 'stay') return 'Stay/base → places'
  return 'Start at first destination'
}

function dayArrangementPreference(data, date) {
  const raw = data?.trip?.dayArrangementPreferences?.[date] || {}
  return {
    strategy: raw.strategy || 'balanced',
    endMode: raw.endMode || 'none',
    endPlaceId: raw.endPlaceId || '',
  }
}

function arrangementLabel(pref) {
  const strategy = pref?.strategy === 'nearest' ? 'Nearest first' : pref?.strategy === 'closing' ? 'Earlier closing first' : 'Balanced'
  if (pref?.endMode === 'stay') return `${strategy} · finish near stay/base`
  if (pref?.endMode === 'shopping') return `${strategy} · shopping last`
  if (pref?.endMode === 'place') return `${strategy} · chosen endpoint last`
  return strategy
}

function applySmartSuggestionsForDate(data, date) {
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

function applyAllSmartSuggestions(data) {
  let next = data
  enumerateDates(data?.trip?.startDate, data?.trip?.endDate).forEach((date) => {
    next = applySmartSuggestionsForDate(next, date)
  })
  return next
}

function findNextAvailableDay(data, placeId, fromDate) {
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

function smartPlaceSchedule(data, date) {
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

function buildDayItems(data, date) {
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
      detail: arrival.address || 'Arrival location', mapUri: arrival.googleMapsURI || '', locationData: arrival, sort: arrival.time || '00:00',
    })
  }

  if (startPreference === 'stay' && isMapped(stay)) {
    items.push({
      key: `day-start-stay-${date}`, kind: 'start', start: '09:00', end: '',
      title: `Start · ${stay.name || 'Stay/base'}`,
      subtitle: stay.address || 'Stay/base', detail: 'Your day starts here',
      mapUri: stay.googleMapsURI || '', locationData: stay, sort: '00:01',
    })
  }

  ;(trip.hotels || []).forEach((hotel) => {
    if (hotel.checkInDate === date && startPreference !== 'stay') {
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
        mapUri: hotel.googleMapsURI || '', locationData: hotel, sort,
      })
    }
    if (hotel.checkOutDate === date) {
      items.push({
        key: `hotel-checkout-${hotel.id}`, kind: 'hotel', start: hotel.checkOut || '', end: '',
        title: `Stay check-out · ${hotel.name || 'Accommodation'}`,
        subtitle: hotel.address || 'Accommodation', detail: 'Check-out', mapUri: hotel.googleMapsURI || '', locationData: hotel, sort: hotel.checkOut || '11:00',
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
      mapUri: place.googleMapsURI || '', locationData: place,
      sort: effectiveStart || '98:59', suggestedTime: Boolean(schedule.suggested), scheduleWarning: schedule.scheduleWarning || '',
    })
  })

  if (arrangement.endMode === 'stay' && isMapped(stay) && (data?.places || []).some((place) => place.visitDate === date && place.hoursStatus !== 'closed')) {
    items.push({
      key: `return-stay-${date}`, kind: 'return', start: '', end: '',
      title: `Return · ${stay.name || 'Stay/base'}`,
      subtitle: stay.address || 'Stay/base', detail: 'Preferred end point for this day',
      mapUri: stay.googleMapsURI || '', locationData: stay, sort: '98:58',
    })
  }

  if (departure?.date === date) {
    items.push({
      key: 'departure', kind: 'departure', start: departure.time || '', end: '',
      title: `Depart · ${departure.location || 'Departure point'}`,
      subtitle: `${transportDescriptor(departure)}${departure.to ? ` · to ${departure.to}` : ''}`,
      detail: departure.address || 'Departure location', mapUri: departure.googleMapsURI || '', locationData: departure, sort: departure.time || '99:00',
    })
  }

  return items.sort((a, b) => String(a.sort || '').localeCompare(String(b.sort || '')))
}

function GooglePlacePicker({ onSelect, title = 'Search Google Maps', placeholder = 'Search Google Maps', compact = false, includedType = '' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function runSearch(event) {
    event?.preventDefault()
    const value = query.trim()
    if (value.length < 2) {
      setError('Type at least 2 characters first.')
      return
    }
    setStatus('searching')
    setError('')
    try {
      const places = await searchGooglePlaces(value, { includedType, maxResults: 6 })
      setResults(places)
      setStatus('ready')
      if (!places.length) setError('No Google Maps matches were found. Try a more specific place name.')
    } catch (searchError) {
      console.error('Google Places Text Search failed:', searchError)
      setResults([])
      setStatus('error')
      const message = searchError?.message || 'Unknown Google Maps error'
      setError(`Google Maps search failed: ${message}`)
    }
  }

  async function choosePlace(place) {
    setStatus('fetching')
    setError('')
    try {
      const detailed = place.googlePlaceId ? await getGooglePlaceDetails(place.googlePlaceId) : place
      const selected = detailed || place
      setQuery(selected.name || query)
      setResults([])
      onSelect?.(selected)
      setStatus('ready')
    } catch (detailsError) {
      console.error('Google Place Details failed:', detailsError)
      setStatus('error')
      setError(`The place was found, but Google details could not be loaded: ${detailsError?.message || 'Unknown error'}`)
    }
  }

  return (
    <div className={`google-picker text-search-picker ${compact ? 'compact' : ''}`}>
      <div className="google-picker-title"><Search size={15} /><span>{title}</span></div>
      <div className="google-text-search-row">
        <div className="custom-autocomplete-wrap">
          <Search className="custom-search-icon" size={18} />
          <input
            className="custom-google-input"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.stopPropagation()
                runSearch()
              }
            }}
          />
        </div>
        <button
          type="button"
          className="secondary-button google-search-button"
          disabled={status === 'searching'}
          onClick={() => runSearch()}
        >
          {status === 'searching' ? <LoaderCircle className="google-search-spinner-inline" size={16} /> : <Search size={16} />}
          Search
        </button>
      </div>
      {results.length > 0 && (
        <div className="google-text-results" role="listbox">
          {results.map((place, index) => (
            <button
              key={`${place.googlePlaceId || place.name}-${index}`}
              type="button"
              className="google-text-result"
              onClick={() => choosePlace(place)}
            >
              <MapPin size={16} />
              <span><strong>{place.name || 'Google Maps result'}</strong><small>{place.address || 'Address unavailable'}</small></span>
            </button>
          ))}
          <div className="google-suggestions-footer">Place data powered by Google Maps</div>
        </div>
      )}
      {error && <div className="google-picker-error">{error}</div>}
      {!compact && <span className="google-attribution">Google Maps · demo mode</span>}
    </div>
  )
}

function AirportLocationField({ title, value, onChange, onPlaceSelect }) {
  const [query, setQuery] = useState(value.location || '')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    setQuery(value.location || '')
  }, [value.location])

  async function runSearch() {
    const searchValue = query.trim()
    if (searchValue.length < 2) {
      setError('Enter an airport name or IATA code first.')
      return
    }
    setStatus('searching')
    setError('')
    try {
      const matches = await searchGooglePlaces(searchValue, { includedType: 'airport', maxResults: 5 })
      setResults(matches)
      setStatus('ready')
      if (!matches.length) setError('No matching airport was found. You can still keep the airport name manually.')
    } catch (searchError) {
      console.error('Airport search failed:', searchError)
      setResults([])
      setStatus('error')
      setError(`Airport search failed: ${searchError?.message || 'Unknown Google Maps error'}`)
    }
  }

  async function chooseAirport(place) {
    setStatus('fetching')
    setError('')
    try {
      const detailed = place.googlePlaceId ? await getGooglePlaceDetails(place.googlePlaceId) : place
      const selected = detailed || place
      setQuery(selected.name || query)
      setResults([])
      onPlaceSelect?.(selected)
      setStatus('ready')
    } catch (detailsError) {
      console.error('Airport details failed:', detailsError)
      setStatus('error')
      setError(`Airport found, but its map details could not be loaded: ${detailsError?.message || 'Unknown error'}`)
    }
  }

  function changeAirportName(nextValue) {
    setQuery(nextValue)
    setResults([])
    setError('')
    onChange({
      location: nextValue,
      address: '', googlePlaceId: '', latitude: null, longitude: null,
      googleMapsURI: '', websiteURI: '', utcOffsetMinutes: null, source: 'manual',
    })
  }

  return (
    <div className="manual-flight-airport-field">
      <label>
        <span>{title} airport</span>
        <div className="airport-field-search">
          <Search size={18} />
          <input
            value={query}
            placeholder="Search airport name or IATA code"
            autoComplete="off"
            onChange={(e) => changeAirportName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runSearch()
              }
            }}
          />
          <button type="button" className="airport-field-search-button" onClick={runSearch} disabled={status === 'searching' || status === 'fetching'}>
            {status === 'searching' || status === 'fetching' ? <LoaderCircle size={16} /> : <Search size={16} />}
            <span>Search</span>
          </button>
        </div>
      </label>

      {results.length > 0 && (
        <div className="airport-search-results">
          {results.map((place) => (
            <button type="button" key={place.googlePlaceId || `${place.name}-${place.address}`} onClick={() => chooseAirport(place)}>
              <MapPin size={15} />
              <span><strong>{place.name}</strong><small>{place.address || 'Address unavailable'}</small></span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="airport-search-error">{error}</div>}

      {(value.location || value.address) && (
        <div className={`airport-field-details ${isMapped(value) ? 'mapped' : ''}`}>
          <MapPin size={16} />
          <div>
            <strong>{value.location || 'Airport'}</strong>
            <span>{value.address || 'Address will appear after selecting a Google Maps result.'}</span>
          </div>
          {value.googleMapsURI && <a href={value.googleMapsURI} target="_blank" rel="noreferrer" title="Open airport in Google Maps"><ExternalLink size={15} /></a>}
        </div>
      )}
    </div>
  )
}

function formatRouteFare(fare) {
  if (!fare?.currencyCode) return ''
  const units = Number(fare.units || 0)
  const nanos = Number(fare.nanos || 0) / 1_000_000_000
  const value = units + nanos
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: fare.currencyCode, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${fare.currencyCode} ${value.toFixed(2)}`
  }
}

function localDateTimeToUtc(date, time, utcOffsetMinutes, addBuffer = 0) {
  if (!date || !time || utcOffsetMinutes == null) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute + Number(addBuffer || 0))
  return new Date(localAsUtc - Number(utcOffsetMinutes) * 60_000).toISOString()
}

function googleDirectionsUrl(origin, destination, travelMode = 'walking') {
  const originLat = Number(origin?.latitude)
  const originLng = Number(origin?.longitude)
  const destinationLat = Number(destination?.latitude)
  const destinationLng = Number(destination?.longitude)
  if (![originLat, originLng, destinationLat, destinationLng].every(Number.isFinite)) return ''
  const params = new URLSearchParams({
    api: '1',
    origin: `${originLat},${originLng}`,
    destination: `${destinationLat},${destinationLng}`,
    travelmode: travelMode,
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function transportIcon(mode, size = 18) {
  if (mode === 'BUS') return <BusFront size={size} />
  if (mode === 'RAIL') return <TrainFront size={size} />
  if (mode === 'FERRY') return <Ship size={size} />
  if (mode === 'WALK') return <Footprints size={size} />
  return <Car size={size} />
}

function modeLabel(mode) {
  if (mode === 'BUS') return 'Bus'
  if (mode === 'RAIL') return 'Train / MRT'
  if (mode === 'FERRY') return 'Ferry / boat'
  if (mode === 'WALK') return 'Walk'
  return 'Drive / taxi'
}

function transitUnavailableCopy(option) {
  if (option?.availability === 'providers-unavailable' || option?.availability === 'schedule-unavailable') {
    return {
      title: 'Schedule unavailable',
      detail: 'We could not reach a timetable source for this leg right now.',
    }
  }
  return {
    title: 'Not available',
    detail: 'No matching service was found for this leg.',
  }
}

function transitFareAmount(route) {
  const fare = route?.travelAdvisory?.transitFare
  if (!fare?.currencyCode) return null
  const units = Number(fare.units || 0)
  const nanos = Number(fare.nanos || 0) / 1_000_000_000
  const value = units + nanos
  return Number.isFinite(value) ? value : null
}

function pickRecommendedRoute(options) {
  const successful = options.filter((option) => option.route)
  if (!successful.length) return null

  const walk = successful.find((option) => option.mode === 'WALK')
  if (walk && (walk.minutes || Infinity) <= 15) return walk.mode

  const transit = successful.filter((option) => option.mode === 'BUS' || option.mode === 'RAIL' || option.mode === 'FERRY')
  const bestTransit = [...transit].sort((a, b) => {
    const timeDiff = (a.minutes || Infinity) - (b.minutes || Infinity)
    if (Math.abs(timeDiff) > 5) return timeDiff
    const fareA = transitFareAmount(a.route)
    const fareB = transitFareAmount(b.route)
    if (fareA != null && fareB != null && fareA !== fareB) return fareA - fareB
    return timeDiff
  })[0]
  const drive = successful.find((option) => option.mode === 'DRIVE')

  // If driving saves a meaningful amount of time, recommend it as the time-efficient option.
  if (drive && bestTransit && Number(drive.minutes) + 20 < Number(bestTransit.minutes)) return 'DRIVE'
  if (bestTransit) return bestTransit.mode
  if (drive) return drive.mode
  return walk?.mode || successful[0].mode
}

function recommendationBadge(options, mode) {
  const recommended = options.find((option) => option.mode === mode && option.route)
  if (!recommended) return 'Recommended'
  if (mode === 'WALK') return 'Best for short distance'
  if (mode === 'DRIVE') return 'Fastest'
  const fare = transitFareAmount(recommended.route)
  return fare != null ? 'Best value' : 'Best balance'
}

function recommendationReason(options, mode) {
  const recommended = options.find((option) => option.mode === mode && option.route)
  if (!recommended) return ''
  const walk = options.find((option) => option.mode === 'WALK' && option.route)
  const drive = options.find((option) => option.mode === 'DRIVE' && option.route)
  const transit = options.filter((option) => (option.mode === 'BUS' || option.mode === 'RAIL' || option.mode === 'FERRY') && option.route)
  const fastestTransit = [...transit].sort((a, b) => (a.minutes || Infinity) - (b.minutes || Infinity))[0]

  if (mode === 'WALK') {
    return `Walking is recommended because this is a short trip of about ${recommended.minutes || '?'} minutes and it costs nothing.`
  }
  if (mode === 'DRIVE') {
    const comparison = fastestTransit?.minutes ? Math.max(0, fastestTransit.minutes - recommended.minutes) : null
    return comparison && comparison > 0
      ? `Driving is the most time-efficient option and saves about ${comparison} minutes compared with the fastest available public transit.`
      : 'Driving is the fastest available option for this leg.'
  }

  const fare = formatRouteFare(recommended.route.travelAdvisory?.transitFare)
  const driveDifference = drive?.minutes ? recommended.minutes - drive.minutes : null
  const walkSaving = walk?.minutes ? walk.minutes - recommended.minutes : null
  const label = modeLabel(mode)
  const parts = [`${label} gives the best balance for this leg at about ${recommended.minutes || '?'} minutes`]
  if (fare) parts.push(`with a fare of ${fare}`)
  if (driveDifference != null && driveDifference >= 0 && driveDifference <= 20) parts.push(`only ${driveDifference} minutes slower than driving`)
  if (walkSaving != null && walkSaving > 15) parts.push(`and saves about ${walkSaving} minutes versus walking`)
  return `${parts.join(', ')}.`
}

function transitFactRows(route) {
  const summary = route?.transitSummary
  if (!summary) return []
  return [
    summary.departureStop && ['Board at', summary.departureStop],
    summary.lineSummary && ['Take', summary.lineSummary],
    summary.platform && ['Platform / stand', summary.platform],
    summary.departureTime && ['Recommended departure', summary.departureTime],
    route.nextDepartureTime && ['Next service', route.nextDepartureTime],
    summary.arrivalStop && ['Get off at', summary.arrivalStop],
    summary.arrivalTime && ['Expected arrival', summary.arrivalTime],
    summary.stopCount > 0 && ['Stops', `${summary.stopCount}`],
    summary.transfers > 0 && ['Transfers', `${summary.transfers}`],
    summary.walkBeforeDuration && ['Walk to transit', [summary.walkBeforeDuration, summary.walkBeforeDistance].filter(Boolean).join(' · ')],
    summary.walkAfterDuration && ['Walk after transit', [summary.walkAfterDuration, summary.walkAfterDistance].filter(Boolean).join(' · ')],
  ].filter(Boolean)
}

function InAppRouteRecommendations({ origin, destination, date, time, utcOffsetMinutes, bufferMinutes = 0, compact = false }) {
  const [status, setStatus] = useState('idle')
  const [options, setOptions] = useState([])
  const [error, setError] = useState('')
  const [expandedMode, setExpandedMode] = useState('RAIL')

  const ready = isMapped(origin) && isMapped(destination)

  async function loadRoutes(forceRefresh = false) {
    if (!ready) return
    setStatus('loading')
    setError('')
    try {
      const requestedDeparture = localDateTimeToUtc(date, time, utcOffsetMinutes, bufferMinutes)
      const now = Date.now()
      const maxTransit = now + 100 * 24 * 60 * 60 * 1000
      const requestedMillis = requestedDeparture ? new Date(requestedDeparture).getTime() : NaN
      const departureTime = Number.isFinite(requestedMillis) && requestedMillis > now && requestedMillis <= maxTransit
        ? requestedDeparture
        : null

      const result = await getRouteComparison({ origin, destination, departureTime, bypassCache: forceRefresh })
      setOptions(result)
      const recommended = pickRecommendedRoute(result)
      setExpandedMode(recommended || result.find((item) => item.route)?.mode || 'RAIL')
      setStatus('ready')
    } catch (routeError) {
      console.error(routeError)
      setStatus('error')
      setError(routeError.message || 'Route options could not be loaded.')
    }
  }

  const recommendedMode = pickRecommendedRoute(options)
  const successful = options.filter((option) => option.route)
  const visibleOptions = options.filter((option) => option.mode !== 'FERRY' || option.route)
  const transitUnavailable = options.some((option) => ['BUS', 'RAIL', 'FERRY'].includes(option.mode) && !option.route)
  const regionalSource = regionalTransitSource(origin, destination)

  return (
    <div className={`route-recommendation route-summary-only ${compact ? 'compact' : ''}`}>
      {status === 'idle' && (
        <button type="button" className="secondary-button route-load-button" onClick={() => loadRoutes(false)} disabled={!ready}>
          <TrainFront size={16} /> {ready ? 'Compare transport options' : 'Map both locations first'}
        </button>
      )}
      {status === 'loading' && <div className="route-loading"><LoaderCircle size={18} /> Checking available public transport schedules…</div>}
      {error && (
        <div className={`route-error ${/quota reached/i.test(error) ? 'route-quota-error' : ''}`}>
          <strong>{/quota reached/i.test(error) ? 'Route demo limit reached' : 'Route options unavailable'}</strong>
          <span>{error}</span>
          {/quota reached/i.test(error) && (
            <div className="route-fallback-links">
              {googleDirectionsUrl(origin, destination, 'walking') && <a className="ghost-button" href={googleDirectionsUrl(origin, destination, 'walking')} target="_blank" rel="noreferrer"><Footprints size={14} /> Walking map</a>}
              {googleDirectionsUrl(origin, destination, 'transit') && <a className="ghost-button" href={googleDirectionsUrl(origin, destination, 'transit')} target="_blank" rel="noreferrer"><TrainFront size={14} /> Transit map</a>}
              {googleDirectionsUrl(origin, destination, 'driving') && <a className="ghost-button" href={googleDirectionsUrl(origin, destination, 'driving')} target="_blank" rel="noreferrer"><Car size={14} /> Driving map</a>}
            </div>
          )}
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="route-distance-banner">
            <MapPin size={16} />
            <span><strong>{origin?.location || origin?.name || 'Start'}</strong> → <strong>{destination?.location || destination?.name || 'Destination'}</strong></span>
            <b>{successful[0]?.route?.localizedValues?.distance?.text || ''}</b>
          </div>

          <div className="route-option-grid route-option-grid-dynamic">
            {visibleOptions.map((option) => {
              const route = option.route
              const isRecommended = option.mode === recommendedMode && route
              const fare = route ? formatRouteFare(route.travelAdvisory?.transitFare) : ''
              return (
                <button
                  type="button"
                  key={option.mode}
                  className={`route-option ${isRecommended ? 'recommended' : ''} ${!route ? 'unavailable' : ''} ${expandedMode === option.mode ? 'selected' : ''}`}
                  onClick={() => route && setExpandedMode(option.mode)}
                  disabled={!route}
                >
                  <div className="route-option-head">
                    <span>{transportIcon(option.mode, 17)} {modeLabel(option.mode)}</span>
                    {isRecommended && <small>{recommendationBadge(options, option.mode)}</small>}
                  </div>
                  {route ? (
                    <>
                      <strong>{route.localizedValues?.duration?.text || `${option.minutes || '?'} min`}</strong>
                      <span>{route.localizedValues?.distance?.text || `${((route.distanceMeters || 0) / 1000).toFixed(1)} km`}</span>
                      <em>{option.mode === 'WALK' ? 'Free' : fare || (option.mode === 'DRIVE' ? 'Fare estimate unavailable' : 'Fare unavailable')}</em>
                    </>
                  ) : (() => {
                    const unavailable = transitUnavailableCopy(option)
                    return <><strong className="route-na">{unavailable.title}</strong><span className="route-unavailable-copy">{unavailable.detail}</span></>
                  })()}
                </button>
              )
            })}
          </div>

          {transitUnavailable && regionalSource && (
            <div className="regional-transit-fallback">
              <div className="regional-transit-copy">
                <span className="regional-transit-kicker">Regional schedule backup</span>
                <strong>{regionalSource.title}</strong>
                <span>{regionalSource.description}</span>
              </div>
              <div className="regional-transit-actions">
                <a className="secondary-button" href={regionalSource.actionUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {regionalSource.actionLabel}</a>
                <a className="ghost-button" href={regionalSource.sourceUrl} target="_blank" rel="noreferrer">{regionalSource.sourceLabel}</a>
              </div>
              <small>{regionalSource.caution}</small>
            </div>
          )}

          {successful.length > 0 && (() => {
            const active = options.find((option) => option.mode === expandedMode && option.route) || successful[0]
            const route = active.route
            const transitRows = active.mode === 'BUS' || active.mode === 'RAIL' || active.mode === 'FERRY' ? transitFactRows(route) : []
            return (
              <div className="route-details route-simple-details">
                <div className="route-details-title">
                  <div>{transportIcon(active.mode, 18)}<span><strong>{modeLabel(active.mode)}</strong><small>{active.mode === recommendedMode ? 'Our current recommendation' : 'Alternative option'}</small></span></div>
                  <button type="button" className="ghost-button route-refresh" onClick={() => loadRoutes(true)}>Refresh</button>
                </div>
                {active.mode === recommendedMode && (
                  <div className="route-why-recommended">
                    <Sparkles size={16} />
                    <div><strong>Why we recommend this</strong><span>{recommendationReason(options, recommendedMode)}</span></div>
                  </div>
                )}

                {active.mode === 'WALK' && (
                  <div className="route-simple-copy walk-route-copy">
                    <div><strong>{route.localizedValues?.duration?.text}</strong><span>{route.localizedValues?.distance?.text} walking from this stop to the next destination.</span></div>
                    {googleDirectionsUrl(origin, destination, 'walking') && <a className="secondary-button walk-map-link" href={googleDirectionsUrl(origin, destination, 'walking')} target="_blank" rel="noreferrer"><Navigation size={15} /> Open walking route</a>}
                  </div>
                )}

                {active.mode === 'DRIVE' && (
                  <div className="route-simple-copy walk-route-copy">
                    <div><strong>{route.localizedValues?.duration?.text}</strong><span>{route.localizedValues?.distance?.text} by car/taxi. This is a planning estimate, not live traffic.</span></div>
                    {googleDirectionsUrl(origin, destination, 'driving') && <a className="secondary-button walk-map-link" href={googleDirectionsUrl(origin, destination, 'driving')} target="_blank" rel="noreferrer"><Navigation size={15} /> Open driving route</a>}
                  </div>
                )}

                {(active.mode === 'BUS' || active.mode === 'RAIL' || active.mode === 'FERRY') && (
                  transitRows.length ? (
                    <div className="transit-facts">
                      {transitRows.map(([label, value]) => (
                        <div className="transit-fact" key={`${active.mode}-${label}`}>
                          <span>{label}</span><strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="route-simple-copy"><span>The routing provider returned a transit duration, but detailed stop information is unavailable for this route.</span></div>
                  )
                )}

                {route.provider && route.providerKind !== 'local-estimate' && (
                  <div className="route-provider-note">
                    <span>Schedule source: <strong>{route.provider}</strong></span>
                  </div>
                )}
                {route.providerKind === 'local-estimate' && (
                  <div className="route-provider-note route-provider-note-estimate"><span>Planning estimate · use the map link for live navigation.</span></div>
                )}
                {active.mode === 'WALK' && <p className="route-beta-warning">Walking routes can occasionally miss temporary closures or local pedestrian restrictions. Confirm local conditions.</p>}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

function MappedLocationSummary({ value, emptyText = 'Not mapped yet' }) {
  if (!isMapped(value)) return <div className="mapped-location empty"><MapPin size={15} /><span>{emptyText}</span></div>
  return (
    <div className="mapped-location">
      <MapPin size={15} />
      <div>
        <strong>{value.location || value.name || 'Mapped location'}</strong>
        <span>{value.address || 'Coordinates saved'}</span>
      </div>
      {value.googleMapsURI && <a href={value.googleMapsURI} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>}
    </div>
  )
}

function App() {
  const initial = useMemo(() => loadInitialWorkspace(), [])
  const [active, setActive] = useState('plan')
  const [planScreen, setPlanScreen] = useState('dashboard')
  const [moduleScreen, setModuleScreen] = useState('dashboard')
  const [plans, setPlans] = useState(initial.plans)
  const [activePlanId, setActivePlanId] = useState(initial.activePlanId)
  const [data, setData] = useState(initial.data)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setPlans((prev) => prev.map((record) => (
      record.id === activePlanId
        ? { ...record, updatedAt: new Date().toISOString(), data: clone(data) }
        : record
    )))
  }, [data, activePlanId])

  useEffect(() => {
    localStorage.setItem(PLAN_LIBRARY_KEY, JSON.stringify(plans))
  }, [plans])

  useEffect(() => {
    localStorage.setItem(ACTIVE_PLAN_KEY, activePlanId)
  }, [activePlanId])

  const shoppingSpent = useMemo(() => data.shopping.reduce((sum, item) => sum + Number(item.actual || 0), 0), [data.shopping])
  const shoppingPlanned = useMemo(() => data.shopping.reduce((sum, item) => sum + Number(item.planned || 0) * Number(item.quantity || 1), 0), [data.shopping])
  const expenseSpent = useMemo(() => (data.expenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0), [data.expenses])
  const totalSpent = shoppingSpent + Number(data.budget.spentOther || 0) + expenseSpent
  const remaining = Number(data.budget.total || 0) - totalSpent

  function goToPlanDashboard() {
    setActive('plan')
    setPlanScreen('dashboard')
  }

  function openPlan(id) {
    const record = plans.find((item) => item.id === id)
    if (!record) return
    setActivePlanId(id)
    setData(normalizeData(clone(record.data)))
    setActive('plan')
    setPlanScreen('editor')
  }

  function createPlan() {
    const next = planRecord(createBlankTripData())
    setPlans((prev) => [next, ...prev])
    setActivePlanId(next.id)
    setData(clone(next.data))
    setActive('plan')
    setPlanScreen('editor')
  }

  function duplicatePlan(id) {
    const source = plans.find((item) => item.id === id)
    if (!source) return
    const duplicated = normalizeData(clone(source.data))
    duplicated.trip.name = `${duplicated.trip.name || 'DIY Trip'} Copy`
    duplicated.progress = {}
    const next = planRecord(duplicated)
    setPlans((prev) => [next, ...prev])
    setActivePlanId(next.id)
    setData(clone(next.data))
    setActive('plan')
    setPlanScreen('editor')
  }

  function deletePlan(id) {
    const target = plans.find((item) => item.id === id)
    if (!target) return
    const tripName = target.data?.trip?.name || 'this trip'
    if (!window.confirm(`Delete “${tripName}”? This removes the saved plan from this browser.`)) return

    const remainingPlans = plans.filter((item) => item.id !== id)
    if (remainingPlans.length) {
      setPlans(remainingPlans)
      if (id === activePlanId) {
        const nextActive = remainingPlans[0]
        setActivePlanId(nextActive.id)
        setData(normalizeData(clone(nextActive.data)))
      }
    } else {
      const replacement = planRecord(createBlankTripData())
      setPlans([replacement])
      setActivePlanId(replacement.id)
      setData(clone(replacement.data))
    }
    setActive('plan')
    setPlanScreen('dashboard')
  }

  function resetDemo() {
    const nextData = clone(demoState)
    const next = planRecord(nextData)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(PLAN_LIBRARY_KEY)
    localStorage.removeItem(ACTIVE_PLAN_KEY)
    setPlans([next])
    setActivePlanId(next.id)
    setData(nextData)
    setActive('plan')
    setPlanScreen('dashboard')
  }

  function navigate(itemId) {
    if (itemId === 'plan') {
      goToPlanDashboard()
      return
    }
    setActive(itemId)
    setModuleScreen('dashboard')
  }

  function openModulePlan(id, moduleId) {
    const record = plans.find((item) => item.id === id)
    if (!record) return
    setActivePlanId(id)
    setData(normalizeData(clone(record.data)))
    setActive(moduleId)
    setModuleScreen('detail')
  }

  function goToModuleDashboard() {
    if (active === 'plan') {
      goToPlanDashboard()
      return
    }
    setModuleScreen('dashboard')
  }

  const showDashboardHeader = (active === 'plan' && planScreen === 'dashboard') || (active !== 'plan' && moduleScreen === 'dashboard')
  const dashboardTitle = active === 'plan' ? 'My Trips' : active === 'today' ? 'Today' : active === 'budget' ? 'Budgets' : 'Checklists'
  const dashboardEyebrow = active === 'plan' ? 'TRIP LIBRARY' : 'CHOOSE A TRIP'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><Navigation size={18} /></div>
          <div><strong>DIY Travel</strong><span>Trip companion</span></div>
        </div>
        <nav className="side-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return <button key={item.id} className={`nav-button ${active === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.label}</span></button>
          })}
        </nav>
        <div className="sidebar-trip-card">
          <span className="eyebrow">ACTIVE TRIP</span>
          <strong>{data.trip.name}</strong>
          <span>{formatDate(data.trip.startDate)} — {formatDate(data.trip.endDate)}</span>
          <div className="mini-budget-row"><span>Remaining</span><strong>{formatMoney(remaining, data.trip.currency)}</strong></div>
        </div>
        <button className="reset-button" onClick={resetDemo}><RotateCcw size={16} /> Reset demo data</button>
      </aside>

      <main className="main-content">
        {showDashboardHeader ? (
          <header className="topbar trips-topbar">
            <div><span className="eyebrow">{dashboardEyebrow}</span><h1>{dashboardTitle}</h1></div>
          </header>
        ) : (
          <TopbarTripEditor data={data} setData={setData} onBack={goToModuleDashboard} showBack />
        )}
        <nav className="mobile-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span></button>
          })}
        </nav>
        <div className="page-content">
          {active === 'plan' && planScreen === 'dashboard' && (
            <TripDashboard
              plans={plans}
              activePlanId={activePlanId}
              onOpen={openPlan}
              onDuplicate={duplicatePlan}
              onDelete={deletePlan}
              onCreate={createPlan}
            />
          )}
          {active === 'plan' && planScreen === 'editor' && <PlanView data={data} setData={setData} onBack={goToPlanDashboard} />}
          {active !== 'plan' && moduleScreen === 'dashboard' && <ModuleTripDashboard moduleId={active} plans={plans} activePlanId={activePlanId} onOpen={openModulePlan} />}
          {active === 'today' && moduleScreen === 'detail' && <ViewErrorBoundary key={`today-${activePlanId}-${data.trip.startDate}-${data.trip.endDate}`}><TodayView data={data} setData={setData} /></ViewErrorBoundary>}
          {active === 'budget' && moduleScreen === 'detail' && <BudgetView data={data} setData={setData} shoppingSpent={shoppingSpent} shoppingPlanned={shoppingPlanned} totalSpent={totalSpent} remaining={remaining} expenseSpent={expenseSpent} />}
          {active === 'checklist' && moduleScreen === 'detail' && <ChecklistView data={data} setData={setData} />}
        </div>
      </main>
    </div>
  )
}

function TopbarTripEditor({ data, setData, onBack, showBack = false }) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDates, setEditingDates] = useState(false)

  function updateName(value) {
    setData((prev) => ({ ...prev, trip: { ...prev.trip, name: value } }))
  }

  function updateDate(field, value) {
    setData((prev) => {
      const endpoint = field === 'startDate' ? 'arrival' : 'departure'
      return {
        ...prev,
        trip: {
          ...prev.trip,
          [field]: value,
          [endpoint]: { ...prev.trip[endpoint], date: value },
        },
      }
    })
  }

  return (
    <header className="topbar editable-topbar">
      <div className="topbar-title-wrap">
        {showBack && <button className="topbar-back" title="Back to all trips" onClick={onBack}><ArrowLeft size={18} /></button>}
        <div className="topbar-title-copy">
          <span className="eyebrow">{data.trip.city || 'DIY TRIP'}</span>
          {editingTitle ? (
            <input
              className="topbar-title-input"
              value={data.trip.name}
              autoFocus
              onChange={(e) => updateName(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
            />
          ) : (
            <button className="topbar-edit-title" onClick={() => setEditingTitle(true)} title="Edit trip title">
              <h1>{data.trip.name || 'Untitled Trip'}</h1><Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {editingDates ? (
        <div className="topbar-date-editor">
          <label>Start<input type="date" value={data.trip.startDate || ''} onChange={(e) => updateDate('startDate', e.target.value)} /></label>
          <span>—</span>
          <label>End<input type="date" value={data.trip.endDate || ''} onChange={(e) => updateDate('endDate', e.target.value)} /></label>
          <button className="icon-button" title="Done editing dates" onClick={() => setEditingDates(false)}><Check size={16} /></button>
        </div>
      ) : (
        <button className="trip-dates editable-trip-dates" onClick={() => setEditingDates(true)} title="Edit trip dates">
          <CalendarDays size={18} /><span>{formatDate(data.trip.startDate)} — {formatDate(data.trip.endDate)}</span><Pencil size={13} />
        </button>
      )}
    </header>
  )
}

function TripDashboard({ plans, activePlanId, onOpen, onDuplicate, onDelete, onCreate }) {
  const groups = {
    current: plans.filter((record) => getPlanStatus(record.data) === 'current'),
    future: plans.filter((record) => getPlanStatus(record.data) === 'future'),
    past: plans.filter((record) => getPlanStatus(record.data) === 'past'),
  }

  const sections = [
    ['current', 'Current trips', 'Trips happening now'],
    ['future', 'Future trips', 'Trips you are still planning'],
    ['past', 'Past trips', 'Open, duplicate, or repeat an old itinerary'],
  ]

  return (
    <section className="page-section trip-dashboard">
      <div className="dashboard-welcome card">
        <div>
          <span className="eyebrow">DIY TRAVEL PLANS</span>
          <h2>Your trips, all in one place.</h2>
          <p>Keep previous itineraries, continue an upcoming plan, or duplicate a trip instead of starting from zero.</p>
        </div>
        <button className="primary-button" onClick={onCreate}><Plus size={17} /> Create trip</button>
      </div>

      {sections.map(([key, title, description]) => (
        <div className="trip-library-section" key={key}>
          <div className="section-heading">
            <div><span className="eyebrow">{key.toUpperCase()}</span><h3>{title}</h3><p>{description}</p></div>
          </div>
          {groups[key].length ? (
            <div className="trip-card-grid">
              {groups[key].map((record) => {
                const trip = record.data.trip
                const isActive = record.id === activePlanId
                return (
                  <article className={`card trip-library-card ${isActive ? 'active-plan' : ''}`} key={record.id}>
                    <div className="trip-library-card-head">
                      <div className="trip-library-icon"><MapIcon size={19} /></div>
                      <span className={`trip-state-dot ${key}`} title={key} />
                    </div>
                    <div className="trip-library-copy">
                      <span className="eyebrow">{trip.city || 'Destination not set'}</span>
                      <strong>{trip.name || 'Untitled Trip'}</strong>
                      <span><CalendarDays size={13} /> {formatDate(trip.startDate)} — {formatDate(trip.endDate)}</span>
                      <small>{record.data.places?.length || 0} places · {trip.hotels?.length || 0} stays{isActive ? ' · Active' : ''}</small>
                    </div>
                    <div className="trip-library-actions">
                      <button className="primary-button" onClick={() => onOpen(record.id)}><FolderOpen size={16} /> Open</button>
                      <button className="ghost-button" onClick={() => onDuplicate(record.id)}><Copy size={16} /> {key === 'past' ? 'Repeat' : 'Duplicate'}</button>
                      <button className="ghost-button trip-delete-button" onClick={() => onDelete(record.id)}><Trash2 size={16} /> Delete</button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-trip-section">No {title.toLowerCase()} yet.</div>
          )}
        </div>
      ))}
    </section>
  )
}


function ModuleTripDashboard({ moduleId, plans, activePlanId, onOpen }) {
  const moduleMeta = {
    today: { eyebrow: 'DAILY COMPANION', title: 'Choose a trip for Today', description: 'Open the trip you are currently following, or review another itinerary without changing its plan.', icon: Navigation, action: 'Open Today' },
    budget: { eyebrow: 'TRIP BUDGETS', title: 'Choose a trip budget', description: 'Every trip keeps its own whole-stay budget, daily limits, expenses, and shopping list.', icon: WalletCards, action: 'Open Budget' },
    checklist: { eyebrow: 'TRIP CHECKLISTS', title: 'Choose a travel checklist', description: 'Packing bags and shopping checklists stay separate for every saved trip.', icon: ListChecks, action: 'Open Checklist' },
  }
  const meta = moduleMeta[moduleId] || moduleMeta.today
  const Icon = meta.icon
  const sorted = [...plans].sort((a, b) => String(a.data?.trip?.startDate || '').localeCompare(String(b.data?.trip?.startDate || '')))

  function summary(record) {
    const tripData = record.data || {}
    if (moduleId === 'budget') {
      const shopping = (tripData.shopping || []).reduce((sum, item) => sum + Number(item.actual || 0), 0)
      const expenses = (tripData.expenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const total = Number(tripData.budget?.total || 0)
      const spent = shopping + expenses + Number(tripData.budget?.spentOther || 0)
      return `${formatMoney(spent, tripData.trip?.currency || 'NT$')} spent · ${formatMoney(total - spent, tripData.trip?.currency || 'NT$')} remaining`
    }
    if (moduleId === 'checklist') {
      const packing = tripData.packing || []
      const packed = packing.filter((item) => item.checked).length
      const shopping = tripData.shopping || []
      const bought = shopping.filter((item) => item.bought).length
      return `${packed}/${packing.length} packed · ${bought}/${shopping.length} shopping items bought`
    }
    const places = tripData.places || []
    const done = Object.values(tripData.progress || {}).filter((status) => status === 'done').length
    return `${places.length} places · ${done} completed stops`
  }

  return (
    <section className="page-section module-trip-dashboard">
      <div className="dashboard-welcome card module-dashboard-welcome">
        <div><span className="eyebrow">{meta.eyebrow}</span><h2>{meta.title}</h2><p>{meta.description}</p></div>
        <div className="hero-icon compact"><Icon size={25} /></div>
      </div>
      <div className="module-trip-grid">
        {sorted.map((record) => {
          const trip = record.data?.trip || {}
          const status = getPlanStatus(record.data)
          return (
            <article className={`card module-trip-card ${record.id === activePlanId ? 'active-plan' : ''}`} key={record.id}>
              <div className="module-trip-card-head"><div className="trip-library-icon"><Icon size={18} /></div><span className={`trip-state-dot ${status}`} title={status} /></div>
              <div className="module-trip-card-copy"><span className="eyebrow">{trip.city || 'Destination not set'}</span><strong>{trip.name || 'Untitled Trip'}</strong><span><CalendarDays size={13} /> {formatDate(trip.startDate)} — {formatDate(trip.endDate)}</span><small>{summary(record)}</small></div>
              <button className="primary-button" onClick={() => onOpen(record.id, moduleId)}><FolderOpen size={16} /> {meta.action}</button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PlanView({ data, setData, onBack }) {
  const [showPlaceForm, setShowPlaceForm] = useState(false)
  const [selectedGooglePlace, setSelectedGooglePlace] = useState(null)
  const [placeForm, setPlaceForm] = useState(() => createBlankPlaceForm(data.trip.startDate))
  const [editingPlaceId, setEditingPlaceId] = useState(null)
  const [placeDateFilter, setPlaceDateFilter] = useState('all')
  const [placeFormError, setPlaceFormError] = useState('')
  const googleConfigured = hasGoogleMapsKey()

  function scrollToPlanSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function directPlaceTimeProblem(place) {
    if (place.hoursStatus === 'closed') return `${place.name || 'This place'} is closed on ${formatDate(place.visitDate)}. Choose another day.`
    if (!place.plannedStart || !place.open || !place.close) return ''
    const start = clockToMinutes(place.plannedStart)
    const open = clockToMinutes(place.open)
    let close = clockToMinutes(place.close)
    if (close === 0 && open > 0) close = 24 * 60
    if (close <= open) close += 24 * 60
    const end = start + Number(place.duration || 60)
    if (start < open) return `${place.name || 'This place'} opens at ${place.open}. Your planned start is too early.`
    if (end > close) return `${place.name || 'This place'} closes at ${place.close}. A ${place.duration || 60}-minute visit starting at ${place.plannedStart} would finish after closing.`
    return ''
  }

  function updateTripField(field, value) {
    setData((prev) => ({ ...prev, trip: { ...prev.trip, [field]: value } }))
  }

  function updateTravelWindow(field, value) {
    setData((prev) => {
      const endpoint = field === 'startDate' ? 'arrival' : 'departure'
      return {
        ...prev,
        trip: {
          ...prev.trip,
          [field]: value,
          [endpoint]: { ...prev.trip[endpoint], date: value },
        },
      }
    })
  }

  function updateEndpoint(section, patch) {
    setData((prev) => {
      const nextEndpoint = { ...prev.trip[section], ...patch }
      const linkedField = section === 'arrival' ? 'startDate' : 'endDate'
      return {
        ...prev,
        trip: {
          ...prev.trip,
          [linkedField]: patch.date ?? prev.trip[linkedField],
          [section]: nextEndpoint,
        },
      }
    })
  }

  function mapEndpoint(section, place) {
    updateEndpoint(section, {
      location: place.name,
      address: place.address,
      googlePlaceId: place.googlePlaceId,
      latitude: place.latitude,
      longitude: place.longitude,
      googleMapsURI: place.googleMapsURI,
      websiteURI: place.websiteURI,
      utcOffsetMinutes: place.utcOffsetMinutes,
      source: 'google',
    })
  }

  function addHotel() {
    setData((prev) => ({
      ...prev,
      trip: { ...prev.trip, hotels: [...(prev.trip.hotels || []), createBlankHotel(prev.trip.startDate, prev.trip.endDate)] },
    }))
  }

  function updateHotel(id, patch) {
    setData((prev) => ({
      ...prev,
      trip: { ...prev.trip, hotels: prev.trip.hotels.map((hotel) => hotel.id === id ? { ...hotel, ...patch } : hotel) },
    }))
  }

  function mapHotel(id, place) {
    updateHotel(id, {
      name: place.name, address: place.address, googlePlaceId: place.googlePlaceId,
      latitude: place.latitude, longitude: place.longitude, googleMapsURI: place.googleMapsURI,
      websiteURI: place.websiteURI, utcOffsetMinutes: place.utcOffsetMinutes, source: 'google',
    })
  }

  function deleteHotel(id) {
    setData((prev) => ({ ...prev, trip: { ...prev.trip, hotels: prev.trip.hotels.filter((hotel) => hotel.id !== id) } }))
  }

  function selectGooglePlace(place) {
    setPlaceFormError('')
    setSelectedGooglePlace(place)
    setPlaceForm((prev) => {
      const visitDate = prev.visitDate || data.trip.startDate
      const hours = hoursForDate(place.regularOpeningHours, visitDate)
      return {
        ...prev,
        name: place.name,
        category: inferPlaceCategory(place.primaryType, place.types),
        open: hours.status === 'open' ? hours.open : '',
        close: hours.status === 'open' ? hours.close : '',
        visitDate,
        address: place.address,
        googlePlaceId: place.googlePlaceId,
        latitude: place.latitude,
        longitude: place.longitude,
        googleMapsURI: place.googleMapsURI,
        websiteURI: place.websiteURI,
        primaryType: place.primaryType,
        primaryTypeDisplayName: place.primaryTypeDisplayName,
        regularOpeningHours: place.regularOpeningHours,
        currentOpeningHours: place.currentOpeningHours,
        utcOffsetMinutes: place.utcOffsetMinutes,
        hoursSummary: hours.summary,
        hoursStatus: hours.status,
        source: 'google',
      }
    })
  }

  function changeVisitDate(value) {
    setPlaceFormError('')
    setPlaceForm((prev) => {
      const hours = selectedGooglePlace ? hoursForDate(selectedGooglePlace.regularOpeningHours, value) : null
      return {
        ...prev,
        visitDate: value,
        ...(hours ? {
          open: hours.status === 'open' ? hours.open : (hours.status === 'unavailable' ? prev.open : ''),
          close: hours.status === 'open' ? hours.close : (hours.status === 'unavailable' ? prev.close : ''),
          hoursSummary: hours.summary,
          hoursStatus: hours.status,
        } : {}),
      }
    })
  }

  function closePlaceForm() {
    setShowPlaceForm(false)
    setEditingPlaceId(null)
    setSelectedGooglePlace(null)
    setPlaceForm(createBlankPlaceForm(data.trip.startDate))
    setPlaceFormError('')
  }

  function editPlace(place) {
    setEditingPlaceId(place.id)
    setPlaceForm({ ...createBlankPlaceForm(place.visitDate || data.trip.startDate), ...place })
    setSelectedGooglePlace(place.source === 'google' ? place : null)
    setPlaceFormError('')
    setShowPlaceForm(true)
    requestAnimationFrame(() => document.querySelector('.place-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function addPlace(event) {
    event.preventDefault()
    if (!placeForm.name.trim() || !placeForm.visitDate) return
    const normalizedPlace = {
      ...placeForm,
      name: placeForm.name.trim(),
      duration: Number(placeForm.duration),
      hoursSummary: placeForm.hoursStatus === 'manual'
        ? `Manual: ${placeForm.open || '?'} — ${placeForm.close || '?'}`
        : placeForm.hoursSummary,
    }
    const directProblem = directPlaceTimeProblem(normalizedPlace)
    if (directProblem) {
      setPlaceFormError(directProblem)
      window.alert(directProblem)
      return
    }

    const candidateId = editingPlaceId || `candidate-${Date.now()}`
    let candidate = { ...normalizedPlace, id: candidateId }
    let candidatePlaces = editingPlaceId
      ? data.places.map((place) => place.id === editingPlaceId ? candidate : place)
      : [...data.places, candidate]
    let candidateData = { ...data, places: candidatePlaces }

    try {
      const schedule = smartPlaceSchedule(candidateData, candidate.visitDate).get(candidateId)
      if (schedule?.scheduleWarning) {
        const nextDay = findNextAvailableDay(candidateData, candidateId, candidate.visitDate)
        if (nextDay) {
          const move = window.confirm(`${schedule.scheduleWarning}\n\nSuggested alternative: move ${candidate.name} to ${formatDate(nextDay.date)} around ${nextDay.start}.\n\nMove it to that day?`)
          if (!move) {
            setPlaceFormError(`${schedule.scheduleWarning} Suggested next day: ${formatDate(nextDay.date)} around ${nextDay.start}.`)
            return
          }
          candidate = { ...placeWithDateHours(candidate, nextDay.date), plannedStart: '', suggestedStart: nextDay.start, timeSource: 'suggested' }
          candidatePlaces = editingPlaceId
            ? data.places.map((place) => place.id === editingPlaceId ? candidate : place)
            : [...data.places, candidate]
          candidateData = { ...data, places: candidatePlaces }
        } else {
          const message = `${schedule.scheduleWarning} No later trip day currently has enough room for this stop.`
          setPlaceFormError(message)
          window.alert(message)
          return
        }
      } else if (candidate.timeSource !== 'manual') {
        candidate = { ...candidate, suggestedStart: schedule?.start || '', plannedStart: '', timeSource: 'suggested' }
      }
    } catch (error) {
      console.warn('Place feasibility check skipped:', error)
    }

    setData((prev) => {
      const nextData = {
        ...prev,
        places: editingPlaceId
          ? prev.places.map((place) => place.id === editingPlaceId ? { ...place, ...candidate, id: editingPlaceId } : place)
          : [...prev.places, { ...candidate, id: Date.now() }],
      }
      return applyAllSmartSuggestions(nextData)
    })
    closePlaceForm()
  }

  function deletePlace(id) {
    setData((prev) => {
      const nextProgress = { ...(prev.progress || {}) }
      delete nextProgress[`place-${id}`]
      return { ...prev, places: prev.places.filter((place) => place.id !== id), progress: nextProgress }
    })
  }

  const tripDatesForPlaces = enumerateDates(data.trip.startDate, data.trip.endDate)
  const visiblePlaces = [...data.places]
    .filter((place) => placeDateFilter === 'all' || place.visitDate === placeDateFilter)
    .sort((a, b) => `${a.visitDate || ''}-${a.plannedStart || a.suggestedStart || '99:99'}`.localeCompare(`${b.visitDate || ''}-${b.plannedStart || b.suggestedStart || '99:99'}`))

  useEffect(() => {
    if (placeDateFilter !== 'all' && !tripDatesForPlaces.includes(placeDateFilter)) setPlaceDateFilter('all')
  }, [placeDateFilter, data.trip.startDate, data.trip.endDate])

  const placeDayHours = selectedGooglePlace ? hoursForDate(selectedGooglePlace.regularOpeningHours, placeForm.visitDate) : { status: placeForm.hoursStatus || 'unavailable' }
  const hoursAreGoogleLocked = placeForm.source === 'google' && placeDayHours.status === 'open'
  const placeIsClosed = placeForm.source === 'google' && placeDayHours.status === 'closed'
  const directTimeProblem = directPlaceTimeProblem({ ...placeForm, hoursStatus: placeDayHours.status || placeForm.hoursStatus })
  const firstHotel = firstHotelForArrival(data.trip.hotels)
  const transferReady = isMapped(data.trip.arrival) && isMapped(firstHotel)

  return (
    <section className="page-section plan-editor-page">
      <div className="hero-card">
        <div>
          <span className="eyebrow">PLAN YOUR TRIP</span>
          <h2>Build the travel details first, then let Today turn them into a usable day plan.</h2>
          <p>Use the section bar to jump between travel dates, flights, stays or home base, places, and transportation.</p>
        </div>
        <div className="hero-icon"><Sparkles size={30} /></div>
      </div>

      <nav className="plan-section-nav" aria-label="Plan sections">
        <button type="button" onClick={() => scrollToPlanSection('plan-travel')}><MapPin size={15} /><span>Travel</span></button>
        <button type="button" onClick={() => scrollToPlanSection('plan-flights')}><Plane size={15} /><span>Flights</span></button>
        <button type="button" onClick={() => scrollToPlanSection('plan-stays')}><BedDouble size={15} /><span>Stay / base</span></button>
        <button type="button" onClick={() => scrollToPlanSection('plan-transport')}><TrainFront size={15} /><span>Transportation</span></button>
        <button type="button" onClick={() => scrollToPlanSection('plan-places')}><MapIcon size={15} /><span>Places</span></button>
      </nav>

      <div id="plan-travel" className="plan-scroll-anchor" />
      <div className="section-heading"><div><span className="eyebrow">TRIP DETAILS</span><h3>Travel window</h3><p>These dates are linked to your arrival and departure below.</p></div></div>
      <div className="details-grid travel-window-grid">
        <EditableCard icon={MapPin} title="Destination">
          <label>City / Country<input value={data.trip.city} onChange={(e) => updateTripField('city', e.target.value)} /></label>
          <div className="two-column-fields">
            <label>Start<input type="date" value={data.trip.startDate} onChange={(e) => updateTravelWindow('startDate', e.target.value)} /></label>
            <label>End<input type="date" value={data.trip.endDate} onChange={(e) => updateTravelWindow('endDate', e.target.value)} /></label>
          </div>
        </EditableCard>
        <div className="card linked-window-card">
          <CalendarDays size={20} />
          <div><span className="eyebrow">TRIP DATES</span><strong>{formatDate(data.trip.startDate)} → {formatDate(data.trip.endDate)}</strong><p>These dates drive Today, place filters, daily budgets, hotel dates, and checklist planning.</p></div>
        </div>
      </div>

      <div id="plan-flights" className="plan-scroll-anchor" />
      <div className="section-heading section-heading-row"><div><span className="eyebrow">ARRIVAL & DEPARTURE</span><h3>Flight details</h3><p>Enter your flight details manually for now. Automatic flight lookup, delay tracking, gates, and live status are planned for a future update.</p></div><span className="coming-soon-pill">Automatic flight tracking · Coming soon</span></div>
      <div className="flight-grid">
        <TravelEndpointCard
          title="Arrival" value={data.trip.arrival} directionLabel="Coming from"
          onChange={(patch) => updateEndpoint('arrival', patch)}
          onPlaceSelect={(place) => mapEndpoint('arrival', place)}
        />
        <TravelEndpointCard
          title="Departure" value={data.trip.departure} directionLabel="Going to"
          onChange={(patch) => updateEndpoint('departure', patch)}
          onPlaceSelect={(place) => mapEndpoint('departure', place)}
        />
      </div>

      <div id="plan-stays" className="plan-scroll-anchor" />
      <div className="section-heading section-heading-row">
        <div><span className="eyebrow">STAY / HOME BASE · OPTIONAL</span><h3>Where are you staying?</h3><p>Add a hotel, hostel, Airbnb, relative's house, or simply an address. Skip this section if you do not need a stay/base for routing.</p></div>
        <button className="primary-button" onClick={addHotel}><Plus size={17} /> Add stay / address</button>
      </div>

      <div className="hotel-list">
        {data.trip.hotels.map((hotel, index) => (
          <div className="card hotel-card" key={hotel.id}>
            <div className="hotel-card-header">
              <div><div className="card-icon"><Hotel size={18} /></div><div><span className="eyebrow">STAY / BASE {index + 1}</span><strong>{hotel.name || 'Add a stay or address'}</strong></div></div>
              <button className="icon-button danger" title="Remove hotel" onClick={() => deleteHotel(hotel.id)}><Trash2 size={17} /></button>
            </div>
            <GooglePlacePicker compact title="Find stay or address on Google Maps" placeholder="Hotel, Airbnb, house, street address…" onSelect={(place) => mapHotel(hotel.id, place)} />
            <MappedLocationSummary value={hotel} emptyText="Optional: search above to map this stay/base for routing" />
            <div className="hotel-fields">
              <label>Stay / base name<input placeholder="Hotel, friend's house, apartment…" value={hotel.name} onChange={(e) => updateHotel(hotel.id, { name: e.target.value })} /></label>
              <label className="hotel-address-field">Address<input placeholder="Optional manual address" value={hotel.address || ''} onChange={(e) => updateHotel(hotel.id, { address: e.target.value, source: hotel.googlePlaceId ? hotel.source : 'manual' })} /></label>
              <label>Check-in date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={hotel.checkInDate || ''} onChange={(e) => updateHotel(hotel.id, { checkInDate: e.target.value })} /></label>
              <label>Check-in time<input type="time" value={hotel.checkIn || ''} onChange={(e) => updateHotel(hotel.id, { checkIn: e.target.value })} /></label>
              <label>Check-out date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={hotel.checkOutDate || ''} onChange={(e) => updateHotel(hotel.id, { checkOutDate: e.target.value })} /></label>
              <label>Check-out time<input type="time" value={hotel.checkOut || ''} onChange={(e) => updateHotel(hotel.id, { checkOut: e.target.value })} /></label>
            </div>
          </div>
        ))}
      </div>

      <div id="plan-transport" className={`card transfer-ready-card plan-scroll-anchor ${transferReady ? 'ready' : ''}`}>
        <div className="transfer-icon"><TrainFront size={22} /></div>
        <div className="transfer-copy">
          <span className="eyebrow">ARRIVAL → FIRST STAY / BASE</span>
          <strong>{transferReady ? `${data.trip.arrival.location || data.trip.arrival.arrIata || 'Arrival point'} → ${firstHotel.name}` : 'Optional: add and map your first stay/base for airport transfer recommendations.'}</strong>
          <p>{transferReady ? 'Compare walking, bus, train/MRT, and driving in one compact view. Transit options show the boarding stop, line, next service time, and destination stop when available.' : 'If you add a mapped stay/base, the app can calculate the transfer. Skip this if you do not need accommodation routing.'}</p>
        </div>
        {transferReady && (
          <div className="transfer-route-full">
            <InAppRouteRecommendations
              origin={data.trip.arrival}
              destination={firstHotel}
              date={data.trip.arrival.date}
              time={data.trip.arrival.time}
              utcOffsetMinutes={data.trip.arrival.utcOffsetMinutes ?? firstHotel.utcOffsetMinutes}
              bufferMinutes={data.trip.arrival.transferBufferMinutes || 0}
            />
          </div>
        )}
      </div>

      <div id="plan-places" className="plan-scroll-anchor" />
      <div className="section-heading section-heading-row places-heading-row">
        <div><span className="eyebrow">PLACES</span><h3>Places you want to visit</h3><p>Edit saved places, filter by trip day, and leave the time blank when you want Today to build a smart schedule.</p></div>
        <div className="places-heading-actions">
          <label className="place-date-filter"><CalendarDays size={15} /><select value={placeDateFilter} onChange={(e) => setPlaceDateFilter(e.target.value)}><option value="all">All dates</option>{tripDatesForPlaces.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</select></label>
          <button className="primary-button" onClick={() => { if (showPlaceForm && !editingPlaceId) closePlaceForm(); else { setEditingPlaceId(null); setSelectedGooglePlace(null); setPlaceForm(createBlankPlaceForm(data.trip.startDate)); setShowPlaceForm(true) } }}><Plus size={17} /> Add place</button>
        </div>
      </div>

      {showPlaceForm && (
        <form className="inline-form place-form card" onSubmit={addPlace}>
          <div className="form-full-width edit-place-form-title"><div><span className="eyebrow">{editingPlaceId ? 'EDIT PLACE' : 'ADD PLACE'}</span><strong>{editingPlaceId ? 'Update this stop' : 'Add a new stop'}</strong></div>{editingPlaceId && <button type="button" className="ghost-button" onClick={closePlaceForm}>Cancel edit</button>}</div>
          <div className="form-full-width"><GooglePlacePicker onSelect={selectGooglePlace} placeholder="Search Google Maps — e.g. Taipei 101" /></div>
          {!googleConfigured && <div className="form-full-width google-setup-warning">The app cannot see a Google demo key yet. Confirm <strong>.env.local</strong> contains <strong>VITE_GOOGLE_MAPS_API_KEY</strong>, then restart Vite.</div>}
          {selectedGooglePlace && (
            <div className="selected-place-preview form-full-width">
              <div className="selected-place-heading"><div className="place-pin"><MapPin size={19} /></div><div><span className="eyebrow">SELECTED FROM GOOGLE MAPS</span><strong>{selectedGooglePlace.name}</strong><span>{selectedGooglePlace.address || 'Address unavailable'}</span></div></div>
              <div className="selected-place-meta">
                <span><Clock3 size={14} />{hoursForDate(selectedGooglePlace.regularOpeningHours, placeForm.visitDate).summary}</span>
                {selectedGooglePlace.primaryTypeDisplayName && <span>{selectedGooglePlace.primaryTypeDisplayName}</span>}
                {selectedGooglePlace.googleMapsURI && <a href={selectedGooglePlace.googleMapsURI} target="_blank" rel="noreferrer">Open in Google Maps <ExternalLink size={13} /></a>}
              </div>
            </div>
          )}
          <label className="form-span-2">Place name<input placeholder="Search above or type manually" value={placeForm.name} onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })} /></label>
          <label className="form-span-2">Address<input placeholder="Filled automatically when available" value={placeForm.address} onChange={(e) => setPlaceForm({ ...placeForm, address: e.target.value })} /></label>
          <label>Visit date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={placeForm.visitDate} onChange={(e) => changeVisitDate(e.target.value)} /></label>
          <label>Planned start <span className="optional-field-note">Optional</span><input className={(placeIsClosed || directTimeProblem) ? 'invalid-time-input' : ''} type="time" value={placeForm.plannedStart} onChange={(e) => { setPlaceFormError(''); setPlaceForm({ ...placeForm, plannedStart: e.target.value, timeSource: e.target.value ? 'manual' : 'suggested' }) }} /><small className="field-help">Leave blank and Today will suggest a time based on distance and closing hours.</small></label>
          <label>Category<select value={placeForm.category} onChange={(e) => setPlaceForm({ ...placeForm, category: e.target.value })}><option>Attraction</option><option>Shopping</option><option>Food</option><option>Nature</option><option>Hotel</option><option>Transport</option></select></label>
          <label>Priority<select value={placeForm.priority} onChange={(e) => setPlaceForm({ ...placeForm, priority: e.target.value })}><option>Must Visit</option><option>High</option><option>Optional</option></select></label>
          <label>Visit duration (min)<input type="number" min="15" step="15" value={placeForm.duration} onChange={(e) => setPlaceForm({ ...placeForm, duration: e.target.value })} /></label>
          <label>Opens {hoursAreGoogleLocked ? '(Google)' : '(manual if unavailable)'}<input className={hoursAreGoogleLocked ? 'locked-google-time' : ''} type="time" value={placeForm.open || ''} readOnly={hoursAreGoogleLocked || placeIsClosed} disabled={hoursAreGoogleLocked || placeIsClosed} onChange={(e) => setPlaceForm({ ...placeForm, open: e.target.value, hoursStatus: 'manual', hoursSummary: 'Manual hours' })} /></label>
          <label>Closes {hoursAreGoogleLocked ? '(Google)' : '(manual if unavailable)'}<input className={hoursAreGoogleLocked ? 'locked-google-time' : ''} type="time" value={placeForm.close || ''} readOnly={hoursAreGoogleLocked || placeIsClosed} disabled={hoursAreGoogleLocked || placeIsClosed} onChange={(e) => setPlaceForm({ ...placeForm, close: e.target.value, hoursStatus: 'manual', hoursSummary: 'Manual hours' })} /></label>
          {placeForm.hoursSummary && <div className={`google-hours-note form-span-2 ${placeIsClosed ? 'closed-day' : ''}`}><Clock3 size={15} /><span>{placeForm.source === 'google' ? 'Google schedule' : 'Schedule'} for {formatDate(placeForm.visitDate)}: <strong>{placeForm.hoursSummary}</strong>{placeIsClosed && <em>Choose another day — this place cannot be added to this day's itinerary.</em>}</span></div>}
          {(placeFormError || directTimeProblem) && <div className="place-schedule-error form-full-width"><Clock3 size={16} /><div><strong>This stop cannot be added yet</strong><span>{placeFormError || directTimeProblem}</span></div></div>}
          <div className="form-actions"><button type="button" className="ghost-button" onClick={closePlaceForm}>Cancel</button><button type="submit" className="primary-button" disabled={placeIsClosed || Boolean(directTimeProblem)}>{editingPlaceId ? 'Update & sync to Today' : 'Save & sync to Today'}</button></div>
        </form>
      )}

      <div className="places-list">
        {visiblePlaces.map((place) => (
          <article className="place-row" key={place.id}>
            <div className="place-pin"><MapPin size={19} /></div>
            <div className="place-main">
              <div className="place-title-row"><strong>{place.name}</strong><PriorityPill priority={place.priority} />{place.source === 'google' && <span className="google-source-pill">Google Maps</span>}</div>
              <span>{place.category} · {place.duration} min · {formatDate(place.visitDate)}{place.timeSource === 'manual' && place.plannedStart ? ` at ${place.plannedStart}` : place.suggestedStart ? ` · Suggested ${place.suggestedStart}` : ' · Smart time pending'}</span>
              {place.address && <small className="place-address">{place.address}</small>}
            </div>
            <div className={`place-hours ${place.hoursStatus === 'closed' ? 'closed-day' : ''}`}><Clock3 size={15} /> {place.hoursSummary || `${place.open} — ${place.close}`}</div>
            <div className="place-actions">
              <button className="icon-button" title="Edit place" onClick={() => editPlace(place)}><Pencil size={16} /></button>
              {place.googleMapsURI && <a className="icon-button" title="Open in Google Maps" href={place.googleMapsURI} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}
              <button className="icon-button danger" title="Delete place" onClick={() => deletePlace(place.id)}><Trash2 size={17} /></button>
            </div>
          </article>
        ))}
        {!visiblePlaces.length && <div className="empty-place-filter">No places scheduled for this date yet.</div>}
      </div>

      <div className="integration-note"><TrainFront size={21} /><div><strong>Dual transit routing is ready</strong><span>BusMaps official GTFS is the primary public-transit source. Your OpenTripPlanner + GTFS server fills missing bus, rail/MRT and ferry routes. Walk and drive are lightweight estimates with map links, so no paid routing API is required.</span></div><ChevronRight size={19} /></div>
    </section>
  )
}

function TravelEndpointCard({ title, value, directionLabel, onChange, onPlaceSelect }) {
  const isArrival = title === 'Arrival'
  const directionField = isArrival ? 'from' : 'to'
  const timeLabel = isArrival ? 'Arrival time' : 'Departure time'

  return (
    <div className="card flight-card manual-flight-card">
      <div className="flight-card-header">
        <div className="card-icon"><Plane size={18} /></div>
        <div><span className="eyebrow">{title.toUpperCase()} FLIGHT</span><strong>{value.flightNumber || `${title} details`}</strong></div>
        <span className="coming-soon-pill small">Live tracking · Coming soon</span>
      </div>

      <div className="manual-flight-grid">
        <label>Flight number<input placeholder="Example: 5J312" value={value.flightNumber || ''} onChange={(e) => onChange({ flightNumber: e.target.value.toUpperCase() })} /></label>
        <label>Airline<input placeholder="Example: Cebu Pacific" value={value.airline || ''} onChange={(e) => onChange({ airline: e.target.value })} /></label>
        <label>{directionLabel}<input placeholder={isArrival ? 'Example: Manila' : 'Example: Manila'} value={value[directionField] || ''} onChange={(e) => onChange({ [directionField]: e.target.value })} /></label>
        <AirportLocationField title={title} value={value} onChange={onChange} onPlaceSelect={onPlaceSelect} />
        <label>{timeLabel}<input type="time" value={value.time || ''} onChange={(e) => onChange({ time: e.target.value })} /></label>
        <label>Terminal<input placeholder="Optional" value={value.terminal || ''} onChange={(e) => onChange({ terminal: e.target.value })} /></label>
        <label>Gate<input placeholder="Optional" value={value.gate || ''} onChange={(e) => onChange({ gate: e.target.value })} /></label>
        {isArrival && <label>Baggage belt<input placeholder="Optional" value={value.baggage || ''} onChange={(e) => onChange({ baggage: e.target.value })} /></label>}
      </div>

      <div className="flight-auto-date-note"><CalendarDays size={13} /><span>Linked to your trip {isArrival ? 'start' : 'end'} date: <strong>{formatDate(value.date)}</strong></span></div>

      {isArrival && <label className="flight-buffer-field">Airport / arrival buffer (min)<input type="number" min="0" step="15" value={value.transferBufferMinutes ?? 60} onChange={(e) => onChange({ transferBufferMinutes: Number(e.target.value) })} /></label>}

      <div className="flight-coming-soon"><Sparkles size={15} /><div><strong>Future flight intelligence</strong><span>Automatic flight lookup, live delay/status, terminal and gate updates, and itinerary recalculation are coming later.</span></div></div>
    </div>
  )
}

function buildBasicDayItems(data, date) {
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
      detail: arrival.address || 'Arrival location', mapUri: arrival.googleMapsURI || '', locationData: arrival, sort: arrival.time || '00:00',
    })
  }

  if (startPreference === 'stay' && isMapped(stay)) {
    items.push({ key: `day-start-stay-${date}`, kind: 'start', start: '09:00', end: '', title: `Start · ${stay.name || 'Stay/base'}`, subtitle: stay.address || 'Stay/base', detail: 'Your day starts here', mapUri: stay.googleMapsURI || '', locationData: stay, sort: '00:01' })
  }

  ;(trip.hotels || []).forEach((hotel) => {
    if (hotel.checkInDate === date && startPreference !== 'stay') items.push({ key: `hotel-checkin-${hotel.id}`, kind: 'hotel', start: hotel.checkIn || '15:00', end: '', title: `Stay check-in · ${hotel.name || 'Accommodation'}`, subtitle: hotel.address || 'Accommodation', detail: 'Check-in', mapUri: hotel.googleMapsURI || '', locationData: hotel, sort: hotel.checkIn || '15:00' })
    if (hotel.checkOutDate === date) items.push({ key: `hotel-checkout-${hotel.id}`, kind: 'hotel', start: hotel.checkOut || '11:00', end: '', title: `Stay check-out · ${hotel.name || 'Accommodation'}`, subtitle: hotel.address || 'Accommodation', detail: 'Check-out', mapUri: hotel.googleMapsURI || '', locationData: hotel, sort: hotel.checkOut || '11:00' })
  })

  ;(data?.places || []).filter((place) => place.visitDate === date).forEach((place) => {
    const start = (place.timeSource === 'manual' ? place.plannedStart : (place.suggestedStart || place.plannedStart)) || ''
    items.push({ key: `place-${place.id}`, kind: 'place', start, end: start ? addMinutes(start, place.duration) : '', title: place.name || 'Place', subtitle: `${place.category || 'Place'} · ${place.duration || 60} min${place.priority ? ` · ${place.priority}` : ''}`, detail: place.hoursSummary || 'Hours unavailable', mapUri: place.googleMapsURI || '', locationData: place, sort: start || '98:59', suggestedTime: false, scheduleWarning: '' })
  })

  if (arrangement.endMode === 'stay' && isMapped(stay) && (data?.places || []).some((place) => place.visitDate === date)) {
    items.push({ key: `return-stay-${date}`, kind: 'return', start: '', end: '', title: `Return · ${stay.name || 'Stay/base'}`, subtitle: stay.address || 'Stay/base', detail: 'Preferred end point for this day', mapUri: stay.googleMapsURI || '', locationData: stay, sort: '98:58' })
  }

  if (departure.date === date) {
    items.push({ key: 'departure', kind: 'departure', start: departure.time || '', end: '', title: `Depart · ${departure.location || 'Departure point'}`, subtitle: `${transportDescriptor(departure)}${departure.to ? ` · to ${departure.to}` : ''}`, detail: departure.address || 'Departure location', mapUri: departure.googleMapsURI || '', locationData: departure, sort: departure.time || '99:00' })
  }

  return items.sort((a, b) => String(a.sort || '').localeCompare(String(b.sort || '')))
}

function TodayView({ data, setData }) {
  const dates = useMemo(() => enumerateDates(data.trip.startDate, data.trip.endDate), [data.trip.startDate, data.trip.endDate])
  const [selectedDate, setSelectedDate] = useState(() => data.trip.startDate)
  const [editingTimeKey, setEditingTimeKey] = useState('')
  const [editingTimeValue, setEditingTimeValue] = useState('')
  const [timeEditError, setTimeEditError] = useState('')
  const [showArrangePanel, setShowArrangePanel] = useState(false)
  const [arrangeDraft, setArrangeDraft] = useState(() => dayArrangementPreference(data, data.trip.startDate))

  useEffect(() => {
    if (!dates.includes(selectedDate)) setSelectedDate(dates[0] || data.trip.startDate)
  }, [dates, selectedDate, data.trip.startDate])

  useEffect(() => {
    setArrangeDraft(dayArrangementPreference(data, selectedDate))
  }, [selectedDate, data.trip.dayArrangementPreferences])

  const dayPlan = useMemo(() => {
    try {
      return { items: buildDayItems(data, selectedDate), error: '' }
    } catch (error) {
      console.error('Smart Today schedule failed; using basic itinerary fallback.', error)
      return { items: buildBasicDayItems(data, selectedDate), error: error?.message || 'Smart scheduling could not be calculated.' }
    }
  }, [data, selectedDate])
  const items = dayPlan.items
  const progress = data.progress || {}
  const nextItem = items.find((item) => !['done', 'skipped'].includes(progress[item.key]))
  const doneCount = items.filter((item) => progress[item.key] === 'done').length
  const suggestedCount = items.filter((item) => item.suggestedTime && item.start).length
  const scheduleWarningCount = items.filter((item) => item.scheduleWarning).length
  const firstHotel = firstHotelForArrival(data.trip.hotels)
  const selectedStay = hotelForDate(data.trip.hotels || [], selectedDate) || firstHotel
  const selectedDayStart = dayStartPreference(data, selectedDate)
  const activeArrangement = dayArrangementPreference(data, selectedDate)
  const isArrivalDay = selectedDate === data.trip.arrival.date && Boolean(data.trip.arrival.time)
  const arrivalTransferReady = selectedDate === data.trip.arrival.date && selectedDayStart === 'arrival_stay' && isMapped(data.trip.arrival) && isMapped(firstHotel)

  function updateDayStartPreference(mode) {
    setData((prev) => {
      const next = {
        ...prev,
        trip: {
          ...prev.trip,
          dayStartPreferences: {
            ...(prev.trip.dayStartPreferences || {}),
            [selectedDate]: mode,
          },
        },
      }
      return applySmartSuggestionsForDate(next, selectedDate)
    })
    setTimeEditError('')
  }

  function applyArrangement() {
    setData((prev) => {
      const next = {
        ...prev,
        trip: {
          ...prev.trip,
          dayArrangementPreferences: {
            ...(prev.trip.dayArrangementPreferences || {}),
            [selectedDate]: { ...arrangeDraft },
          },
        },
      }
      return applySmartSuggestionsForDate(next, selectedDate)
    })
    setShowArrangePanel(false)
    setTimeEditError('')
  }

  function movePlaceToDay(item, suggestion) {
    if (!suggestion || item.kind !== 'place') return
    const placeId = String(item.key).replace(/^place-/, '')
    setData((prev) => {
      const next = {
        ...prev,
        places: (prev.places || []).map((place) => String(place.id) === placeId
          ? { ...placeWithDateHours(place, suggestion.date), plannedStart: '', suggestedStart: suggestion.start || '', timeSource: 'suggested' }
          : place),
      }
      return applyAllSmartSuggestions(next)
    })
    setTimeEditError('')
  }

  function itemStatus(item) {
    const stored = progress[item.key]
    if (stored === 'done' || stored === 'skipped') return stored
    return nextItem?.key === item.key ? 'current' : 'upcoming'
  }

  function setStatus(key, status) {
    setData((prev) => ({ ...prev, progress: { ...(prev.progress || {}), [key]: status } }))
  }

  function undoStatus(key) {
    setData((prev) => {
      const nextProgress = { ...(prev.progress || {}) }
      delete nextProgress[key]
      return { ...prev, progress: nextProgress }
    })
  }

  function beginTimeEdit(item) {
    if (item.kind !== 'place') return
    setEditingTimeKey(item.key)
    setEditingTimeValue(item.start || '')
    setTimeEditError('')
  }

  function saveTimeEdit(item) {
    if (item.kind !== 'place') return
    const placeId = String(item.key).replace(/^place-/, '')
    const place = (data.places || []).find((entry) => String(entry.id) === placeId)
    if (!place) return
    const smartCandidateData = {
      ...data,
      places: (data.places || []).map((entry) => String(entry.id) === placeId
        ? { ...entry, plannedStart: '', suggestedStart: '', timeSource: 'suggested' }
        : entry),
    }
    const nextDayOption = findNextAvailableDay(smartCandidateData, place.id, selectedDate)
    const withNextDay = (message) => nextDayOption
      ? `${message} Suggested alternative: ${formatDate(nextDayOption.date)} around ${nextDayOption.start}.`
      : message

    if (editingTimeValue) {
      const start = clockToMinutes(editingTimeValue)
      const open = clockToMinutes(place.open)
      let close = clockToMinutes(place.close)
      const duration = Number(place.duration || 60)
      if (place.hoursStatus === 'closed') {
        setTimeEditError(withNextDay(`${place.name} is closed on ${formatDate(place.visitDate)}.`))
        return
      }
      if (start != null && open != null && start < open) {
        setTimeEditError(withNextDay(`${place.name} opens at ${place.open}. Choose a later time.`))
        return
      }
      if (start != null && close != null) {
        if (close === 0 && Number(open) > 0) close = 24 * 60
        if (open != null && close <= open) close += 24 * 60
        if (start + duration > close) {
          setTimeEditError(withNextDay(`${place.name} closes at ${place.close}. This ${duration}-minute visit would end after closing.`))
          return
        }
      }
    }

    setData((prev) => ({
      ...prev,
      places: (prev.places || []).map((entry) => String(entry.id) === placeId
        ? { ...entry, plannedStart: editingTimeValue || '', suggestedStart: editingTimeValue ? '' : entry.suggestedStart || '', timeSource: editingTimeValue ? 'manual' : 'suggested' }
        : entry),
    }))
    setEditingTimeKey('')
    setEditingTimeValue('')
    setTimeEditError('')
  }

  function useSmartTime(item) {
    if (item.kind !== 'place') return
    const placeId = String(item.key).replace(/^place-/, '')
    const target = (data.places || []).find((entry) => String(entry.id) === placeId)
    if (!target) return

    const candidateData = {
      ...data,
      places: (data.places || []).map((entry) => String(entry.id) === placeId
        ? { ...entry, plannedStart: '', suggestedStart: '', timeSource: 'suggested' }
        : entry),
    }

    try {
      const suggestion = smartPlaceSchedule(candidateData, target.visitDate).get(target.id)
      if (!suggestion?.start) {
        const nextDay = findNextAvailableDay(candidateData, target.id, target.visitDate)
        const baseMessage = suggestion?.scheduleWarning || `No smart time fits ${target.name || 'this stop'} on ${formatDate(target.visitDate)}.`
        setTimeEditError(nextDay ? `${baseMessage} Suggested alternative: ${formatDate(nextDay.date)} around ${nextDay.start}.` : `${baseMessage} Try another day or change where the day starts.`)
        return
      }

      setData((prev) => applySmartSuggestionsForDate({
        ...prev,
        places: (prev.places || []).map((entry) => String(entry.id) === placeId
          ? { ...entry, plannedStart: '', suggestedStart: suggestion.start, timeSource: 'suggested' }
          : entry),
      }, target.visitDate))
      setEditingTimeKey('')
      setEditingTimeValue('')
      setTimeEditError('')
    } catch (error) {
      console.error('Smart time calculation failed:', error)
      setTimeEditError(error?.message || 'A smart time could not be calculated for this stop.')
    }
  }

  return (
    <section className="page-section">
      <div className="today-status-card">
        <div><span className="status-dot" /><div><span className="eyebrow">SYNCED DAY PLAN</span><h2>{formatDate(selectedDate)}</h2><p>{items.length ? `${doneCount} of ${items.length} items completed. Changes from Plan appear here automatically.` : 'Nothing scheduled for this day yet. Add a place or travel detail in Plan.'}</p></div></div>
        <button className="secondary-button"><AlarmClock size={17} /> Reminders later</button>
      </div>

      <div className="day-strip" aria-label="Trip days">
        {dates.map((date) => <button key={date} className={selectedDate === date ? 'active' : ''} onClick={() => setSelectedDate(date)}><span>{formatDayName(date)}</span><strong>{formatShortDate(date)}</strong></button>)}
      </div>

      <div className="day-start-card">
        <div>
          <span className="eyebrow">DAY START</span>
          <strong>Where are you starting from?</strong>
          <p>This changes the first transfer and the smart times for the rest of the day.</p>
        </div>
        <label>
          <span>Start this day from</span>
          <select value={selectedDayStart} onChange={(e) => updateDayStartPreference(e.target.value)}>
            {isArrivalDay && <option value="arrival_stay" disabled={!isMapped(selectedStay)}>Airport → stay/base → places</option>}
            {isArrivalDay && <option value="arrival_places">Airport → first destination</option>}
            <option value="stay" disabled={!isMapped(selectedStay)}>Stay/base → places</option>
            <option value="first_place">Start at first destination</option>
          </select>
        </label>
        <div className="day-start-summary">
          <MapPin size={15} />
          <span>
            <strong>{dayStartPreferenceLabel(selectedDayStart)}</strong>
            <small>{selectedDayStart === 'arrival_stay' && selectedStay ? `${data.trip.arrival.location || 'Arrival point'} → ${selectedStay.name || 'Stay/base'} → your first stop` : selectedDayStart === 'arrival_places' ? `${data.trip.arrival.location || 'Arrival point'} → your first stop` : selectedDayStart === 'stay' && selectedStay ? `${selectedStay.name || 'Stay/base'} → your first stop` : 'The first attraction becomes the starting point for the day.'}</small>
          </span>
        </div>
      </div>

      <div className="day-arrange-toolbar">
        <div>
          <span className="eyebrow">SMART ARRANGEMENT</span>
          <strong>{arrangementLabel(activeArrangement)}</strong>
          <p>Reorder suggested times by distance, closing time, and your preferred end point.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setShowArrangePanel((value) => !value)}><Sparkles size={16} /> Arrange day</button>
      </div>

      {showArrangePanel && (
        <div className="card arrange-day-panel">
          <label>Arrange by
            <select value={arrangeDraft.strategy} onChange={(e) => setArrangeDraft((prev) => ({ ...prev, strategy: e.target.value }))}>
              <option value="balanced">Balanced: distance + closing time</option>
              <option value="nearest">Nearest first</option>
              <option value="closing">Earlier closing first</option>
            </select>
          </label>
          <label>End the day near
            <select value={arrangeDraft.endMode} onChange={(e) => setArrangeDraft((prev) => ({ ...prev, endMode: e.target.value, endPlaceId: e.target.value === 'place' ? prev.endPlaceId : '' }))}>
              <option value="none">No special end point</option>
              {isMapped(selectedStay) && <option value="stay">Stay / home base</option>}
              <option value="shopping">A shopping stop</option>
              <option value="place">A specific place</option>
            </select>
          </label>
          {arrangeDraft.endMode === 'place' && (
            <label>Last place
              <select value={arrangeDraft.endPlaceId || ''} onChange={(e) => setArrangeDraft((prev) => ({ ...prev, endPlaceId: e.target.value }))}>
                <option value="">Choose a place</option>
                {(data.places || []).filter((place) => place.visitDate === selectedDate && place.hoursStatus !== 'closed').map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
            </label>
          )}
          <div className="arrange-day-actions">
            <button type="button" className="ghost-button" onClick={() => { setArrangeDraft(activeArrangement); setShowArrangePanel(false) }}>Cancel</button>
            <button type="button" className="primary-button" onClick={applyArrangement} disabled={arrangeDraft.endMode === 'place' && !arrangeDraft.endPlaceId}><Sparkles size={16} /> Apply suggested arrangement</button>
          </div>
        </div>
      )}

      {dayPlan.error && (
        <div className="today-recovery-banner">
          <Sparkles size={17} /><div><strong>Today recovered safely</strong><span>The smart scheduler hit an unexpected data issue, so the app is showing the basic itinerary instead of a white screen.</span></div>
        </div>
      )}

      {arrivalTransferReady && (
        <div className="card arrival-day-transfer">
          <div className="transfer-icon"><TrainFront size={22} /></div>
          <div><span className="eyebrow">FIRST TRANSFER</span><strong>{data.trip.arrival.location} → {firstHotel.name}</strong><p>Get the transfer recommendation here without leaving the app.</p></div>
          <div className="transfer-route-full">
            <InAppRouteRecommendations
              origin={data.trip.arrival}
              destination={firstHotel}
              date={data.trip.arrival.date}
              time={data.trip.arrival.time}
              utcOffsetMinutes={data.trip.arrival.utcOffsetMinutes ?? firstHotel.utcOffsetMinutes}
              bufferMinutes={data.trip.arrival.transferBufferMinutes || 0}
              compact
            />
          </div>
        </div>
      )}

      <div className="timeline-card card">
        <div className="section-heading"><div><span className="eyebrow">{formatDayName(selectedDate).toUpperCase()}</span><h3>Travel checklist</h3></div></div>
        {(suggestedCount > 0 || scheduleWarningCount > 0) && (
          <div className="smart-time-banner">
            <Sparkles size={18} />
            <div>
              <strong>Smart day timing is active</strong>
              <span>{suggestedCount ? `${suggestedCount} stop${suggestedCount === 1 ? '' : 's'} received suggested times based on opening/closing hours and nearby stops.` : 'Your fixed times are being checked against opening hours and travel order.'}{scheduleWarningCount ? ` ${scheduleWarningCount} stop${scheduleWarningCount === 1 ? '' : 's'} may not fit today.` : ''}</span>
            </div>
          </div>
        )}
        {timeEditError && <div className="place-schedule-error today-time-error"><Clock3 size={15} /><div><strong>That time won't fit</strong><span>{timeEditError}</span></div></div>}
        {items.length ? (
          <div className="timeline">
            {items.map((item, index) => {
              const status = itemStatus(item)
              const nextDaySuggestion = item.kind === 'place' && item.scheduleWarning
                ? findNextAvailableDay(data, String(item.key).replace(/^place-/, ''), selectedDate)
                : null
              return (
                <div className={`timeline-item ${status}`} key={item.key}>
                  <div className={`timeline-time ${item.scheduleWarning ? 'has-warning' : ''}`}>
                    {editingTimeKey === item.key ? (
                      <div className="timeline-time-editor">
                        <input type="time" value={editingTimeValue} onChange={(e) => { setEditingTimeValue(e.target.value); setTimeEditError('') }} />
                        <div>
                          <button type="button" className="mini-time-action" onClick={() => saveTimeEdit(item)}>Save</button>
                          <button type="button" className="mini-time-action muted" onClick={() => useSmartTime(item)}>Smart</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <strong>{item.start || '—'}</strong>
                        <span>{item.suggestedTime ? `Suggested${item.end ? ` · ${item.end}` : ''}` : (item.end || item.kind)}</span>
                        {item.kind === 'place' && <button type="button" className="timeline-edit-time" onClick={() => beginTimeEdit(item)}><Pencil size={12} /> Edit time</button>}
                      </>
                    )}
                  </div>
                  <div className="timeline-track"><div className="timeline-dot">{status === 'done' ? <Check size={14} /> : status === 'current' ? <Navigation size={13} /> : null}</div>{index < items.length - 1 && <div className="timeline-line" />}</div>
                  <div className="timeline-content">
                    <div className="timeline-title-row"><div><strong>{item.title}</strong><span>{item.subtitle}</span><small>{item.detail}</small></div><StatusPill status={status} /></div>
                    {item.scheduleWarning && nextDaySuggestion && (
                      <div className="timeline-move-suggestion">
                        <CalendarDays size={15} />
                        <div><strong>Better on {formatDate(nextDaySuggestion.date)}</strong><span>Suggested around {nextDaySuggestion.start}{nextDaySuggestion.end ? `–${nextDaySuggestion.end}` : ''} because it does not fit comfortably today.</span></div>
                        <button type="button" className="ghost-button" onClick={() => movePlaceToDay(item, nextDaySuggestion)}>Move</button>
                      </div>
                    )}
                    {status === 'current' && <div className="timeline-actions"><button className="primary-button" onClick={() => setStatus(item.key, 'done')}><CheckCircle2 size={17} /> Done</button><button className="ghost-button" onClick={() => setStatus(item.key, 'skipped')}>Skip</button>{item.mapUri && <a className="secondary-button" href={item.mapUri} target="_blank" rel="noreferrer"><Navigation size={17} /> Map</a>}</div>}
                    {(status === 'done' || status === 'skipped') && <div className="timeline-actions timeline-recovery-actions"><button className="ghost-button" onClick={() => undoStatus(item.key)}><RotateCcw size={15} /> {status === 'done' ? 'Undo done' : 'Undo skip'}</button>{item.mapUri && <a className="secondary-button" href={item.mapUri} target="_blank" rel="noreferrer"><Navigation size={15} /> Map</a>}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : <div className="empty-day"><CalendarDays size={25} /><strong>No plans yet</strong><span>Assign a visit date in Plan. If you leave the time blank, Today will suggest one automatically.</span></div>}
      </div>

      {items.filter((item) => isMapped(item.locationData)).length >= 2 && (
        <div className="card day-route-card">
          <div className="section-heading"><div><span className="eyebrow">BETWEEN STOPS</span><h3>Transport recommendations</h3><p>BusMaps official GTFS is checked first. OpenTripPlanner is used automatically when BusMaps cannot return that transit mode.</p></div></div>
          <div className="day-route-list">
            {items.slice(0, -1).map((item, index) => {
              const next = items[index + 1]
              if (!isMapped(item.locationData) || !isMapped(next.locationData)) return null
              return (
                <div className="day-route-leg" key={`${item.key}-${next.key}`}>
                  <div className="day-route-leg-title"><MapPin size={15} /><span><strong>{item.title}</strong><small>→ {next.title}</small></span></div>
                  <InAppRouteRecommendations
                    origin={item.locationData}
                    destination={next.locationData}
                    date={selectedDate}
                    time={item.end || item.start}
                    utcOffsetMinutes={item.locationData.utcOffsetMinutes ?? next.locationData.utcOffsetMinutes}
                    compact
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="smart-suggestion card"><div className="suggestion-icon"><Sparkles size={20} /></div><div><span className="eyebrow">SYNC IS LIVE</span><strong>Places no longer need to be manually copied into Today.</strong><p>When you add a place, change its visit date, map a hotel, or update your flight dates, the matching day is generated from the same trip data.</p></div></div>
    </section>
  )
}

function BudgetView({ data, setData, shoppingSpent, shoppingPlanned, totalSpent, remaining, expenseSpent }) {
  const tripDates = useMemo(() => enumerateDates(data.trip.startDate, data.trip.endDate), [data.trip.startDate, data.trip.endDate])
  const [selectedDate, setSelectedDate] = useState(() => data.trip.startDate || tripDates[0] || '')
  const [showShoppingForm, setShowShoppingForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [selectedShoppingLocation, setSelectedShoppingLocation] = useState('all')
  const [shoppingForm, setShoppingForm] = useState({ name: '', planned: 0, quantity: 1, priority: 'Want', purchaseDate: '', location: '' })
  const [expenseForm, setExpenseForm] = useState({ date: data.trip.startDate || '', category: 'Food', note: '', amount: 0 })
  const percentage = data.budget.total > 0 ? Math.min(100, Math.round((totalSpent / data.budget.total) * 100)) : 0
  const shoppingPercentage = data.budget.shopping > 0 ? Math.min(100, Math.round((shoppingSpent / data.budget.shopping) * 100)) : 0
  const defaultDailyTarget = tripDates.length ? Number(data.budget.total || 0) / tripDates.length : 0

  useEffect(() => {
    if (tripDates.length && !tripDates.includes(selectedDate)) setSelectedDate(tripDates[0])
  }, [tripDates, selectedDate])

  function updateBudget(field, value) {
    setData((prev) => ({ ...prev, budget: { ...prev.budget, [field]: Number(value) } }))
  }

  function updateDailyTarget(date, value) {
    setData((prev) => ({ ...prev, budget: { ...prev.budget, dailyTargets: { ...(prev.budget.dailyTargets || {}), [date]: Number(value) } } }))
  }

  function addExpense(event) {
    event.preventDefault()
    if (!expenseForm.date || !Number(expenseForm.amount)) return
    setData((prev) => ({ ...prev, expenses: [...(prev.expenses || []), { ...expenseForm, id: Date.now(), amount: Number(expenseForm.amount) }] }))
    setExpenseForm({ date: selectedDate || data.trip.startDate, category: 'Food', note: '', amount: 0 })
    setShowExpenseForm(false)
  }

  function deleteExpense(id) {
    setData((prev) => ({ ...prev, expenses: (prev.expenses || []).filter((item) => item.id !== id) }))
  }

  function addShopping(event) {
    event.preventDefault()
    if (!shoppingForm.name.trim()) return
    setData((prev) => ({ ...prev, shopping: [...prev.shopping, { ...shoppingForm, id: Date.now(), planned: Number(shoppingForm.planned), actual: 0, quantity: Number(shoppingForm.quantity), bought: false }] }))
    setShoppingForm({ name: '', planned: 0, quantity: 1, priority: 'Want', purchaseDate: '', location: '' })
    setShowShoppingForm(false)
  }

  function updateShopping(id, patch) {
    setData((prev) => ({ ...prev, shopping: prev.shopping.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  }

  function deleteShopping(id) {
    setData((prev) => ({ ...prev, shopping: prev.shopping.filter((item) => item.id !== id) }))
  }

  function spentOnDate(date) {
    const logged = (data.expenses || []).filter((item) => item.date === date).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const shopping = data.shopping.filter((item) => item.purchaseDate === date).reduce((sum, item) => sum + Number(item.actual || 0), 0)
    return logged + shopping
  }

  const selectedSpent = spentOnDate(selectedDate)
  const selectedTarget = Number(data.budget.dailyTargets?.[selectedDate] ?? defaultDailyTarget)
  const selectedRemaining = selectedTarget - selectedSpent
  const selectedExpenses = (data.expenses || []).filter((item) => item.date === selectedDate)
  const shoppingLocations = useMemo(() => [...new Set(data.shopping.map((item) => String(item.location || '').trim()).filter(Boolean))], [data.shopping])
  const hasUnassignedShopping = data.shopping.some((item) => !String(item.location || '').trim())
  const visibleShopping = data.shopping.filter((item) => {
    if (selectedShoppingLocation === 'all') return true
    if (selectedShoppingLocation === '__unassigned') return !String(item.location || '').trim()
    return String(item.location || '').trim() === selectedShoppingLocation
  })

  useEffect(() => {
    if (selectedShoppingLocation !== 'all' && selectedShoppingLocation !== '__unassigned' && !shoppingLocations.includes(selectedShoppingLocation)) setSelectedShoppingLocation('all')
    if (selectedShoppingLocation === '__unassigned' && !hasUnassignedShopping) setSelectedShoppingLocation('all')
  }, [selectedShoppingLocation, shoppingLocations, hasUnassignedShopping])

  return (
    <section className="page-section">
      <div className="section-heading"><div><span className="eyebrow">WHOLE STAY</span><h2>Trip budget</h2><p>See the whole-trip picture, then drill into each travel day.</p></div></div>
      <div className="budget-summary-grid">
        <BudgetMetric icon={CircleDollarSign} label="Trip budget" value={formatMoney(data.budget.total, data.trip.currency)} hint={`${percentage}% used`} />
        <BudgetMetric icon={WalletCards} label="Spent so far" value={formatMoney(totalSpent, data.trip.currency)} hint={`${formatMoney(expenseSpent, data.trip.currency)} logged by day`} />
        <BudgetMetric icon={Sparkles} label="Remaining" value={formatMoney(remaining, data.trip.currency)} hint={remaining >= 0 ? 'Still within budget' : 'Over budget'} positive={remaining >= 0} />
      </div>

      <div className="card budget-control-card">
        <div className="section-heading section-heading-row"><div><span className="eyebrow">BUDGET SETTINGS</span><h3>Whole-stay limits</h3></div></div>
        <div className="budget-fields budget-fields-with-currency">
          <label>Currency<select value={data.trip.currency || 'NT$'} onChange={(e) => setData((prev) => ({ ...prev, trip: { ...prev.trip, currency: e.target.value } }))}>{CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Total trip budget ({data.trip.currency})<input type="number" min="0" value={data.budget.total} onChange={(e) => updateBudget('total', e.target.value)} /></label>
          <label>Shopping budget ({data.trip.currency})<input type="number" min="0" value={data.budget.shopping} onChange={(e) => updateBudget('shopping', e.target.value)} /></label>
          <label>Unassigned / older spending ({data.trip.currency})<input type="number" min="0" value={data.budget.spentOther} onChange={(e) => updateBudget('spentOther', e.target.value)} /></label>
        </div>
        <ProgressBar value={percentage} label={`Whole stay · ${percentage}%`} />
      </div>

      <div className="section-heading section-heading-row"><div><span className="eyebrow">PER DAY</span><h3>Daily budget</h3><p>Default daily target is the total budget divided across {tripDates.length || 0} trip days. You can override each day.</p></div><button className="primary-button" onClick={() => { setExpenseForm((prev) => ({ ...prev, date: selectedDate })); setShowExpenseForm((value) => !value) }}><Plus size={17} /> Log expense</button></div>

      <div className="budget-day-strip">
        {tripDates.map((date) => {
          const spent = spentOnDate(date)
          const target = Number(data.budget.dailyTargets?.[date] ?? defaultDailyTarget)
          return <button key={date} className={selectedDate === date ? 'active' : ''} onClick={() => setSelectedDate(date)}><span>{formatDayName(date)}</span><strong>{formatShortDate(date)}</strong><small>{formatMoney(spent, data.trip.currency)} / {formatMoney(Math.round(target), data.trip.currency)}</small></button>
        })}
      </div>

      <div className="card daily-budget-card">
        <div className="daily-budget-head"><div><span className="eyebrow">{formatDate(selectedDate)}</span><h3>{formatMoney(selectedSpent, data.trip.currency)} spent today</h3></div><label>Day budget<input type="number" min="0" value={Math.round(selectedTarget)} onChange={(e) => updateDailyTarget(selectedDate, e.target.value)} /></label></div>
        <div className="daily-budget-metrics"><div><span>Budget</span><strong>{formatMoney(selectedTarget, data.trip.currency)}</strong></div><div><span>Spent</span><strong>{formatMoney(selectedSpent, data.trip.currency)}</strong></div><div><span>Remaining</span><strong className={selectedRemaining < 0 ? 'negative-text' : 'positive-text'}>{formatMoney(selectedRemaining, data.trip.currency)}</strong></div></div>
        <ProgressBar value={selectedTarget > 0 ? Math.min(100, Math.round((selectedSpent / selectedTarget) * 100)) : 0} />
        <div className="daily-expense-list">
          {selectedExpenses.map((item) => <div className="daily-expense-row" key={item.id}><div><strong>{item.note || item.category}</strong><span>{item.category}</span></div><strong>{formatMoney(item.amount, data.trip.currency)}</strong><button className="icon-button danger" onClick={() => deleteExpense(item.id)}><Trash2 size={15} /></button></div>)}
          {!selectedExpenses.length && <div className="empty-budget-day">No day-specific expenses logged yet.</div>}
        </div>
      </div>

      {showExpenseForm && <form className="inline-form card expense-form" onSubmit={addExpense}><label>Date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></label><label>Category<select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}><option>Food</option><option>Transport</option><option>Attraction</option><option>Shopping</option><option>Accommodation</option><option>Other</option></select></label><label className="form-span-2">Description<input placeholder="Example: Dinner at night market" value={expenseForm.note} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} /></label><label>Amount ({data.trip.currency})<input type="number" min="0" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></label><div className="form-actions"><button type="button" className="ghost-button" onClick={() => setShowExpenseForm(false)}>Cancel</button><button className="primary-button" type="submit">Save expense</button></div></form>}

      <div className="section-heading section-heading-row"><div><span className="eyebrow">SHOPPING</span><h3>Things to buy</h3><p>{formatMoney(shoppingPlanned, data.trip.currency)} planned · {formatMoney(shoppingSpent, data.trip.currency)} spent</p></div><button className="primary-button" onClick={() => setShowShoppingForm((value) => !value)}><Plus size={17} /> Add item</button></div>

      {showShoppingForm && <form className="inline-form card" onSubmit={addShopping}><label className="form-span-2">Item<input placeholder="Example: Shoes from outlet" value={shoppingForm.name} onChange={(e) => setShoppingForm({ ...shoppingForm, name: e.target.value })} autoFocus /></label><label className="form-span-2">Where to buy <span className="optional-field-note">Optional</span><input placeholder="Example: Mitsui Outlet Park, Ximending, night market…" value={shoppingForm.location || ''} onChange={(e) => setShoppingForm({ ...shoppingForm, location: e.target.value })} /></label><label>Planned price<input type="number" min="0" value={shoppingForm.planned} onChange={(e) => setShoppingForm({ ...shoppingForm, planned: e.target.value })} /></label><label>Quantity<input type="number" min="1" value={shoppingForm.quantity} onChange={(e) => setShoppingForm({ ...shoppingForm, quantity: e.target.value })} /></label><label>Priority<select value={shoppingForm.priority} onChange={(e) => setShoppingForm({ ...shoppingForm, priority: e.target.value })}><option>Must Buy</option><option>Want</option><option>If Budget Allows</option></select></label><label>Purchase date (optional)<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={shoppingForm.purchaseDate || ''} onChange={(e) => setShoppingForm({ ...shoppingForm, purchaseDate: e.target.value })} /></label><div className="form-actions"><button type="button" className="ghost-button" onClick={() => setShowShoppingForm(false)}>Cancel</button><button type="submit" className="primary-button">Save item</button></div></form>}

      <div className="shopping-location-tabs" aria-label="Shopping locations">
        <button type="button" className={selectedShoppingLocation === 'all' ? 'active' : ''} onClick={() => setSelectedShoppingLocation('all')}><ShoppingBag size={14} /><span>All</span><small>{data.shopping.length}</small></button>
        {shoppingLocations.map((location) => <button type="button" key={location} className={selectedShoppingLocation === location ? 'active' : ''} onClick={() => setSelectedShoppingLocation(location)}><MapPin size={14} /><span>{location}</span><small>{data.shopping.filter((item) => String(item.location || '').trim() === location).length}</small></button>)}
        {hasUnassignedShopping && <button type="button" className={selectedShoppingLocation === '__unassigned' ? 'active' : ''} onClick={() => setSelectedShoppingLocation('__unassigned')}><MapPin size={14} /><span>No location</span><small>{data.shopping.filter((item) => !String(item.location || '').trim()).length}</small></button>}
      </div>

      <div className="card shopping-card">
        <div className="shopping-progress-header"><div><strong>Shopping budget</strong><span>{formatMoney(data.budget.shopping - shoppingSpent, data.trip.currency)} remaining</span></div><strong>{shoppingPercentage}%</strong></div>
        <ProgressBar value={shoppingPercentage} />
        <div className="shopping-list">
          {visibleShopping.map((item) => {
            const linePlan = item.planned * item.quantity
            const difference = item.bought ? linePlan - item.actual : 0
            return <div className={`shopping-row ${item.bought ? 'bought' : ''}`} key={item.id}><button className={`check-button ${item.bought ? 'checked' : ''}`} onClick={() => updateShopping(item.id, { bought: !item.bought })}>{item.bought && <Check size={15} />}</button><div className="shopping-main"><div className="shopping-name-row"><strong>{item.name}</strong><PriorityPill priority={item.priority} /></div><span>Planned {formatMoney(linePlan, data.trip.currency)} · Qty {item.quantity}</span>{item.location && <span><MapPin size={12} /> {item.location}</span>}{item.purchaseDate && <span>{formatDate(item.purchaseDate)}</span>}{item.bought && <span className={difference >= 0 ? 'positive-text' : 'negative-text'}>{difference >= 0 ? `${formatMoney(difference, data.trip.currency)} under plan` : `${formatMoney(Math.abs(difference), data.trip.currency)} over plan`}</span>}</div><label className="actual-price-field">Actual<div><span>{data.trip.currency}</span><input type="number" min="0" value={item.actual} onChange={(e) => updateShopping(item.id, { actual: Number(e.target.value) })} /></div></label><label className="shopping-date-field">Date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={item.purchaseDate || ''} onChange={(e) => updateShopping(item.id, { purchaseDate: e.target.value })} /></label><button className="icon-button danger shopping-delete-button" title="Delete item" onClick={() => deleteShopping(item.id)}><Trash2 size={17} /></button></div>
          })}
        </div>
      </div>
      {shoppingSpent > data.budget.shopping && <div className="warning-card"><strong>Shopping budget exceeded by {formatMoney(shoppingSpent - data.budget.shopping, data.trip.currency)}.</strong><span>You can still continue — this is a warning, not a spending lock.</span></div>}
    </section>
  )
}

function ChecklistView({ data, setData }) {
  const bags = data.packingBags?.length ? data.packingBags : [{ id: 'bag-main', name: 'Main bag' }]
  const [packingText, setPackingText] = useState('')
  const [selectedBagId, setSelectedBagId] = useState(() => bags[0]?.id || 'bag-main')
  const [newBagName, setNewBagName] = useState('')
  const [showAddBag, setShowAddBag] = useState(false)
  const [buyText, setBuyText] = useState('')
  const [buyPrice, setBuyPrice] = useState(0)
  const [buyLocation, setBuyLocation] = useState('')
  const [selectedBuyLocation, setSelectedBuyLocation] = useState('all')

  useEffect(() => {
    if (!bags.some((bag) => bag.id === selectedBagId)) setSelectedBagId(bags[0]?.id || 'bag-main')
  }, [bags, selectedBagId])

  function togglePacking(id) {
    setData((prev) => ({ ...prev, packing: prev.packing.map((item) => item.id === id ? { ...item, checked: !item.checked } : item) }))
  }

  function addPacking(event) {
    event.preventDefault()
    if (!packingText.trim()) return
    setData((prev) => ({ ...prev, packing: [...prev.packing, { id: Date.now(), name: packingText.trim(), checked: false, bagId: selectedBagId }] }))
    setPackingText('')
  }

  function deletePacking(id) {
    setData((prev) => ({ ...prev, packing: prev.packing.filter((item) => item.id !== id) }))
  }

  function addBag(event) {
    event.preventDefault()
    if (!newBagName.trim()) return
    const id = `bag-${Date.now()}`
    setData((prev) => ({ ...prev, packingBags: [...(prev.packingBags || []), { id, name: newBagName.trim() }] }))
    setSelectedBagId(id)
    setNewBagName('')
    setShowAddBag(false)
  }

  function renameBag(id, name) {
    setData((prev) => ({ ...prev, packingBags: prev.packingBags.map((bag) => bag.id === id ? { ...bag, name } : bag) }))
  }

  function deleteBag(id) {
    if (bags.length <= 1) return
    const fallback = bags.find((bag) => bag.id !== id)
    setData((prev) => ({ ...prev, packingBags: prev.packingBags.filter((bag) => bag.id !== id), packing: prev.packing.map((item) => item.bagId === id ? { ...item, bagId: fallback.id } : item) }))
    setSelectedBagId(fallback.id)
  }

  function addBuy(event) {
    event.preventDefault()
    if (!buyText.trim()) return
    setData((prev) => ({ ...prev, shopping: [...prev.shopping, { id: Date.now(), name: buyText.trim(), planned: Number(buyPrice || 0), actual: 0, quantity: 1, priority: 'Want', bought: false, purchaseDate: '', location: buyLocation.trim() }] }))
    setBuyText('')
    setBuyPrice(0)
    setBuyLocation('')
  }

  function toggleBuy(id) {
    setData((prev) => ({ ...prev, shopping: prev.shopping.map((item) => item.id === id ? { ...item, bought: !item.bought } : item) }))
  }

  const packingDone = data.packing.filter((item) => item.checked).length
  const buyDone = data.shopping.filter((item) => item.bought).length
  const buyLocations = useMemo(() => [...new Set(data.shopping.map((item) => String(item.location || '').trim()).filter(Boolean))], [data.shopping])
  const hasUnassignedBuy = data.shopping.some((item) => !String(item.location || '').trim())
  const visibleBuyItems = data.shopping.filter((item) => selectedBuyLocation === 'all' || (selectedBuyLocation === '__unassigned' ? !String(item.location || '').trim() : String(item.location || '').trim() === selectedBuyLocation))

  useEffect(() => {
    if (selectedBuyLocation !== 'all' && selectedBuyLocation !== '__unassigned' && !buyLocations.includes(selectedBuyLocation)) setSelectedBuyLocation('all')
    if (selectedBuyLocation === '__unassigned' && !hasUnassignedBuy) setSelectedBuyLocation('all')
  }, [selectedBuyLocation, buyLocations, hasUnassignedBuy])

  return (
    <section className="page-section">
      <div className="section-heading section-heading-row checklist-main-heading"><div><span className="eyebrow">TRAVEL CHECKLIST</span><h2>Things to bring</h2><p>{packingDone} of {data.packing.length} packed · organize everything by bag for {data.trip.name}.</p></div><span className="coming-soon-pill">Smart suggestions · Coming soon</span></div>

      <div className="bag-tabs-row">
        <div className="bag-tabs">
          {bags.map((bag) => { const count = data.packing.filter((item) => item.bagId === bag.id).length; return <button type="button" key={bag.id} className={selectedBagId === bag.id ? 'active' : ''} onClick={() => setSelectedBagId(bag.id)}><PackageCheck size={16} /><span>{bag.name}</span><small>{count}</small></button> })}
        </div>
        <button type="button" className="secondary-button add-bag-tab-button" onClick={() => setShowAddBag((value) => !value)}><Plus size={15} /> Add bag</button>
      </div>
      {showAddBag && (
        <form className="add-bag-inline-form" onSubmit={addBag}>
          <input autoFocus placeholder="Bag name (checked luggage, day pack...)" value={newBagName} onChange={(e) => setNewBagName(e.target.value)} />
          <button className="primary-button" type="submit">Add</button>
          <button className="ghost-button" type="button" onClick={() => { setShowAddBag(false); setNewBagName('') }}>Cancel</button>
        </form>
      )}

      <div className="bag-organizer-card bag-panel">
        {bags.filter((bag) => bag.id === selectedBagId).map((bag) => (
          <div key={bag.id}>
            <div className="bag-organizer-head"><label>Bag name<input value={bag.name} onChange={(e) => renameBag(bag.id, e.target.value)} /></label>{bags.length > 1 && <button className="ghost-button trip-delete-button" onClick={() => deleteBag(bag.id)}><Trash2 size={15} /> Remove bag</button>}</div>
            <div className="checklist-items bag-checklist-items">
              {data.packing.filter((item) => item.bagId === bag.id).map((item) => <div className={`checklist-item bag-item ${item.checked ? 'checked' : ''}`} key={item.id}><label><input type="checkbox" checked={item.checked} onChange={() => togglePacking(item.id)} /><span>{item.name}</span></label><button className="icon-button danger" onClick={() => deletePacking(item.id)}><Trash2 size={14} /></button></div>)}
              {!data.packing.some((item) => item.bagId === bag.id) && <div className="empty-bag">Nothing assigned to this bag yet.</div>}
            </div>
            <form className="quick-add" onSubmit={addPacking}><input placeholder={`Add item to ${bag.name}...`} value={packingText} onChange={(e) => setPackingText(e.target.value)} /><button className="icon-button primary" type="submit"><Plus size={18} /></button></form>
          </div>
        ))}
      </div>

      <div className="card checklist-info smart-checklist-coming-soon"><Sparkles size={21} /><div><div className="smart-checklist-title"><strong>Future smart checklist</strong><span className="coming-soon-pill small">Coming soon</span></div><span>Suggested items based on destination, weather, trip length, activities, airline baggage rules, and whether an item belongs in carry-on or checked luggage.</span></div></div>

      <div className="card checklist-card shopping-checklist-wide">
        <div className="checklist-header"><div className="checklist-icon"><ShoppingBag size={22} /></div><div><span className="eyebrow">SHOPPING</span><h3>Things to buy</h3><p>{buyDone} of {data.shopping.length} bought · linked to Budget</p></div></div>
        <div className="shopping-location-tabs compact" aria-label="Shopping locations">
          <button type="button" className={selectedBuyLocation === 'all' ? 'active' : ''} onClick={() => setSelectedBuyLocation('all')}><ShoppingBag size={14} /><span>All</span><small>{data.shopping.length}</small></button>
          {buyLocations.map((location) => <button type="button" key={location} className={selectedBuyLocation === location ? 'active' : ''} onClick={() => setSelectedBuyLocation(location)}><MapPin size={14} /><span>{location}</span><small>{data.shopping.filter((item) => String(item.location || '').trim() === location).length}</small></button>)}
          {hasUnassignedBuy && <button type="button" className={selectedBuyLocation === '__unassigned' ? 'active' : ''} onClick={() => setSelectedBuyLocation('__unassigned')}><MapPin size={14} /><span>No location</span><small>{data.shopping.filter((item) => !String(item.location || '').trim()).length}</small></button>}
        </div>
        <div className="checklist-items buy-checklist">{visibleBuyItems.map((item) => <label className={`checklist-item ${item.bought ? 'checked' : ''}`} key={item.id}><input type="checkbox" checked={item.bought} onChange={() => toggleBuy(item.id)} /><span><strong>{item.name}</strong><small>{formatMoney(item.planned * item.quantity, data.trip.currency)} planned{item.location ? ` · ${item.location}` : ''}</small></span></label>)}</div>
        <form className="quick-add buy-add buy-add-with-location" onSubmit={addBuy}><input placeholder="Add something to buy..." value={buyText} onChange={(e) => setBuyText(e.target.value)} /><input className="buy-location-input" placeholder="Where? (optional)" value={buyLocation} onChange={(e) => setBuyLocation(e.target.value)} /><div className="money-mini-input"><span>{data.trip.currency}</span><input type="number" min="0" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} /></div><button className="icon-button primary" type="submit"><Plus size={18} /></button></form>
      </div>
    </section>
  )
}

function EditableCard({ icon: Icon, title, children }) {
  return (
    <div className="card editable-card">
      <div className="editable-card-title">
        <div className="card-icon"><Icon size={18} /></div>
        <strong>{title}</strong>
      </div>
      <div className="editable-card-body">{children}</div>
    </div>
  )
}

function BudgetMetric({ icon: Icon, label, value, hint, positive }) {
  return (
    <div className="card metric-card">
      <div className="metric-icon"><Icon size={19} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={positive === false ? 'negative-text' : positive ? 'positive-text' : ''}>{hint}</small>
      </div>
    </div>
  )
}

function ProgressBar({ value, label }) {
  return (
    <div className="progress-wrap">
      {label && <div className="progress-label"><span>{label}</span><span>{value}%</span></div>}
      <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  )
}

function PriorityPill({ priority }) {
  const className = priority.toLowerCase().replaceAll(' ', '-')
  return <span className={`pill priority-${className}`}>{priority}</span>
}

function StatusPill({ status }) {
  const labels = { done: 'Done', current: 'Now', upcoming: 'Upcoming', skipped: 'Skipped' }
  const icons = {
    done: <Check size={15} />,
    current: <Navigation size={14} />,
    upcoming: <Clock3 size={14} />,
    skipped: <X size={14} />,
  }
  return (
    <span className={`status-icon status-${status}`} title={labels[status] || status} aria-label={labels[status] || status}>
      {icons[status] || <Clock3 size={14} />}
    </span>
  )
}

export default App

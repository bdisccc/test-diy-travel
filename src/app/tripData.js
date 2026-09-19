import { emptyLocationFields, migrateLegacyLocation } from '../services/maps/index.js'

export const STORAGE_KEY = 'diy-travel-app-v1'
export const PLAN_LIBRARY_KEY = 'diy-travel-plan-library-v1'
export const ACTIVE_PLAN_KEY = 'diy-travel-active-plan-v1'
export const NAVIGATION_STATE_KEY = 'diy-travel-navigation-state-v1'

const emptyMapFields = emptyLocationFields()

export const demoState = {
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
    discounts: [],
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


export function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.warn(`DIY Travel could not save ${key}:`, error)
    return false
  }
}

export function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn(`DIY Travel could not remove ${key}:`, error)
  }
}


export function normalizeData(saved) {
  if (!saved || typeof saved !== 'object') return clone(demoState)
  const base = clone(demoState)
  const savedTrip = saved.trip || {}
  const arrival = migrateLegacyLocation({ ...base.trip.arrival, ...(savedTrip.arrival || {}) })
  const departure = migrateLegacyLocation({ ...base.trip.departure, ...(savedTrip.departure || {}) })

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
      arrival: migrateLegacyLocation({ ...arrival, date: arrival.date || startDate }),
      departure: migrateLegacyLocation({ ...departure, date: departure.date || endDate }),
      hotels: hotels.map((hotel, index) => migrateLegacyLocation({
        id: hotel.id || Date.now() + index,
        ...emptyMapFields,
        checkInDate: startDate,
        checkIn: '15:00',
        checkOutDate: endDate,
        checkOut: '11:00',
        ...hotel,
      })),
    },
    places: (saved.places || base.places).map((place, index) => migrateLegacyLocation({
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
        : (place.regularOpeningHours
          ? 'open'
          : ((place.open || place.close) ? 'manual' : 'unavailable'))),
    })),
    progress: saved.progress || {},
    budget: {
      ...base.budget,
      ...(saved.budget || {}),
      dailyTargets: { ...(base.budget.dailyTargets || {}), ...((saved.budget || {}).dailyTargets || {}) },
      discounts: Array.isArray((saved.budget || {}).discounts) ? (saved.budget || {}).discounts : [],
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

export function planRecord(data, id = makePlanId(), createdAt = new Date().toISOString()) {
  return {
    id,
    createdAt,
    updatedAt: new Date().toISOString(),
    data: clone(normalizeData(data)),
  }
}

export function createBlankTripData() {
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
    budget: { total: 0, shopping: 0, spentOther: 0, dailyTargets: {}, discounts: [] },
  })
}

export function getPlanStatus(data) {
  const today = isoToday()
  const start = data?.trip?.startDate || ''
  const end = data?.trip?.endDate || ''
  if (end && end < today) return 'past'
  if (start && start > today) return 'future'
  return 'current'
}

export function loadInitialWorkspace() {
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


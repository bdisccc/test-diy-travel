import { Component, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlarmClock,
  ArrowLeft,
  BedDouble,
  BusFront,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
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
import { getGooglePlaceDetails, hasGoogleMapsKey, searchGoogleNearbyPlaces, searchGooglePlaces } from './googleMaps.js'
import AppDialog from './components/AppDialog.jsx'
import PlacePhoto from './components/PlacePhoto.jsx'
import { installButtonDebugger } from './debug/buttonDebug.js'
import './styles/nearby.css'
import { getRouteComparison } from './routes.js'
import { regionalTransitSource } from './regionalTransit.js'

const STORAGE_KEY = 'diy-travel-app-v1'
const PLAN_LIBRARY_KEY = 'diy-travel-plan-library-v1'
const ACTIVE_PLAN_KEY = 'diy-travel-active-plan-v1'
const NAVIGATION_STATE_KEY = 'diy-travel-navigation-state-v1'

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

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.warn(`DIY Travel could not save ${key}:`, error)
    return false
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn(`DIY Travel could not remove ${key}:`, error)
  }
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
            <div className="view-error-copy">
              <strong>This section ran into a display problem.</strong>
              <span>Your trip data is still saved. You can retry this section or return to your trip list without losing your plan.</span>
              <div className="view-error-actions">
                <button type="button" className="primary-button" onClick={() => this.setState({ error: null })}>Try again</button>
                {this.props.onBack && <button type="button" className="ghost-button" onClick={this.props.onBack}>Back to trips</button>}
              </div>
            </div>
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
    budget: { total: 0, shopping: 0, spentOther: 0, dailyTargets: {}, discounts: [] },
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


function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function reportRows(data) {
  const trip = data?.trip || {}
  const arrival = trip.arrival || {}
  const departure = trip.departure || {}
  const discounts = Array.isArray(data?.budget?.discounts) ? data.budget.discounts : []
  const rows = [
    ['DIY Travel report'],
    ['Trip', trip.name || 'Untitled Trip'],
    ['Destination', trip.city || ''],
    ['Travel dates', `${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}`],
    ['Currency', trip.currency || ''],
    [],
    ['FLIGHTS'],
    ['Type', 'Flight no.', 'Airline', 'From / To', 'Airport', 'Time', 'Terminal', 'Gate'],
    ['Arrival', arrival.flightNumber || '', arrival.airline || '', arrival.from || '', arrival.location || '', arrival.time || '', arrival.terminal || '', arrival.gate || ''],
    ['Departure', departure.flightNumber || '', departure.airline || '', departure.to || '', departure.location || '', departure.time || '', departure.terminal || '', departure.gate || ''],
    [],
    ['STAYS / BASES'],
    ['Name', 'Address', 'Check-in', 'Check-out'],
    ...(trip.hotels || []).map((hotel) => [hotel.name || '', hotel.address || '', `${formatDate(hotel.checkInDate)} ${hotel.checkIn || ''}`.trim(), `${formatDate(hotel.checkOutDate)} ${hotel.checkOut || ''}`.trim()]),
    [],
    ['PLACES'],
    ['Date', 'Time', 'Place', 'Category', 'Duration', 'Hours', 'Address', 'Priority'],
    ...[...(data?.places || [])]
      .sort((a, b) => `${a.visitDate || ''}-${a.plannedStart || a.suggestedStart || ''}`.localeCompare(`${b.visitDate || ''}-${b.plannedStart || b.suggestedStart || ''}`))
      .map((place) => [formatDate(place.visitDate), place.plannedStart || place.suggestedStart || '', place.name || '', place.category || '', `${place.duration || 0} min`, place.hoursSummary || [place.open, place.close].filter(Boolean).join(' — '), place.address || '', place.priority || '']),
    [],
    ['EXPENSES'],
    ['Date', 'Category', 'Description', 'Amount'],
    ...(data?.expenses || []).map((item) => [formatDate(item.date), item.category || '', item.note || '', formatMoney(item.amount, trip.currency || '')]),
    [],
    ['DISCOUNTS / SAVINGS'],
    ['Date', 'Discount', 'Code', 'Savings'],
    ...discounts.map((item) => [formatDate(item.date), item.label || '', item.code || '', formatMoney(item.amount, trip.currency || '')]),
    [],
    ['THINGS TO BUY'],
    ['Item', 'Location', 'Planned', 'Actual', 'Status'],
    ...(data?.shopping || []).map((item) => [item.name || '', item.location || '', formatMoney(Number(item.planned || 0) * Number(item.quantity || 1), trip.currency || ''), formatMoney(item.actual || 0, trip.currency || ''), item.bought ? 'Bought' : 'Planned']),
    [],
    ['PACKING'],
    ['Bag', 'Item', 'Packed'],
    ...(data?.packing || []).map((item) => {
      const bag = (data?.packingBags || []).find((candidate) => candidate.id === item.bagId)
      return [bag?.name || 'Bag', item.name || '', item.checked ? 'Yes' : 'No']
    }),
  ]
  return rows
}

function downloadTextFile(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function safeReportFilename(name, extension) {
  const safe = String(name || 'DIY-Travel')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'DIY-Travel'
  return `${safe}.${extension}`
}

function exportTripCsv(data) {
  const csv = reportRows(data)
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\r\n')
  downloadTextFile(safeReportFilename(data?.trip?.name, 'csv'), `\ufeff${csv}`, 'text/csv;charset=utf-8')
}

function exportTripExcel(data) {
  const rows = reportRows(data)
  const table = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse}td{border:1px solid #ddd;padding:7px;vertical-align:top}</style></head><body><table>${table}</table></body></html>`
  downloadTextFile(safeReportFilename(data?.trip?.name, 'xls'), `\ufeff${html}`, 'application/vnd.ms-excel;charset=utf-8')
}

function exportTripPdf(data, onError = () => {}) {
  const rows = reportRows(data)
  const table = rows.map((row) => {
    if (!row.length) return '<tr class="spacer"><td>&nbsp;</td></tr>'
    if (row.length === 1) return `<tr class="section"><th colspan="8">${escapeHtml(row[0])}</th></tr>`
    return `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
  }).join('')

  const printableHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data?.trip?.name || 'DIY Travel')} report</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#182128;margin:0;font-size:10pt}h1{font-size:22pt;margin:0 0 4px}.meta{color:#66726f;margin:0 0 18px}.brand{color:#166a58;font-weight:800;font-size:9pt;letter-spacing:.08em;text-transform:uppercase}table{width:100%;border-collapse:collapse;table-layout:auto}td,th{border:1px solid #dfe5e2;padding:6px 7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.section th{background:#eef7f4;color:#0f4f42;font-size:11pt;padding:9px}.spacer td{border:0;height:9px}.note{margin-top:14px;color:#6b7773;font-size:8.5pt}@media print{.note{display:none}}</style></head><body><div class="brand">DIY Travel</div><h1>${escapeHtml(data?.trip?.name || 'Trip report')}</h1><p class="meta">${escapeHtml(data?.trip?.city || '')} · ${escapeHtml(formatDate(data?.trip?.startDate))} — ${escapeHtml(formatDate(data?.trip?.endDate))}</p><table>${table}</table><p class="note">Choose “Save as PDF” in the print dialog.</p></body></html>`

  // Print from a temporary hidden frame so mobile/desktop browsers do not need to allow pop-ups.
  const frame = document.createElement('iframe')
  frame.setAttribute('title', 'DIY Travel PDF report')
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '1px',
    height: '1px',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  })
  document.body.appendChild(frame)

  const frameWindow = frame.contentWindow
  const frameDocument = frame.contentDocument || frameWindow?.document
  if (!frameWindow || !frameDocument) {
    frame.remove()
    onError('The PDF report could not be prepared in this browser. Try CSV or Excel instead.')
    return
  }

  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    frame.remove()
  }

  const printReport = () => {
    try {
      frameWindow.focus()
      frameWindow.print()
      frameWindow.addEventListener?.('afterprint', cleanup, { once: true })
      setTimeout(cleanup, 30000)
    } catch (error) {
      console.error('PDF print failed:', error)
      cleanup()
      onError('The print dialog could not open. Try CSV or Excel instead.')
    }
  }

  frameDocument.open()
  frameDocument.write(printableHtml)
  frameDocument.close()
  setTimeout(printReport, 180)
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
    hoursSummary: '', hoursStatus: 'unavailable', source: 'manual', notes: '',
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

function formatTravelMinutes(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0))
  if (value < 60) return `${value} min`
  const hours = Math.floor(value / 60)
  const rest = value % 60
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

function formatNearbyDistance(meters) {
  const value = Number(meters)
  if (!Number.isFinite(value) || value < 0) return 'Nearby'
  if (value < 1000) return `${Math.round(value)} m`
  const km = value / 1000
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`
}

function normalizedPlaceText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function placeIdentityKeys(place) {
  if (!place) return []
  const keys = []
  if (place.googlePlaceId) keys.push(`id:${place.googlePlaceId}`)
  const name = normalizedPlaceText(place.name || place.location)
  const address = normalizedPlaceText(place.address)
  if (name && address) keys.push(`name-address:${name}|${address}`)
  const lat = Number(place.latitude)
  const lng = Number(place.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng)) keys.push(`coord:${lat.toFixed(5)},${lng.toFixed(5)}`)
  return keys
}

function isPlaceAlreadySaved(candidate, savedPlaces = []) {
  const candidateKeys = new Set(placeIdentityKeys(candidate))
  if (!candidateKeys.size) return false
  return savedPlaces.some((saved) => placeIdentityKeys(saved).some((key) => candidateKeys.has(key)))
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
  if (pref?.endMode === 'stay') return `${strategy} · return to stay/base`
  if (pref?.endMode === 'shopping') return `${strategy} · shopping last`
  if (pref?.endMode === 'place') return `${strategy} · chosen final place`
  return `${strategy} · end at final destination`
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

  if (arrival?.date === date && startPreference === 'arrival_stay' && isMapped(stay)) {
    const airportReady = addMinutes(arrival.time || '09:00', Number(arrival.transferBufferMinutes || 0))
    const transferToStay = isMapped(arrival) ? estimateTransferMinutes(arrival, stay) : { minutes: 15 }
    const stayArrivalTime = addMinutes(airportReady, transferToStay.minutes)
    items.push({
      key: `arrival-stay-${stay.id || date}`, kind: 'stay', start: stayArrivalTime, end: '',
      title: `Stay/base · ${stay.name || 'Accommodation'}`,
      subtitle: stay.address || 'Stay/base',
      detail: `First stop after the airport${stay.checkIn ? ` · check-in from ${stay.checkIn}` : ''}`,
      mapUri: stay.googleMapsURI || '', locationData: stay, sort: stayArrivalTime || '00:01',
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
      notes: place.notes || '',
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

function GooglePlacePicker({ onSelect, placeholder = 'Search place or address…', compact = false, includedType = '' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function runSearch(event) {
    event?.preventDefault()
    const value = query.trim()
    if (value.length < 2) {
      setError('Type at least 2 characters.')
      return
    }
    setStatus('searching')
    setError('')
    try {
      const places = await searchGooglePlaces(value, { includedType, maxResults: 6 })
      setResults(places)
      setStatus('ready')
      if (!places.length) setError('No matches found. Try a more specific name or address.')
    } catch (searchError) {
      console.error('Google Places Text Search failed:', searchError)
      setResults([])
      setStatus('error')
      setError('Search is unavailable right now. You can still enter the details manually.')
    }
  }

  async function choosePlace(place) {
    setStatus('fetching')
    setError('')
    let selected = place
    try {
      const detailed = place.googlePlaceId ? await getGooglePlaceDetails(place.googlePlaceId) : null
      if (detailed) selected = detailed
    } catch (detailsError) {
      // The text-search result already contains the name, address and coordinates we need.
      // Do not block the user when the optional GetPlace/details quota is unavailable.
      console.warn('Google Place Details unavailable; using search result data instead:', detailsError)
    }
    setQuery(selected.name || query)
    setResults([])
    onSelect?.(selected)
    setStatus('ready')
  }

  return (
    <div className={`google-picker text-search-picker simplified-search ${compact ? 'compact' : ''}`}>
      <div className="custom-autocomplete-wrap">
        <Search className="custom-search-icon" size={18} />
        <input
          className="custom-google-input"
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          onChange={(event) => { setQuery(event.target.value); setResults([]); setError('') }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              runSearch()
            }
          }}
        />
        {(status === 'searching' || status === 'fetching') && <LoaderCircle className="google-search-spinner" size={17} />}
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
              <span><strong>{place.name || 'Place result'}</strong><small>{place.address || 'Address unavailable'}</small></span>
            </button>
          ))}
          <div className="google-suggestions-footer maps-attribution" aria-label="Google Maps attribution">Google Maps</div>
        </div>
      )}
      {error && <div className="google-picker-error">{error}</div>}
    </div>
  )
}

function TimelineLegSummary({ origin, destination, date, time, utcOffsetMinutes }) {
  const [status, setStatus] = useState('idle')
  const [transitOptions, setTransitOptions] = useState([])
  const distanceKm = haversineKm(origin, destination)
  if (distanceKm == null) return null

  const walkMinutes = Math.max(2, Math.round((distanceKm / 4.7) * 60))
  const driveMinutes = Math.max(3, Math.round((distanceKm / 28) * 60 + 2))

  async function loadTransit() {
    if (status === 'loading') return
    setStatus('loading')
    try {
      const departureTime = localDateTimeToUtc(date, time, utcOffsetMinutes, 0)
      const result = await getRouteComparison({ origin, destination, departureTime })
      setTransitOptions(result.filter((option) => ['BUS', 'RAIL', 'FERRY'].includes(option.mode) && option.route))
      setStatus('ready')
    } catch (error) {
      console.warn('Inline transit comparison unavailable:', error)
      setTransitOptions([])
      setStatus('unavailable')
    }
  }

  return (
    <div className="timeline-leg-summary">
      <div className="timeline-leg-destination"><Navigation size={13} /><span>Next stop · {distanceKm.toFixed(1)} km</span></div>

      <div className="timeline-leg-options timeline-leg-options-desktop">
        <span><Footprints size={13} /> Walk ≈ {formatTravelMinutes(walkMinutes)}</span>
        <span><Car size={13} /> Drive ≈ {formatTravelMinutes(driveMinutes)}</span>
        {status === 'idle' && <button type="button" onClick={loadTransit}><TrainFront size={13} /> Check transit</button>}
        {status === 'loading' && <span><LoaderCircle className="spin" size={13} /> Checking transit…</span>}
        {status === 'ready' && transitOptions.map((option) => <span key={option.mode}>{transportIcon(option.mode, 13)} {modeLabel(option.mode)} {option.minutes ? `≈ ${formatTravelMinutes(option.minutes)}` : ''}</span>)}
        {status === 'ready' && !transitOptions.length && <span>Transit not available</span>}
        {status === 'unavailable' && <button type="button" onClick={loadTransit}><TrainFront size={13} /> Retry transit</button>}
      </div>

      <details
        className="timeline-leg-mobile-dropdown"
        onToggle={(event) => {
          if (event.currentTarget.open && status === 'idle') loadTransit()
        }}
      >
        <summary>
          <span><Navigation size={14} /> Travel options</span>
          <ChevronDown size={15} />
        </summary>
        <div className="timeline-leg-mobile-menu">
          <div className="timeline-leg-mobile-option"><span><Footprints size={15} /> Walk</span><strong>≈ {formatTravelMinutes(walkMinutes)}</strong></div>
          <div className="timeline-leg-mobile-option"><span><Car size={15} /> Drive / taxi</span><strong>≈ {formatTravelMinutes(driveMinutes)}</strong></div>
          {status === 'loading' && <div className="timeline-leg-mobile-option muted"><span><LoaderCircle className="spin" size={15} /> Public transit</span><strong>Checking…</strong></div>}
          {status === 'ready' && transitOptions.map((option) => (
            <div className="timeline-leg-mobile-option" key={`mobile-${option.mode}`}>
              <span>{transportIcon(option.mode, 15)} {modeLabel(option.mode)}</span>
              <strong>{option.minutes ? `≈ ${formatTravelMinutes(option.minutes)}` : 'Available'}</strong>
            </div>
          ))}
          {status === 'ready' && !transitOptions.length && <div className="timeline-leg-mobile-option muted"><span><TrainFront size={15} /> Public transit</span><strong>Not available</strong></div>}
          {status === 'unavailable' && <button type="button" className="timeline-leg-mobile-retry" onClick={loadTransit}><TrainFront size={15} /> Retry transit schedules</button>}
        </div>
      </details>
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
      setError('Enter an airport name or IATA code.')
      return
    }
    setStatus('searching')
    setError('')
    try {
      const matches = await searchGooglePlaces(searchValue, { includedType: 'airport', maxResults: 5 })
      setResults(matches)
      setStatus('ready')
      if (!matches.length) setError('No matching airport found. You can keep the airport name manually.')
    } catch (searchError) {
      console.error('Airport search failed:', searchError)
      setResults([])
      setStatus('error')
      setError('Airport search is unavailable right now. You can keep the airport name manually.')
    }
  }

  async function chooseAirport(place) {
    setStatus('fetching')
    setError('')
    let selected = place
    try {
      const detailed = place.googlePlaceId ? await getGooglePlaceDetails(place.googlePlaceId) : null
      if (detailed) selected = detailed
    } catch (detailsError) {
      // Airport search results already include enough map data to save the airport.
      // Keep the selection usable even when GetPlace/details requests are quota-limited.
      console.warn('Airport details unavailable; using search result data instead:', detailsError)
    }
    setQuery(selected.name || query)
    setResults([])
    onPlaceSelect?.(selected)
    setStatus('ready')
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
        <div className={`airport-field-search simplified-airport-search ${isMapped(value) ? 'is-selected' : ''}`}>
          <Search size={18} aria-label="Search airport" />
          <input
            value={query}
            placeholder="Airport name or IATA code"
            autoComplete="off"
            onChange={(e) => changeAirportName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runSearch()
              }
            }}
          />
          {(status === 'searching' || status === 'fetching') && <LoaderCircle className="airport-search-spinner" size={17} />}
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
            <span>{value.address || 'Select a search result to save the address for routing.'}</span>
          </div>
          {value.googleMapsURI && <a href={value.googleMapsURI} target="_blank" rel="noreferrer" title="Open map"><ExternalLink size={15} /></a>}
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

function googlePlaceMapUrl(place) {
  if (!place) return ''
  if (place.googleMapsURI) return place.googleMapsURI
  const lat = Number(place.latitude)
  const lng = Number(place.longitude)
  const query = Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat},${lng}`
    : [place.name || place.location, place.address].filter(Boolean).join(' ')
  if (!query) return ''
  const params = new URLSearchParams({ api: '1', query })
  if (place.googlePlaceId) params.set('query_place_id', place.googlePlaceId)
  return `https://www.google.com/maps/search/?${params.toString()}`
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
      detail: 'Schedule details are unavailable for this leg right now.',
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
                  aria-pressed={Boolean(route && expandedMode === option.mode)}
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
                <span className="regional-transit-kicker">Local schedule option</span>
                <strong>Check the local timetable</strong>
                <span>Detailed public-transport routing is unavailable for this leg. You can still check the official local schedule.</span>
              </div>
              <div className="regional-transit-actions">
                <a className="secondary-button" href={regionalSource.actionUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open schedule</a>
              </div>
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
                    <div className="route-simple-copy"><span>A transit travel time is available, but detailed stop information is not available for this route.</span></div>
                  )
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

function loadNavigationState() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAVIGATION_STATE_KEY) || '{}')
    const active = ['plan', 'today', 'budget', 'checklist'].includes(saved.active) ? saved.active : 'plan'
    return {
      active,
      planScreen: saved.planScreen === 'editor' ? 'editor' : 'dashboard',
      moduleScreen: saved.moduleScreen === 'detail' ? 'detail' : 'dashboard',
    }
  } catch {
    return { active: 'plan', planScreen: 'dashboard', moduleScreen: 'dashboard' }
  }
}

function App() {
  const initial = useMemo(() => loadInitialWorkspace(), [])
  const initialNavigation = useMemo(() => loadNavigationState(), [])
  const [active, setActive] = useState(initialNavigation.active)
  const [planScreen, setPlanScreen] = useState(initialNavigation.planScreen)
  const [moduleScreen, setModuleScreen] = useState(initialNavigation.moduleScreen)
  const [plans, setPlans] = useState(initial.plans)
  const [activePlanId, setActivePlanId] = useState(initial.activePlanId)
  const [data, setData] = useState(initial.data)
  const [pendingDeletePlanId, setPendingDeletePlanId] = useState(null)

  useEffect(() => installButtonDebugger(), [])

  useEffect(() => {
    safeStorageSet(STORAGE_KEY, JSON.stringify(data))
    setPlans((prev) => prev.map((record) => (
      record.id === activePlanId
        ? { ...record, updatedAt: new Date().toISOString(), data: clone(data) }
        : record
    )))
  }, [data, activePlanId])

  useEffect(() => {
    safeStorageSet(PLAN_LIBRARY_KEY, JSON.stringify(plans))
  }, [plans])

  useEffect(() => {
    safeStorageSet(ACTIVE_PLAN_KEY, activePlanId)
  }, [activePlanId])

  useEffect(() => {
    safeStorageSet(NAVIGATION_STATE_KEY, JSON.stringify({ active, planScreen, moduleScreen }))
  }, [active, planScreen, moduleScreen])

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
    if (!plans.some((item) => item.id === id)) return
    setPendingDeletePlanId(id)
  }

  function confirmDeletePlan() {
    const id = pendingDeletePlanId
    if (!id) return
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
    setPendingDeletePlanId(null)
    setActive('plan')
    setPlanScreen('dashboard')
  }

  function resetDemo() {
    const nextData = clone(demoState)
    const next = planRecord(nextData)
    safeStorageRemove(STORAGE_KEY)
    safeStorageRemove(PLAN_LIBRARY_KEY)
    safeStorageRemove(ACTIVE_PLAN_KEY)
    safeStorageRemove(NAVIGATION_STATE_KEY)
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
            return <button type="button" key={item.id} className={`nav-button ${active === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.label}</span></button>
          })}
        </nav>
        <div className="sidebar-trip-card">
          <span className="eyebrow">ACTIVE TRIP</span>
          <strong>{data.trip.name}</strong>
          <span>{formatDate(data.trip.startDate)} — {formatDate(data.trip.endDate)}</span>
          <div className="mini-budget-row"><span>Remaining</span><strong>{formatMoney(remaining, data.trip.currency)}</strong></div>
        </div>
        <button type="button" className="reset-button" onClick={resetDemo}><RotateCcw size={16} /> Reset demo data</button>
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
            return <button type="button" key={item.id} className={active === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span></button>
          })}
        </nav>
        <div className="page-content">
          {active === 'plan' && planScreen === 'dashboard' && (
            <ViewErrorBoundary key={`plan-dashboard-${plans.length}`} onBack={goToPlanDashboard}>
              <TripDashboard
                plans={plans}
                activePlanId={activePlanId}
                onOpen={openPlan}
                onDuplicate={duplicatePlan}
                onDelete={deletePlan}
                onCreate={createPlan}
              />
            </ViewErrorBoundary>
          )}
          {active === 'plan' && planScreen === 'editor' && (
            <ViewErrorBoundary key={`plan-${activePlanId}`} onBack={goToPlanDashboard}>
              <PlanView data={data} setData={setData} onBack={goToPlanDashboard} />
            </ViewErrorBoundary>
          )}
          {active !== 'plan' && moduleScreen === 'dashboard' && (
            <ViewErrorBoundary key={`${active}-dashboard-${plans.length}`} onBack={goToModuleDashboard}>
              <ModuleTripDashboard moduleId={active} plans={plans} activePlanId={activePlanId} onOpen={openModulePlan} />
            </ViewErrorBoundary>
          )}
          {active === 'today' && moduleScreen === 'detail' && <ViewErrorBoundary key={`today-${activePlanId}-${data.trip.startDate}-${data.trip.endDate}`} onBack={goToModuleDashboard}><TodayView data={data} setData={setData} /></ViewErrorBoundary>}
          {active === 'budget' && moduleScreen === 'detail' && <ViewErrorBoundary key={`budget-${activePlanId}`} onBack={goToModuleDashboard}><BudgetView data={data} setData={setData} shoppingSpent={shoppingSpent} shoppingPlanned={shoppingPlanned} totalSpent={totalSpent} remaining={remaining} expenseSpent={expenseSpent} /></ViewErrorBoundary>}
          {active === 'checklist' && moduleScreen === 'detail' && <ViewErrorBoundary key={`checklist-${activePlanId}`} onBack={goToModuleDashboard}><ChecklistView data={data} setData={setData} /></ViewErrorBoundary>}
        </div>
      </main>
      <AppDialog
        open={Boolean(pendingDeletePlanId)}
        tone="danger"
        icon={Trash2}
        title="Delete this trip?"
        message={`This will remove “${plans.find((item) => item.id === pendingDeletePlanId)?.data?.trip?.name || 'this trip'}” from this browser.`}
        detail="This action cannot be undone."
        confirmLabel="Delete trip"
        cancelLabel="Keep trip"
        onConfirm={confirmDeletePlan}
        onCancel={() => setPendingDeletePlanId(null)}
      />
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
        {showBack && <button type="button" className="topbar-back" title="Back to all trips" onClick={onBack}><ArrowLeft size={18} /></button>}
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
            <button type="button" className="topbar-edit-title" onClick={() => setEditingTitle(true)} title="Edit trip title">
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
          <button type="button" className="icon-button" title="Done editing dates" onClick={() => setEditingDates(false)}><Check size={16} /></button>
        </div>
      ) : (
        <button type="button" className="trip-dates editable-trip-dates" onClick={() => setEditingDates(true)} title="Edit trip dates">
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
        <button type="button" className="primary-button" onClick={onCreate}><Plus size={17} /> Create trip</button>
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
                      <button type="button" className="primary-button" onClick={() => onOpen(record.id)}><FolderOpen size={16} /> Open</button>
                      <button type="button" className="ghost-button" onClick={() => onDuplicate(record.id)}><Copy size={16} /> {key === 'past' ? 'Repeat' : 'Duplicate'}</button>
                      <button type="button" className="ghost-button trip-delete-button" onClick={() => onDelete(record.id)}><Trash2 size={16} /> Delete</button>
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
              <button type="button" className="primary-button" onClick={() => onOpen(record.id, moduleId)}><FolderOpen size={16} /> {meta.action}</button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PlanAccordionSection({ id, icon: Icon, title, subtitle, open, onToggle, badge = null, children }) {
  return (
    <section id={id} className={`plan-accordion-section ${open ? 'open' : ''}`}>
      <button type="button" className="plan-accordion-toggle" onClick={onToggle} aria-expanded={open} aria-controls={`${id}-content`}>
        <span className="plan-accordion-icon"><Icon size={18} /></span>
        <span className="plan-accordion-copy"><strong>{title}</strong><small>{subtitle}</small></span>
        {badge}
        <ChevronDown className="plan-accordion-chevron" size={18} />
      </button>
      {open && <div id={`${id}-content`} className="plan-accordion-body">{children}</div>}
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
  const [placeMoveDialog, setPlaceMoveDialog] = useState(null)
  const [openPlanSections, setOpenPlanSections] = useState({ travel: true, flights: false, stays: false, places: false, transport: false })
  const googleConfigured = hasGoogleMapsKey()

  function togglePlanSection(section) {
    setOpenPlanSections((prev) => ({ ...prev, [section]: !prev[section] }))
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
        photoURI: place.photoURI || '',
        photoAttributions: place.photoAttributions || [],
        photoGoogleMapsURI: place.photoGoogleMapsURI || '',
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

  function commitPlace(candidate) {
    setData((prev) => {
      const nextData = {
        ...prev,
        places: editingPlaceId
          ? prev.places.map((place) => place.id === editingPlaceId ? { ...place, ...candidate, id: editingPlaceId } : place)
          : [...prev.places, { ...candidate, id: Date.now() }],
      }
      return applyAllSmartSuggestions(nextData)
    })
    setPlaceMoveDialog(null)
    closePlaceForm()
  }

  function confirmSuggestedPlaceMove() {
    if (!placeMoveDialog?.candidate || !placeMoveDialog?.nextDay) return
    const { candidate, nextDay } = placeMoveDialog
    const movedCandidate = {
      ...placeWithDateHours(candidate, nextDay.date),
      plannedStart: '',
      suggestedStart: nextDay.start,
      timeSource: 'suggested',
    }
    commitPlace(movedCandidate)
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
      return
    }

    const candidateId = editingPlaceId || `candidate-${Date.now()}`
    let candidate = { ...normalizedPlace, id: candidateId }
    const candidatePlaces = editingPlaceId
      ? data.places.map((place) => place.id === editingPlaceId ? candidate : place)
      : [...data.places, candidate]
    const candidateData = { ...data, places: candidatePlaces }

    try {
      const schedule = smartPlaceSchedule(candidateData, candidate.visitDate).get(candidateId)
      if (schedule?.scheduleWarning) {
        const nextDay = findNextAvailableDay(candidateData, candidateId, candidate.visitDate)
        if (nextDay) {
          setPlaceMoveDialog({
            candidate,
            nextDay,
            warning: schedule.scheduleWarning,
          })
          setPlaceFormError('')
          return
        }
        setPlaceFormError(`${schedule.scheduleWarning} No later trip day currently has enough room for this stop.`)
        return
      }
      if (candidate.timeSource !== 'manual') {
        candidate = { ...candidate, suggestedStart: schedule?.start || '', plannedStart: '', timeSource: 'suggested' }
      }
    } catch (error) {
      console.warn('Place feasibility check skipped:', error)
    }

    commitPlace(candidate)
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
      <div className="hero-card plan-hero-card">
        <div>
          <span className="eyebrow">PLAN YOUR TRIP</span>
          <h2>Plan the essentials. Today handles the day-by-day flow.</h2>
          <p>Set your dates, flights, stay/base, places, and transport preferences once.</p>
        </div>
        <TripExportMenu data={data} />
      </div>

      <PlanAccordionSection id="plan-travel" icon={MapPin} title="Travel window" subtitle="Destination and trip dates" open={openPlanSections.travel} onToggle={() => togglePlanSection('travel')}>
      <div className="details-grid travel-window-grid">
        <EditableCard icon={MapPin} title="Destination">
          <label>City / Country<input value={data.trip.city} onChange={(e) => updateTripField('city', e.target.value)} /></label>
          <div className="two-column-fields">
            <label>Start<input type="date" value={data.trip.startDate} onChange={(e) => updateTravelWindow('startDate', e.target.value)} /></label>
            <label>End<input type="date" value={data.trip.endDate} onChange={(e) => updateTravelWindow('endDate', e.target.value)} /></label>
          </div>
        </EditableCard>
      </div>
      </PlanAccordionSection>

      <PlanAccordionSection id="plan-flights" icon={Plane} title="Flights" subtitle="Arrival and departure details" open={openPlanSections.flights} onToggle={() => togglePlanSection('flights')} badge={<span className="coming-soon-pill small">Tracking soon</span>}>
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
      </PlanAccordionSection>

      <PlanAccordionSection id="plan-stays" icon={BedDouble} title="Stay / base" subtitle="Optional hotel, home, Airbnb, or address" open={openPlanSections.stays} onToggle={() => togglePlanSection('stays')}>
      <div className="plan-accordion-actions"><button type="button" className="primary-button" onClick={addHotel}><Plus size={17} /> Add stay</button></div>
      <div className="hotel-list">
        {data.trip.hotels.map((hotel, index) => (
          <div className="card hotel-card" key={hotel.id}>
            <div className="hotel-card-header">
              <div><div className="card-icon"><Hotel size={18} /></div><div><span className="eyebrow">STAY / BASE {index + 1}</span><strong>{hotel.name || 'Add a stay or address'}</strong></div></div>
              <button type="button" className="icon-button danger" title="Remove hotel" onClick={() => deleteHotel(hotel.id)}><Trash2 size={17} /></button>
            </div>
            <GooglePlacePicker compact placeholder="Search hotel or address…" onSelect={(place) => mapHotel(hotel.id, place)} />
            <MappedLocationSummary value={hotel} emptyText="Not mapped yet · optional for routing" />
            <div className="hotel-fields">
              <label className="hotel-name-field">Stay / base name<input placeholder="Hotel, friend's house, apartment…" value={hotel.name} onChange={(e) => updateHotel(hotel.id, { name: e.target.value })} /></label>
              <label className="hotel-address-field">Address<input placeholder="Optional manual address" value={hotel.address || ''} onChange={(e) => updateHotel(hotel.id, { address: e.target.value, source: hotel.googlePlaceId ? hotel.source : 'manual' })} /></label>
              <label>Check-in date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={hotel.checkInDate || ''} onChange={(e) => updateHotel(hotel.id, { checkInDate: e.target.value })} /></label>
              <label>Check-in time<input type="time" value={hotel.checkIn || ''} onChange={(e) => updateHotel(hotel.id, { checkIn: e.target.value })} /></label>
              <label>Check-out date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={hotel.checkOutDate || ''} onChange={(e) => updateHotel(hotel.id, { checkOutDate: e.target.value })} /></label>
              <label>Check-out time<input type="time" value={hotel.checkOut || ''} onChange={(e) => updateHotel(hotel.id, { checkOut: e.target.value })} /></label>
            </div>
          </div>
        ))}
      </div>
      </PlanAccordionSection>

      <PlanAccordionSection id="plan-places" icon={MapIcon} title="Places" subtitle={`${data.places.length} saved stop${data.places.length === 1 ? '' : 's'} · filter, edit, or add more`} open={openPlanSections.places} onToggle={() => togglePlanSection('places')}>
        <div className="plan-accordion-actions places-heading-actions">
          <label className="place-date-filter"><CalendarDays size={15} /><select value={placeDateFilter} onChange={(e) => setPlaceDateFilter(e.target.value)}><option value="all">All dates</option>{tripDatesForPlaces.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</select></label>
          <button type="button" className="primary-button" onClick={() => { if (showPlaceForm && !editingPlaceId) closePlaceForm(); else { setEditingPlaceId(null); setSelectedGooglePlace(null); setPlaceForm(createBlankPlaceForm(data.trip.startDate)); setShowPlaceForm(true) } }}><Plus size={17} /> Add place</button>
        </div>

      {showPlaceForm && (
        <form className="inline-form place-form card" onSubmit={addPlace}>
          <div className="form-full-width edit-place-form-title"><div><span className="eyebrow">{editingPlaceId ? 'EDIT PLACE' : 'ADD PLACE'}</span><strong>{editingPlaceId ? 'Update this stop' : 'Add a new stop'}</strong></div>{editingPlaceId && <button type="button" className="ghost-button" onClick={closePlaceForm}>Cancel edit</button>}</div>
          <div className="form-full-width"><GooglePlacePicker onSelect={selectGooglePlace} placeholder="Search place or address…" /></div>
          {!googleConfigured && <div className="form-full-width google-setup-warning">The app cannot see a Google demo key yet. Confirm <strong>.env.local</strong> contains <strong>VITE_GOOGLE_MAPS_API_KEY</strong>, then restart Vite.</div>}
          {selectedGooglePlace && (
            <div className="selected-place-preview form-full-width">
              <div className="selected-place-heading"><div className="place-pin"><MapPin size={19} /></div><div><span className="eyebrow">SELECTED PLACE</span><strong>{selectedGooglePlace.name}</strong><span>{selectedGooglePlace.address || 'Address unavailable'}</span></div></div>
              <div className="selected-place-meta">
                <span><Clock3 size={14} />{hoursForDate(selectedGooglePlace.regularOpeningHours, placeForm.visitDate).summary}</span>
                {selectedGooglePlace.primaryTypeDisplayName && <span>{selectedGooglePlace.primaryTypeDisplayName}</span>}
                {selectedGooglePlace.googleMapsURI && <a href={selectedGooglePlace.googleMapsURI} target="_blank" rel="noreferrer">Open map <ExternalLink size={13} /></a>}
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
          <label className="form-full-width">Notes <span className="optional-field-note">Optional</span><textarea rows="3" placeholder="Add reminders, booking details, food to try, links, or anything you want to remember…" value={placeForm.notes || ''} onChange={(e) => setPlaceForm({ ...placeForm, notes: e.target.value })} /></label>
          <label>Opens {hoursAreGoogleLocked ? '(Google)' : '(manual if unavailable)'}<input className={hoursAreGoogleLocked ? 'locked-google-time' : ''} type="time" value={placeForm.open || ''} readOnly={hoursAreGoogleLocked || placeIsClosed} disabled={hoursAreGoogleLocked || placeIsClosed} onChange={(e) => setPlaceForm({ ...placeForm, open: e.target.value, hoursStatus: 'manual', hoursSummary: 'Manual hours' })} /></label>
          <label>Closes {hoursAreGoogleLocked ? '(Google)' : '(manual if unavailable)'}<input className={hoursAreGoogleLocked ? 'locked-google-time' : ''} type="time" value={placeForm.close || ''} readOnly={hoursAreGoogleLocked || placeIsClosed} disabled={hoursAreGoogleLocked || placeIsClosed} onChange={(e) => setPlaceForm({ ...placeForm, close: e.target.value, hoursStatus: 'manual', hoursSummary: 'Manual hours' })} /></label>
          {placeForm.hoursSummary && <div className={`google-hours-note form-span-2 ${placeIsClosed ? 'closed-day' : ''}`}><Clock3 size={15} /><span>{'Hours'} for {formatDate(placeForm.visitDate)}: <strong>{placeForm.hoursSummary}</strong>{placeIsClosed && <em>Choose another day — this place cannot be added to this day's itinerary.</em>}</span></div>}
          {(placeFormError || directTimeProblem) && <div className="place-schedule-error form-full-width"><Clock3 size={16} /><div><strong>This stop cannot be added yet</strong><span>{placeFormError || directTimeProblem}</span></div></div>}
          <div className="form-actions"><button type="button" className="ghost-button" onClick={closePlaceForm}>Cancel</button><button type="submit" className="primary-button" disabled={placeIsClosed || Boolean(directTimeProblem)}>{editingPlaceId ? 'Update & sync to Today' : 'Save & sync to Today'}</button></div>
        </form>
      )}

      <div className="places-list">
        {visiblePlaces.map((place) => (
          <article className="place-row" key={place.id}>
            <div className="place-pin"><MapPin size={19} /></div>
            <div className="place-main">
              <div className="place-title-row"><strong>{place.name}</strong><PriorityPill priority={place.priority} /></div>
              <span>{place.category} · {place.duration} min · {formatDate(place.visitDate)}{place.timeSource === 'manual' && place.plannedStart ? ` at ${place.plannedStart}` : place.suggestedStart ? ` · Suggested ${place.suggestedStart}` : ' · Smart time pending'}</span>
              {place.address && <small className="place-address">{place.address}</small>}
              {place.notes && <small className="place-notes-preview">{place.notes}</small>}
            </div>
            <div className={`place-hours ${place.hoursStatus === 'closed' ? 'closed-day' : ''}`}><Clock3 size={15} /> {place.hoursSummary || `${place.open} — ${place.close}`}</div>
            <div className="place-actions">
              <button type="button" className="icon-button" title="Edit place" onClick={() => editPlace(place)}><Pencil size={16} /></button>
              {place.googleMapsURI && <a className="icon-button" title="Open map" href={place.googleMapsURI} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}
              <button type="button" className="icon-button danger" title="Delete place" onClick={() => deletePlace(place.id)}><Trash2 size={17} /></button>
            </div>
          </article>
        ))}
        {!visiblePlaces.length && <div className="empty-place-filter">No places scheduled for this date yet.</div>}
      </div>
      </PlanAccordionSection>

      <PlanAccordionSection id="plan-transport" icon={TrainFront} title="Transport" subtitle="Airport-to-stay comparison and routing" open={openPlanSections.transport} onToggle={() => togglePlanSection('transport')}>
      <div className={`card transfer-ready-card ${transferReady ? 'ready' : ''}`}>
        <div className="transfer-icon"><TrainFront size={22} /></div>
        <div className="transfer-copy">
          <span className="eyebrow">AIRPORT → FIRST STAY / BASE</span>
          <strong>{transferReady ? `${data.trip.arrival.location || 'Arrival point'} → ${firstHotel.name}` : 'Transport comparison becomes available after both locations are mapped.'}</strong>
          <p>{transferReady ? 'Compare available options by travel time, distance, and fare when available.' : 'This section is optional if you do not need airport-to-stay routing.'}</p>
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
      </PlanAccordionSection>

      <AppDialog
        open={Boolean(placeMoveDialog)}
        icon={CalendarDays}
        title="Move this stop to a better day?"
        message={placeMoveDialog ? `${placeMoveDialog.candidate?.name || 'This stop'} does not comfortably fit on ${formatDate(placeMoveDialog.candidate?.visitDate)}.` : ''}
        detail={placeMoveDialog ? `${placeMoveDialog.warning} We found room on ${formatDate(placeMoveDialog.nextDay?.date)} around ${placeMoveDialog.nextDay?.start}.` : ''}
        confirmLabel={placeMoveDialog ? `Move to ${formatShortDate(placeMoveDialog.nextDay?.date)}` : 'Move stop'}
        cancelLabel="Keep editing"
        onConfirm={confirmSuggestedPlaceMove}
        onCancel={() => {
          if (placeMoveDialog) setPlaceFormError(`${placeMoveDialog.warning} Suggested alternative: ${formatDate(placeMoveDialog.nextDay?.date)} around ${placeMoveDialog.nextDay?.start}.`)
          setPlaceMoveDialog(null)
        }}
      />
    </section>
  )
}

function TravelEndpointCard({ title, value, directionLabel, onChange, onPlaceSelect }) {
  const isArrival = title === 'Arrival'
  const directionField = isArrival ? 'from' : 'to'
  const timeLabel = isArrival ? 'Arrival time' : 'Departure time'

  return (
    <div className="card flight-card manual-flight-card">
      <div className="flight-card-header simplified-flight-header">
        <div className="card-icon"><Plane size={18} /></div>
        <div className="flight-title-line"><strong>Flight details · {title}</strong><span className="coming-soon-pill small">Tracking soon</span></div>
      </div>

      <div className="manual-flight-grid">
        <label className="flight-number-field">Flight number<input placeholder="Example: 5J312" value={value.flightNumber || ''} onChange={(e) => onChange({ flightNumber: e.target.value.toUpperCase() })} /></label>
        <label className="flight-direction-field">{directionLabel}<input placeholder="Example: Manila" value={value[directionField] || ''} onChange={(e) => onChange({ [directionField]: e.target.value })} /></label>
        <label className="flight-airline-field">Airline<input placeholder="Example: Cebu Pacific" value={value.airline || ''} onChange={(e) => onChange({ airline: e.target.value })} /></label>
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

  if (arrival.date === date && startPreference === 'arrival_stay' && isMapped(stay)) {
    const airportReady = addMinutes(arrival.time || '09:00', Number(arrival.transferBufferMinutes || 0))
    const transferToStay = isMapped(arrival) ? estimateTransferMinutes(arrival, stay) : { minutes: 15 }
    const stayArrivalTime = addMinutes(airportReady, transferToStay.minutes)
    items.push({ key: `arrival-stay-${stay.id || date}`, kind: 'stay', start: stayArrivalTime, end: '', title: `Stay/base · ${stay.name || 'Accommodation'}`, subtitle: stay.address || 'Stay/base', detail: 'First stop after the airport', mapUri: stay.googleMapsURI || '', locationData: stay, sort: stayArrivalTime || '00:01' })
  }

  if (startPreference === 'stay' && isMapped(stay)) {
    items.push({ key: `day-start-stay-${date}`, kind: 'start', start: '09:00', end: '', title: `Start · ${stay.name || 'Stay/base'}`, subtitle: stay.address || 'Stay/base', detail: 'Your day starts here', mapUri: stay.googleMapsURI || '', locationData: stay, sort: '00:01' })
  }

  ;(trip.hotels || []).forEach((hotel) => {
    if (hotel.checkInDate === date && startPreference !== 'stay' && !(startPreference === 'arrival_stay' && String(stay?.id) === String(hotel.id))) items.push({ key: `hotel-checkin-${hotel.id}`, kind: 'hotel', start: hotel.checkIn || '15:00', end: '', title: `Stay check-in · ${hotel.name || 'Accommodation'}`, subtitle: hotel.address || 'Accommodation', detail: 'Check-in', mapUri: hotel.googleMapsURI || '', locationData: hotel, sort: hotel.checkIn || '15:00' })
    if (hotel.checkOutDate === date) items.push({ key: `hotel-checkout-${hotel.id}`, kind: 'hotel', start: hotel.checkOut || '11:00', end: '', title: `Stay check-out · ${hotel.name || 'Accommodation'}`, subtitle: hotel.address || 'Accommodation', detail: 'Check-out', mapUri: hotel.googleMapsURI || '', locationData: hotel, sort: hotel.checkOut || '11:00' })
  })

  ;(data?.places || []).filter((place) => place.visitDate === date).forEach((place) => {
    const start = (place.timeSource === 'manual' ? place.plannedStart : (place.suggestedStart || place.plannedStart)) || ''
    items.push({ key: `place-${place.id}`, kind: 'place', start, end: start ? addMinutes(start, place.duration) : '', title: place.name || 'Place', subtitle: `${place.category || 'Place'} · ${place.duration || 60} min${place.priority ? ` · ${place.priority}` : ''}`, detail: place.hoursSummary || 'Hours unavailable', notes: place.notes || '', mapUri: place.googleMapsURI || '', locationData: place, sort: start || '98:59', suggestedTime: false, scheduleWarning: '' })
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
  const [arrangeDraft, setArrangeDraft] = useState(() => dayArrangementPreference(data, data.trip.startDate))
  const [openTodaySections, setOpenTodaySections] = useState({ planning: true, transfer: false, itinerary: true, transport: false })
  const [showTodayAddPlace, setShowTodayAddPlace] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [nearbyStatus, setNearbyStatus] = useState('idle')
  const [nearbyError, setNearbyError] = useState('')
  const [pendingRemovePlace, setPendingRemovePlace] = useState(null)

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
  const arrivalTransferReady = selectedDate === data.trip.arrival.date && selectedDayStart === 'arrival_stay' && isMapped(data.trip.arrival) && isMapped(selectedStay)

  const visibleNearbyPlaces = useMemo(
    () => nearbyPlaces.filter((place) => !isPlaceAlreadySaved(place, data.places || [])),
    [nearbyPlaces, data.places],
  )

  const recommendationAnchors = useMemo(() => {
    const seen = new Set()
    const anchors = []
    const addAnchor = (locationData, label) => {
      if (!isMapped(locationData)) return
      const key = `${Number(locationData.latitude).toFixed(5)},${Number(locationData.longitude).toFixed(5)}`
      if (seen.has(key)) return
      seen.add(key)
      anchors.push({ locationData, label })
    }
    items.forEach((item) => {
      if (item.kind === 'place') addAnchor(item.locationData, item.title)
    })
    if (!anchors.length && isMapped(selectedStay)) addAnchor(selectedStay, selectedStay.name || 'Stay/base')
    if (!anchors.length && isMapped(data.trip.arrival)) addAnchor(data.trip.arrival, data.trip.arrival.location || 'Arrival point')
    return anchors
  }, [items, selectedStay, data.trip.arrival])

  function toggleTodaySection(section) {
    setOpenTodaySections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  function addGooglePlaceToToday(place) {
    if (!place) return
    if (isPlaceAlreadySaved(place, data.places || [])) {
      setNearbyPlaces((prev) => prev.filter((item) => !isPlaceAlreadySaved(item, data.places || [])))
      setNearbyError(`${place.name || 'This place'} is already on your trip list.`)
      return
    }
    try {
      // Nearby search already gives us the place id, name, address, coordinates and type.
      // Do not make a second GetPlace request just to add it to today's checklist.
      const source = place
      let candidate = {
        ...createBlankPlaceForm(selectedDate),
        ...source,
        id: Date.now(),
        name: source.name || 'New place',
        category: inferPlaceCategory(source.primaryType, source.types),
        priority: 'High',
        duration: 60,
        visitDate: selectedDate,
        plannedStart: '',
        suggestedStart: '',
        timeSource: 'suggested',
        notes: '',
      }
      candidate = placeWithDateHours(candidate, selectedDate)
      setData((prev) => applySmartSuggestionsForDate({ ...prev, places: [...(prev.places || []), candidate] }, selectedDate))
      setShowTodayAddPlace(false)
      setNearbyPlaces((prev) => prev.filter((item) => item.googlePlaceId !== candidate.googlePlaceId))
    } catch (error) {
      console.error('Quick add place failed:', error)
      setNearbyError('This place could not be added right now. Try again or add it from Plan.')
    }
  }

  async function loadNearbyRecommendations() {
    if (!recommendationAnchors.length) {
      setNearbyError('Map at least one destination first so nearby ideas know where to look.')
      return
    }
    setNearbyStatus('loading')
    setNearbyError('')
    setNearbyPlaces([])

    const existingIds = new Set((data.places || []).map((place) => place.googlePlaceId).filter(Boolean))
    const deduped = new Map()
    const failures = []

    // Search anchors one at a time instead of bursting several requests at once. This is kinder to
    // demo quotas, and we stop early once there are enough useful suggestions to render.
    for (const anchor of recommendationAnchors) {
      try {
        const results = await searchGoogleNearbyPlaces({
          latitude: anchor.locationData.latitude,
          longitude: anchor.locationData.longitude,
          anchorName: anchor.label,
          minDistanceMeters: 0,
          maxDistanceMeters: 4000,
          maxResults: 10,
        })
        results.forEach((place) => {
          if (!place.googlePlaceId || existingIds.has(place.googlePlaceId)) return
          const candidate = { ...place, nearAnchor: anchor.label }
          const current = deduped.get(place.googlePlaceId)
          if (!current || Number(candidate.distanceMeters || Infinity) < Number(current.distanceMeters || Infinity)) {
            deduped.set(place.googlePlaceId, candidate)
          }
        })
      } catch (error) {
        console.error(`Nearby recommendations failed around ${anchor.label}:`, error)
        failures.push(error)
      }
      if (deduped.size >= 16) break
    }

    const results = [...deduped.values()]
      .sort((a, b) => Number(a.distanceMeters || Infinity) - Number(b.distanceMeters || Infinity))
      .slice(0, 16)

    setNearbyPlaces(results)
    if (results.length) {
      setNearbyStatus('ready')
      return
    }

    if (failures.length === recommendationAnchors.length) {
      setNearbyStatus('error')
      setNearbyError('Nearby suggestions could not load right now. Try again, or check whether your browser is blocking map requests.')
      return
    }

    setNearbyStatus('ready')
    setNearbyError('No matching places were found within 4 km of your mapped destinations.')
  }

  function requestRemovePlace(item) {
    if (item?.kind !== 'place') return
    const placeId = String(item.key).replace(/^place-/, '')
    const place = (data.places || []).find((entry) => String(entry.id) === placeId)
    if (!place) return
    setPendingRemovePlace(place)
  }

  function confirmRemovePlace() {
    if (!pendingRemovePlace) return
    const id = pendingRemovePlace.id
    setData((prev) => {
      const nextProgress = { ...(prev.progress || {}) }
      delete nextProgress[`place-${id}`]
      const next = {
        ...prev,
        places: (prev.places || []).filter((place) => String(place.id) !== String(id)),
        progress: nextProgress,
      }
      return applyAllSmartSuggestions(next)
    })
    setEditingTimeKey((current) => current === `place-${id}` ? '' : current)
    setPendingRemovePlace(null)
    setTimeEditError('')
  }

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
        <button type="button" className="secondary-button" disabled title="Reminders are planned for a later version"><AlarmClock size={17} /> Reminders later</button>
      </div>

      <div className="day-strip" aria-label="Trip days">
        {dates.map((date) => <button type="button" key={date} className={selectedDate === date ? 'active' : ''} onClick={() => setSelectedDate(date)}><span>{formatDayName(date)}</span><strong>{formatShortDate(date)}</strong></button>)}
      </div>

      <PlanAccordionSection
        id="today-planning"
        icon={Sparkles}
        title="Day setup & smart arrangement"
        subtitle={`${dayStartPreferenceLabel(selectedDayStart)} · ${arrangementLabel(activeArrangement)}`}
        open={openTodaySections.planning}
        onToggle={() => toggleTodaySection('planning')}
      >
        <div className="today-planning-panel accordion-content-card">
          <div className="today-planning-intro">
            <div>
              <strong>Plan the day's flow</strong>
              <p>Choose where you begin, how stops should be ordered, and whether the itinerary ends at the last destination or includes the trip back to your stay/base.</p>
            </div>
          </div>

          <div className="today-planning-grid">
            <label>
              <span>Start this day from</span>
              <select value={selectedDayStart} onChange={(e) => updateDayStartPreference(e.target.value)}>
                {isArrivalDay && <option value="arrival_stay" disabled={!isMapped(selectedStay)}>Airport → stay/base → places</option>}
                {isArrivalDay && <option value="arrival_places">Airport → first destination</option>}
                <option value="stay" disabled={!isMapped(selectedStay)}>Stay/base → places</option>
                <option value="first_place">Start at first destination</option>
              </select>
            </label>

            <label>
              <span>Arrange stops by</span>
              <select value={arrangeDraft.strategy} onChange={(e) => setArrangeDraft((prev) => ({ ...prev, strategy: e.target.value }))}>
                <option value="balanced">Balanced: distance + closing time</option>
                <option value="nearest">Nearest first</option>
                <option value="closing">Earlier closing first</option>
              </select>
            </label>

            <label>
              <span>Finish the day</span>
              <select value={arrangeDraft.endMode} onChange={(e) => setArrangeDraft((prev) => ({ ...prev, endMode: e.target.value, endPlaceId: e.target.value === 'place' ? prev.endPlaceId : '' }))}>
                <option value="none">At the final destination</option>
                {isMapped(selectedStay) && <option value="stay">Return to stay / home base</option>}
                <option value="shopping">At a shopping stop</option>
                <option value="place">At a specific place</option>
              </select>
            </label>

            {arrangeDraft.endMode === 'place' && (
              <label>
                <span>Choose the final place</span>
                <select value={arrangeDraft.endPlaceId || ''} onChange={(e) => setArrangeDraft((prev) => ({ ...prev, endPlaceId: e.target.value }))}>
                  <option value="">Choose a place</option>
                  {(data.places || []).filter((place) => place.visitDate === selectedDate && place.hoursStatus !== 'closed').map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="today-planning-summary">
            <MapPin size={15} />
            <span>
              <strong>{dayStartPreferenceLabel(selectedDayStart)}</strong>
              <small>
                {selectedDayStart === 'arrival_stay' && selectedStay
                  ? `${data.trip.arrival.location || 'Arrival point'} → ${selectedStay.name || 'Stay/base'} → your first stop`
                  : selectedDayStart === 'arrival_places'
                    ? `${data.trip.arrival.location || 'Arrival point'} → your first stop`
                    : selectedDayStart === 'stay' && selectedStay
                      ? `${selectedStay.name || 'Stay/base'} → your first stop`
                      : 'The first attraction becomes the starting point for the day.'}
              </small>
            </span>
          </div>

          <div className={`today-endpoint-note ${arrangeDraft.endMode === 'stay' ? 'return-base' : ''}`}>
            <Navigation size={15} />
            <span>
              <strong>{arrangeDraft.endMode === 'stay' ? 'Return trip included' : arrangeDraft.endMode === 'none' ? 'Ends at the final destination' : 'Preferred final stop'}</strong>
              <small>
                {arrangeDraft.endMode === 'stay'
                  ? `Today will add ${selectedStay?.name || 'your stay/base'} after the last destination so you can see the travel time back.`
                  : arrangeDraft.endMode === 'none'
                    ? 'No return-to-base leg is added after your final planned destination.'
                    : arrangeDraft.endMode === 'shopping'
                      ? 'Smart arrangement will try to keep a shopping stop as the final destination.'
                      : 'Smart arrangement will keep your selected place as the final destination.'}
              </small>
            </span>
          </div>

          <div className="today-planning-actions">
            <button type="button" className="primary-button" onClick={applyArrangement} disabled={arrangeDraft.endMode === 'place' && !arrangeDraft.endPlaceId}><Sparkles size={16} /> Apply smart arrangement</button>
          </div>
        </div>
      </PlanAccordionSection>

      {dayPlan.error && (
        <div className="today-recovery-banner">
          <Sparkles size={17} /><div><strong>Today recovered safely</strong><span>The smart scheduler hit an unexpected data issue, so the app is showing the basic itinerary instead of a white screen.</span></div>
        </div>
      )}

      {arrivalTransferReady && (
        <PlanAccordionSection id="today-first-transfer" icon={TrainFront} title="First transfer" subtitle={`${data.trip.arrival.location || 'Airport'} → ${selectedStay?.name || 'Stay/base'}`} open={openTodaySections.transfer} onToggle={() => toggleTodaySection('transfer')}>
          <div className="card arrival-day-transfer accordion-inner-card">
            <div className="transfer-icon"><TrainFront size={22} /></div>
            <div><strong>{data.trip.arrival.location} → {selectedStay?.name || 'Stay/base'}</strong><p>Your selected day-start flow goes to the stay/base before the first destination.</p></div>
            <div className="transfer-route-full">
              <InAppRouteRecommendations
                origin={data.trip.arrival}
                destination={selectedStay}
                date={data.trip.arrival.date}
                time={data.trip.arrival.time}
                utcOffsetMinutes={data.trip.arrival.utcOffsetMinutes ?? selectedStay?.utcOffsetMinutes}
                bufferMinutes={data.trip.arrival.transferBufferMinutes || 0}
                compact
              />
            </div>
          </div>
        </PlanAccordionSection>
      )}

      <PlanAccordionSection
        id="today-itinerary"
        icon={ListChecks}
        title="Travel checklist"
        subtitle={`${items.length} stop${items.length === 1 ? '' : 's'} · ${doneCount} completed`}
        open={openTodaySections.itinerary}
        onToggle={() => toggleTodaySection('itinerary')}
      >
        <div className="timeline-card card accordion-inner-card">
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
                const nextTimelineItem = items[index + 1]
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
                      <div className={`timeline-title-row ${item.kind === 'place' ? 'with-place-photo' : ''}`}>
                        <div className="timeline-title-copy"><strong>{item.title}</strong><span>{item.subtitle}</span><small>{item.detail}</small>{item.notes && <p className="timeline-place-notes">{item.notes}</p>}</div>
                        {item.kind === 'place' && <PlacePhoto placeId={item.locationData?.googlePlaceId} place={item.locationData} name={item.title} className="timeline-place-photo" />}
                        <StatusPill status={status} />
                      </div>
                      {item.scheduleWarning && nextDaySuggestion && (
                        <div className="timeline-move-suggestion">
                          <CalendarDays size={15} />
                          <div><strong>Better on {formatDate(nextDaySuggestion.date)}</strong><span>Suggested around {nextDaySuggestion.start}{nextDaySuggestion.end ? `–${nextDaySuggestion.end}` : ''} because it does not fit comfortably today.</span></div>
                          <button type="button" className="ghost-button" onClick={() => movePlaceToDay(item, nextDaySuggestion)}>Move</button>
                        </div>
                      )}
                      {(() => {
                        const mapUri = item.mapUri || googlePlaceMapUrl(item.locationData)
                        const placeActionsClass = item.kind === 'place' ? ' stop-actions' : ''
                        if (status === 'current' || status === 'upcoming') {
                          return <div className={`timeline-actions${placeActionsClass}`}><button type="button" className="primary-button" onClick={() => setStatus(item.key, 'done')}><CheckCircle2 size={17} /> Done</button><button type="button" className="ghost-button" onClick={() => setStatus(item.key, 'skipped')}>Skip</button>{mapUri && <a className="secondary-button" href={mapUri} target="_blank" rel="noreferrer"><Navigation size={17} /> Map</a>}{item.kind === 'place' && <button type="button" className="ghost-button remove-stop" onClick={() => requestRemovePlace(item)}><Trash2 size={15} /> Remove</button>}</div>
                        }
                        if (status === 'done' || status === 'skipped') {
                          return <div className={`timeline-actions timeline-recovery-actions${placeActionsClass}`}><button type="button" className="ghost-button" onClick={() => undoStatus(item.key)}><RotateCcw size={15} /> {status === 'done' ? 'Undo done' : 'Undo skip'}</button>{mapUri && <a className="secondary-button" href={mapUri} target="_blank" rel="noreferrer"><Navigation size={15} /> Map</a>}{item.kind === 'place' && <button type="button" className="ghost-button remove-stop" onClick={() => requestRemovePlace(item)}><Trash2 size={15} /> Remove</button>}</div>
                        }
                        return null
                      })()}
                      {nextTimelineItem && isMapped(item.locationData) && isMapped(nextTimelineItem.locationData) && (
                        <TimelineLegSummary
                          origin={item.locationData}
                          destination={nextTimelineItem.locationData}
                          date={selectedDate}
                          time={item.end || item.start}
                          utcOffsetMinutes={item.locationData.utcOffsetMinutes ?? nextTimelineItem.locationData.utcOffsetMinutes}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <div className="empty-day"><CalendarDays size={25} /><strong>No plans yet</strong><span>Add a place below. If you leave the time blank, Today will suggest one automatically.</span></div>}

          <div className="today-add-place-block">
            <button type="button" className="secondary-button today-add-place-button" onClick={() => setShowTodayAddPlace((value) => !value)}><Plus size={17} /> Add place</button>
            {showTodayAddPlace && (
              <div className="today-add-place-panel">
                <div className="today-add-place-search">
                  <GooglePlacePicker onSelect={addGooglePlaceToToday} placeholder="Search for a place…" compact />
                </div>
              </div>
            )}

            <div className="nearby-discovery">
              <div className="nearby-head">
                <div><strong>Nearby ideas</strong><span>{recommendationAnchors.length ? `Within 4 km of any mapped destination on ${formatShortDate(selectedDate)}` : 'Map a destination to discover nearby places'}</span></div>
                <button
                  type="button"
                  className="ghost-button nearby-refresh"
                  onClick={loadNearbyRecommendations}
                  disabled={nearbyStatus === 'loading' || !recommendationAnchors.length}
                  data-debug-reason={nearbyStatus === 'loading' ? 'Nearby search is already running.' : !recommendationAnchors.length ? 'No mapped itinerary stop has coordinates yet. Map at least one destination first.' : ''}
                  title={!recommendationAnchors.length ? 'Map at least one itinerary destination first' : ''}
                >
                  {nearbyStatus === 'loading' ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} {nearbyStatus === 'loading' ? 'Finding…' : visibleNearbyPlaces.length ? 'Refresh' : 'Find ideas'}
                </button>
              </div>
              {nearbyStatus === 'loading' && <div className="nearby-message nearby-loading">Looking around your mapped stops for useful places…</div>}
              {nearbyError && <div className="nearby-message">{nearbyError}</div>}
              {visibleNearbyPlaces.length > 0 && (
                <>
                  <div className="nearby-list">
                    {visibleNearbyPlaces.map((place) => (
                      <article className="nearby-card" key={place.googlePlaceId || place.name}>
                        <PlacePhoto placeId={place.googlePlaceId} place={place} name={place.name} className="nearby-photo" />
                        <div className="nearby-distance">
                          {formatNearbyDistance(place.distanceMeters)}
                        </div>
                        <button type="button" className="nearby-add" title={`Add ${place.name}`} aria-label={`Add ${place.name}`} onClick={() => addGooglePlaceToToday(place)}><Plus size={18} strokeWidth={2.35} /></button>
                        <div className="nearby-info">
                          <strong>{place.name}</strong>
                          <span>{place.primaryTypeDisplayName || inferPlaceCategory(place.primaryType, place.types)}</span>
                          <small><MapPin size={12} /><span>{place.nearAnchor ? `Near ${place.nearAnchor}` : 'Near your itinerary'}</span></small>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="maps-attribution nearby-credit" aria-label="Google Maps attribution">Google Maps</div>
                </>
              )}
            </div>
          </div>
        </div>
      </PlanAccordionSection>

      {items.filter((item) => isMapped(item.locationData)).length >= 2 && (
        <PlanAccordionSection id="today-transport" icon={TrainFront} title="Transport between stops" subtitle="Travel time and options between each stop" open={openTodaySections.transport} onToggle={() => toggleTodaySection('transport')}>
          <div className="card day-route-card accordion-inner-card">
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
        </PlanAccordionSection>
      )}

      <AppDialog
        open={Boolean(pendingRemovePlace)}
        title="Remove this place from the checklist?"
        message={pendingRemovePlace ? `${pendingRemovePlace.name || 'This place'} will be removed from this trip day's saved places and Today checklist.` : ''}
        detail="You can add it again later from Nearby ideas or Plan."
        confirmLabel="Remove place"
        cancelLabel="Keep place"
        tone="danger"
        icon={Trash2}
        onCancel={() => setPendingRemovePlace(null)}
        onConfirm={confirmRemovePlace}
      />
    </section>
  )
}

function BudgetView({ data, setData, shoppingSpent, shoppingPlanned, totalSpent, remaining, expenseSpent }) {
  const tripDates = useMemo(() => enumerateDates(data.trip.startDate, data.trip.endDate), [data.trip.startDate, data.trip.endDate])
  const [selectedDate, setSelectedDate] = useState(() => data.trip.startDate || tripDates[0] || '')
  const [showShoppingForm, setShowShoppingForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [openBudgetSections, setOpenBudgetSections] = useState({ limits: true, discounts: false, daily: true, shopping: false })
  const [selectedShoppingLocation, setSelectedShoppingLocation] = useState('all')
  const [shoppingForm, setShoppingForm] = useState({ name: '', planned: 0, quantity: 1, priority: 'Want', purchaseDate: '', location: '' })
  const [expenseForm, setExpenseForm] = useState({ date: data.trip.startDate || '', category: 'Food', note: '', amount: 0 })
  const [showDiscountForm, setShowDiscountForm] = useState(false)
  const [discountForm, setDiscountForm] = useState({ label: '', amount: 0, date: '', code: '' })
  const discounts = Array.isArray(data.budget?.discounts) ? data.budget.discounts : []
  const discountSavings = discounts.reduce((sum, item) => sum + Number(item.amount || 0), 0)
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

  function addDiscount(event) {
    event.preventDefault()
    if (!discountForm.label.trim() || !Number(discountForm.amount)) return
    const next = { ...discountForm, id: Date.now(), label: discountForm.label.trim(), amount: Number(discountForm.amount) }
    setData((prev) => ({ ...prev, budget: { ...prev.budget, discounts: [...(prev.budget.discounts || []), next] } }))
    setDiscountForm({ label: '', amount: 0, date: '', code: '' })
    setShowDiscountForm(false)
  }

  function deleteDiscount(id) {
    setData((prev) => ({ ...prev, budget: { ...prev.budget, discounts: (prev.budget.discounts || []).filter((item) => item.id !== id) } }))
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
      <div className="section-heading"><div><span className="eyebrow">WHOLE STAY</span><h2>Trip budget</h2><p>See the whole-trip picture, then open only the section you need.</p></div></div>
      <div className="budget-summary-grid">
        <BudgetMetric icon={CircleDollarSign} label="Trip budget" value={formatMoney(data.budget.total, data.trip.currency)} hint={`${percentage}% used`} />
        <BudgetMetric icon={WalletCards} label="Spent so far" value={formatMoney(totalSpent, data.trip.currency)} hint={`${formatMoney(expenseSpent, data.trip.currency)} logged by day`} />
        <BudgetMetric icon={Sparkles} label="Remaining" value={formatMoney(remaining, data.trip.currency)} hint={remaining >= 0 ? 'Still within budget' : 'Over budget'} positive={remaining >= 0} />
        <BudgetMetric icon={CircleDollarSign} label="Discount savings" value={formatMoney(discountSavings, data.trip.currency)} hint={discounts.length ? `${discounts.length} discount${discounts.length === 1 ? '' : 's'} tracked` : 'No discounts yet'} positive={discountSavings > 0} />
      </div>

      <PlanAccordionSection id="budget-limits" icon={CircleDollarSign} title="Budget settings" subtitle={`${data.trip.currency} · ${formatMoney(data.budget.total, data.trip.currency)} whole-stay budget`} open={openBudgetSections.limits} onToggle={() => setOpenBudgetSections((prev) => ({ ...prev, limits: !prev.limits }))}>
        <div className="card budget-control-card accordion-inner-card">
          <div className="budget-fields budget-fields-with-currency">
            <label>Currency<select value={data.trip.currency || 'NT$'} onChange={(e) => setData((prev) => ({ ...prev, trip: { ...prev.trip, currency: e.target.value } }))}>{CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Total trip budget ({data.trip.currency})<input type="number" min="0" value={data.budget.total} onChange={(e) => updateBudget('total', e.target.value)} /></label>
            <label>Shopping budget ({data.trip.currency})<input type="number" min="0" value={data.budget.shopping} onChange={(e) => updateBudget('shopping', e.target.value)} /></label>
            <label>Unassigned / older spending ({data.trip.currency})<input type="number" min="0" value={data.budget.spentOther} onChange={(e) => updateBudget('spentOther', e.target.value)} /></label>
          </div>
          <ProgressBar value={percentage} label={`Whole stay · ${percentage}%`} />
        </div>
      </PlanAccordionSection>

      <PlanAccordionSection id="budget-discounts" icon={Sparkles} title="Discounts & savings" subtitle={`${formatMoney(discountSavings, data.trip.currency)} saved · ${discounts.length} tracked`} open={openBudgetSections.discounts} onToggle={() => setOpenBudgetSections((prev) => ({ ...prev, discounts: !prev.discounts }))}>
        <div className="accordion-section-actions"><p>Track coupons, vouchers, promos, and other savings. Enter the amount saved; actual spending should remain the amount you really paid.</p><button type="button" className="secondary-button" onClick={() => setShowDiscountForm((value) => !value)}><Plus size={17} /> Add discount</button></div>
        {showDiscountForm && <form className="inline-form card discount-form" onSubmit={addDiscount}><label className="form-span-2">Discount<input autoFocus placeholder="Example: Klook voucher" value={discountForm.label} onChange={(e) => setDiscountForm({ ...discountForm, label: e.target.value })} /></label><label>Savings amount ({data.trip.currency})<input type="number" min="0" value={discountForm.amount} onChange={(e) => setDiscountForm({ ...discountForm, amount: e.target.value })} /></label><label>Date <span className="optional-field-note">Optional</span><input type="date" min={data.trip.startDate} max={data.trip.endDate} value={discountForm.date || ''} onChange={(e) => setDiscountForm({ ...discountForm, date: e.target.value })} /></label><label className="form-span-2">Promo / code <span className="optional-field-note">Optional</span><input placeholder="Example: TAIWAN10" value={discountForm.code || ''} onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value })} /></label><div className="form-actions"><button type="button" className="ghost-button" onClick={() => setShowDiscountForm(false)}>Cancel</button><button className="primary-button" type="submit">Save discount</button></div></form>}
        <div className="card discount-list-card accordion-inner-card">
          <div className="discount-list-head"><div><span className="eyebrow">TOTAL SAVED</span><strong>{formatMoney(discountSavings, data.trip.currency)}</strong></div><span>{discounts.length ? `${discounts.length} tracked` : 'No discounts added yet'}</span></div>
          {discounts.length > 0 && <div className="discount-list">{discounts.map((item) => <div className="discount-row" key={item.id}><div><strong>{item.label}</strong><span>{[item.date ? formatDate(item.date) : '', item.code ? `Code: ${item.code}` : ''].filter(Boolean).join(' · ') || 'Savings'}</span></div><strong className="positive-text">+{formatMoney(item.amount, data.trip.currency)}</strong><button type="button" className="icon-button danger" title="Delete discount" onClick={() => deleteDiscount(item.id)}><Trash2 size={15} /></button></div>)}</div>}
        </div>
      </PlanAccordionSection>

      <PlanAccordionSection id="budget-daily" icon={CalendarDays} title="Daily budget & expense log" subtitle={`${formatMoney(selectedSpent, data.trip.currency)} spent on ${formatShortDate(selectedDate)}`} open={openBudgetSections.daily} onToggle={() => setOpenBudgetSections((prev) => ({ ...prev, daily: !prev.daily }))}>
        <div className="accordion-section-actions"><p>Default daily target is the total budget divided across {tripDates.length || 0} trip days. You can override each day.</p><button type="button" className="primary-button" onClick={() => { setExpenseForm((prev) => ({ ...prev, date: selectedDate })); setShowExpenseForm((value) => !value) }}><Plus size={17} /> Log expense</button></div>
        <div className="budget-day-strip">
          {tripDates.map((date) => {
            const spent = spentOnDate(date)
            const target = Number(data.budget.dailyTargets?.[date] ?? defaultDailyTarget)
            return <button type="button" key={date} className={selectedDate === date ? 'active' : ''} onClick={() => setSelectedDate(date)}><span>{formatDayName(date)}</span><strong>{formatShortDate(date)}</strong><small>{formatMoney(spent, data.trip.currency)} / {formatMoney(Math.round(target), data.trip.currency)}</small></button>
          })}
        </div>
        <div className="card daily-budget-card accordion-inner-card">
          <div className="daily-budget-head"><div><span className="eyebrow">{formatDate(selectedDate)}</span><h3>{formatMoney(selectedSpent, data.trip.currency)} spent today</h3></div><label>Day budget<input type="number" min="0" value={Math.round(selectedTarget)} onChange={(e) => updateDailyTarget(selectedDate, e.target.value)} /></label></div>
          <div className="daily-budget-metrics"><div><span>Budget</span><strong>{formatMoney(selectedTarget, data.trip.currency)}</strong></div><div><span>Spent</span><strong>{formatMoney(selectedSpent, data.trip.currency)}</strong></div><div><span>Remaining</span><strong className={selectedRemaining < 0 ? 'negative-text' : 'positive-text'}>{formatMoney(selectedRemaining, data.trip.currency)}</strong></div></div>
          <ProgressBar value={selectedTarget > 0 ? Math.min(100, Math.round((selectedSpent / selectedTarget) * 100)) : 0} />
          <div className="daily-expense-list">
            {selectedExpenses.map((item) => <div className="daily-expense-row" key={item.id}><div><strong>{item.note || item.category}</strong><span>{item.category}</span></div><strong>{formatMoney(item.amount, data.trip.currency)}</strong><button type="button" className="icon-button danger" onClick={() => deleteExpense(item.id)}><Trash2 size={15} /></button></div>)}
            {!selectedExpenses.length && <div className="empty-budget-day">No day-specific expenses logged yet.</div>}
          </div>
        </div>
        {showExpenseForm && <form className="inline-form card expense-form" onSubmit={addExpense}><label>Date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></label><label>Expense type<select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}><option>Food</option><option>Transport</option><option>Attraction</option><option>Shopping</option><option>Accommodation</option><option>Flights</option><option>Fees</option><option>Souvenirs</option><option>Emergency</option><option>Other</option></select></label><label className="form-span-2">Description<input placeholder="Example: Dinner at night market" value={expenseForm.note} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} /></label><label>Amount ({data.trip.currency})<input type="number" min="0" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></label><div className="form-actions"><button type="button" className="ghost-button" onClick={() => setShowExpenseForm(false)}>Cancel</button><button className="primary-button" type="submit">Save expense</button></div></form>}
      </PlanAccordionSection>

      <PlanAccordionSection id="budget-shopping" icon={ShoppingBag} title="Things to buy" subtitle={`${formatMoney(shoppingPlanned, data.trip.currency)} planned · ${formatMoney(shoppingSpent, data.trip.currency)} spent`} open={openBudgetSections.shopping} onToggle={() => setOpenBudgetSections((prev) => ({ ...prev, shopping: !prev.shopping }))}>
        <div className="accordion-section-actions"><p>Track planned purchases, actual prices, dates, and shopping locations.</p><button type="button" className="primary-button" onClick={() => setShowShoppingForm((value) => !value)}><Plus size={17} /> Add item</button></div>
        {showShoppingForm && <form className="inline-form card" onSubmit={addShopping}><label className="form-span-2">Item<input placeholder="Example: Shoes from outlet" value={shoppingForm.name} onChange={(e) => setShoppingForm({ ...shoppingForm, name: e.target.value })} autoFocus /></label><label className="form-span-2">Where to buy <span className="optional-field-note">Optional</span><input placeholder="Example: Mitsui Outlet Park, Ximending, night market…" value={shoppingForm.location || ''} onChange={(e) => setShoppingForm({ ...shoppingForm, location: e.target.value })} /></label><label>Planned price<input type="number" min="0" value={shoppingForm.planned} onChange={(e) => setShoppingForm({ ...shoppingForm, planned: e.target.value })} /></label><label>Quantity<input type="number" min="1" value={shoppingForm.quantity} onChange={(e) => setShoppingForm({ ...shoppingForm, quantity: e.target.value })} /></label><label>Priority<select value={shoppingForm.priority} onChange={(e) => setShoppingForm({ ...shoppingForm, priority: e.target.value })}><option>Must Buy</option><option>Want</option><option>If Budget Allows</option></select></label><label>Purchase date (optional)<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={shoppingForm.purchaseDate || ''} onChange={(e) => setShoppingForm({ ...shoppingForm, purchaseDate: e.target.value })} /></label><div className="form-actions"><button type="button" className="ghost-button" onClick={() => setShowShoppingForm(false)}>Cancel</button><button type="submit" className="primary-button">Save item</button></div></form>}
        <div className="shopping-location-tabs" aria-label="Shopping locations">
          <button type="button" className={selectedShoppingLocation === 'all' ? 'active' : ''} onClick={() => setSelectedShoppingLocation('all')}><ShoppingBag size={14} /><span>All</span><small>{data.shopping.length}</small></button>
          {shoppingLocations.map((location) => <button type="button" key={location} className={selectedShoppingLocation === location ? 'active' : ''} onClick={() => setSelectedShoppingLocation(location)}><MapPin size={14} /><span>{location}</span><small>{data.shopping.filter((item) => String(item.location || '').trim() === location).length}</small></button>)}
          {hasUnassignedShopping && <button type="button" className={selectedShoppingLocation === '__unassigned' ? 'active' : ''} onClick={() => setSelectedShoppingLocation('__unassigned')}><MapPin size={14} /><span>No location</span><small>{data.shopping.filter((item) => !String(item.location || '').trim()).length}</small></button>}
        </div>
        <div className="card shopping-card accordion-inner-card">
          <div className="shopping-progress-header"><div><strong>Shopping budget</strong><span>{formatMoney(data.budget.shopping - shoppingSpent, data.trip.currency)} remaining</span></div><strong>{shoppingPercentage}%</strong></div>
          <ProgressBar value={shoppingPercentage} />
          <div className="shopping-list">
            {visibleShopping.map((item) => {
              const linePlan = item.planned * item.quantity
              const difference = item.bought ? linePlan - item.actual : 0
              return <div className={`shopping-row ${item.bought ? 'bought' : ''}`} key={item.id}><button type="button" className={`check-button ${item.bought ? 'checked' : ''}`} onClick={() => updateShopping(item.id, { bought: !item.bought })}>{item.bought && <Check size={15} />}</button><div className="shopping-main"><div className="shopping-name-row"><strong>{item.name}</strong><PriorityPill priority={item.priority} /></div><span>Planned {formatMoney(linePlan, data.trip.currency)} · Qty {item.quantity}</span>{item.location && <span><MapPin size={12} /> {item.location}</span>}{item.purchaseDate && <span>{formatDate(item.purchaseDate)}</span>}{item.bought && <span className={difference >= 0 ? 'positive-text' : 'negative-text'}>{difference >= 0 ? `${formatMoney(difference, data.trip.currency)} under plan` : `${formatMoney(Math.abs(difference), data.trip.currency)} over plan`}</span>}</div><label className="actual-price-field">Actual<div><span>{data.trip.currency}</span><input type="number" min="0" value={item.actual} onChange={(e) => updateShopping(item.id, { actual: Number(e.target.value) })} /></div></label><label className="shopping-date-field">Date<input type="date" min={data.trip.startDate} max={data.trip.endDate} value={item.purchaseDate || ''} onChange={(e) => updateShopping(item.id, { purchaseDate: e.target.value })} /></label><button type="button" className="icon-button danger shopping-delete-button" title="Delete item" onClick={() => deleteShopping(item.id)}><Trash2 size={17} /></button></div>
            })}
          </div>
        </div>
        {shoppingSpent > data.budget.shopping && <div className="warning-card"><strong>Shopping budget exceeded by {formatMoney(shoppingSpent - data.budget.shopping, data.trip.currency)}.</strong><span>You can still continue — this is a warning, not a spending lock.</span></div>}
      </PlanAccordionSection>
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
  const [openChecklistSections, setOpenChecklistSections] = useState({ packing: true, shopping: false })

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
      <div className="section-heading checklist-main-heading"><div><span className="eyebrow">TRAVEL CHECKLIST</span><h2>{data.trip.name}</h2><p>{packingDone} of {data.packing.length} packed · {buyDone} of {data.shopping.length} shopping items bought.</p></div></div>

      <PlanAccordionSection id="checklist-packing" icon={PackageCheck} title="Things to bring" subtitle={`${packingDone}/${data.packing.length} packed · ${bags.length} bag${bags.length === 1 ? '' : 's'}`} open={openChecklistSections.packing} onToggle={() => setOpenChecklistSections((prev) => ({ ...prev, packing: !prev.packing }))} badge={<span className="coming-soon-pill small">Smart suggestions · Soon</span>}>
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
        <div className="bag-organizer-card bag-panel accordion-inner-card">
          {bags.filter((bag) => bag.id === selectedBagId).map((bag) => (
            <div key={bag.id}>
              <div className="bag-organizer-head"><label>Bag name<input value={bag.name} onChange={(e) => renameBag(bag.id, e.target.value)} /></label>{bags.length > 1 && <button type="button" className="icon-button danger bag-delete-button" title={`Remove ${bag.name}`} aria-label={`Remove ${bag.name}`} onClick={() => deleteBag(bag.id)}><Trash2 size={17} /></button>}</div>
              <div className="checklist-items bag-checklist-items">
                {data.packing.filter((item) => item.bagId === bag.id).map((item) => <div className={`checklist-item bag-item ${item.checked ? 'checked' : ''}`} key={item.id}><label><input type="checkbox" checked={item.checked} onChange={() => togglePacking(item.id)} /><span>{item.name}</span></label><button type="button" className="icon-button danger" onClick={() => deletePacking(item.id)}><Trash2 size={14} /></button></div>)}
                {!data.packing.some((item) => item.bagId === bag.id) && <div className="empty-bag">Nothing assigned to this bag yet.</div>}
              </div>
              <form className="quick-add" onSubmit={addPacking}><input placeholder={`Add item to ${bag.name}...`} value={packingText} onChange={(e) => setPackingText(e.target.value)} /><button className="icon-button primary" type="submit"><Plus size={18} /></button></form>
            </div>
          ))}
        </div>
        <div className="card checklist-info smart-checklist-coming-soon"><Sparkles size={21} /><div><div className="smart-checklist-title"><strong>Future smart checklist</strong><span className="coming-soon-pill small">Coming soon</span></div><span>Suggested items based on destination, weather, trip length, activities, airline baggage rules, and which bag an item belongs in.</span></div></div>
      </PlanAccordionSection>

      <PlanAccordionSection id="checklist-shopping" icon={ShoppingBag} title="Things to buy" subtitle={`${buyDone}/${data.shopping.length} bought · linked to Budget`} open={openChecklistSections.shopping} onToggle={() => setOpenChecklistSections((prev) => ({ ...prev, shopping: !prev.shopping }))}>
        <div className="shopping-location-tabs compact" aria-label="Shopping locations">
          <button type="button" className={selectedBuyLocation === 'all' ? 'active' : ''} onClick={() => setSelectedBuyLocation('all')}><ShoppingBag size={14} /><span>All</span><small>{data.shopping.length}</small></button>
          {buyLocations.map((location) => <button type="button" key={location} className={selectedBuyLocation === location ? 'active' : ''} onClick={() => setSelectedBuyLocation(location)}><MapPin size={14} /><span>{location}</span><small>{data.shopping.filter((item) => String(item.location || '').trim() === location).length}</small></button>)}
          {hasUnassignedBuy && <button type="button" className={selectedBuyLocation === '__unassigned' ? 'active' : ''} onClick={() => setSelectedBuyLocation('__unassigned')}><MapPin size={14} /><span>No location</span><small>{data.shopping.filter((item) => !String(item.location || '').trim()).length}</small></button>}
        </div>
        <div className="card checklist-card shopping-checklist-wide accordion-inner-card">
          <div className="checklist-items buy-checklist">{visibleBuyItems.map((item) => <label className={`checklist-item ${item.bought ? 'checked' : ''}`} key={item.id}><input type="checkbox" checked={item.bought} onChange={() => toggleBuy(item.id)} /><span><strong>{item.name}</strong><small>{formatMoney(item.planned * item.quantity, data.trip.currency)} planned{item.location ? ` · ${item.location}` : ''}</small></span></label>)}</div>
          <form className="quick-add buy-add buy-add-with-location" onSubmit={addBuy}><input placeholder="Add something to buy..." value={buyText} onChange={(e) => setBuyText(e.target.value)} /><input className="buy-location-input" placeholder="Where? (optional)" value={buyLocation} onChange={(e) => setBuyLocation(e.target.value)} /><div className="money-mini-input"><span>{data.trip.currency}</span><input type="number" min="0" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} /></div><button className="icon-button primary" type="submit"><Plus size={18} /></button></form>
        </div>
      </PlanAccordionSection>
    </section>
  )
}


function TripExportMenu({ data }) {
  const [open, setOpen] = useState(false)
  const [exportError, setExportError] = useState('')

  function run(action) {
    setOpen(false)
    if (action === exportTripPdf) {
      action(data, setExportError)
      return
    }
    action(data)
  }

  return (
    <div className="trip-export-menu">
      <button type="button" className="secondary-button trip-export-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ExternalLink size={16} /> Export
      </button>
      {open && (
        <div className="trip-export-popover" role="menu">
          <button type="button" onClick={() => run(exportTripPdf)}>PDF report</button>
          <button type="button" onClick={() => run(exportTripCsv)}>CSV · Sheets friendly</button>
          <button type="button" onClick={() => run(exportTripExcel)}>Excel</button>
        </div>
      )}
      <AppDialog
        open={Boolean(exportError)}
        icon={ExternalLink}
        title="Export needs another format"
        message={exportError}
        detail="Your trip is still safe. CSV and Excel exports remain available."
        confirmLabel="Okay"
        hideCancel
        onConfirm={() => setExportError('')}
        onCancel={() => setExportError('')}
      />
    </div>
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

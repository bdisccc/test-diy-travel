import { formatDate, formatMoney } from '../../utils/formatters.js'

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

export function exportTripCsv(data) {
  const csv = reportRows(data)
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\r\n')
  downloadTextFile(safeReportFilename(data?.trip?.name, 'csv'), `\ufeff${csv}`, 'text/csv;charset=utf-8')
}

export function exportTripExcel(data) {
  const rows = reportRows(data)
  const table = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse}td{border:1px solid #ddd;padding:7px;vertical-align:top}</style></head><body><table>${table}</table></body></html>`
  downloadTextFile(safeReportFilename(data?.trip?.name, 'xls'), `\ufeff${html}`, 'application/vnd.ms-excel;charset=utf-8')
}

export function exportTripPdf(data, onError = () => {}) {
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


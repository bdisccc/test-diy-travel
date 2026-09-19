export function formatMoney(value, currency) {
  return `${currency}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}



export function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

export function formatShortDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

export function formatDayName(date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${date}T12:00:00`))
}


export function formatNearbyDistance(meters) {
  const value = Number(meters)
  if (!Number.isFinite(value) || value < 0) return 'Nearby'
  if (value < 1000) return `${Math.round(value)} m`
  const km = value / 1000
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`
}


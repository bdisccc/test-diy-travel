function normalizeFlightNumber(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function lookupFlight(flightNumber, date) {
  const flight = normalizeFlightNumber(flightNumber)
  if (flight.length < 3) throw new Error('Enter a valid flight number, for example 5J312.')

  const params = new URLSearchParams({ flight })
  if (date) params.set('date', date)

  const response = await fetch(`/api/flight?${params.toString()}`)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Flight lookup returned ${response.status}`)
  }
  return payload
}

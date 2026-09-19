export function haversineMeters(a, b) {
  const lat1 = Number(a?.latitude)
  const lon1 = Number(a?.longitude)
  const lat2 = Number(b?.latitude)
  const lon2 = Number(b?.longitude)
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null

  const toRad = (value) => value * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function haversineKm(a, b) {
  const meters = haversineMeters(a, b)
  return meters == null ? null : meters / 1000
}

export function formatDistance(meters, approximate = false) {
  const value = Number(meters)
  if (!Number.isFinite(value) || value < 0) return ''
  const prefix = approximate ? '≈ ' : ''
  if (value < 1000) return `${prefix}${Math.max(1, Math.round(value))} m`
  const km = value / 1000
  return `${prefix}${km.toFixed(km >= 10 ? 0 : 1)} km`
}

export function clusterLocations(items = [], cellDegrees = 0.015) {
  const clusters = new Map()
  for (const item of items) {
    const lat = Number(item?.locationData?.latitude ?? item?.latitude)
    const lon = Number(item?.locationData?.longitude ?? item?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const key = `${Math.round(lat / cellDegrees)}:${Math.round(lon / cellDegrees)}`
    if (!clusters.has(key)) clusters.set(key, [])
    clusters.get(key).push(item)
  }
  return [...clusters.values()]
}

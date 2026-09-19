function hashText(value) {
  let hash = 2166136261
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function createLocationId(location = {}) {
  if (location.locationId) return String(location.locationId)
  const identity = [
    location.provider || 'local',
    location.providerId || location.osmId || '',
    location.name || location.displayName || location.location || '',
    Number.isFinite(Number(location.latitude)) ? Number(location.latitude).toFixed(5) : '',
    Number.isFinite(Number(location.longitude)) ? Number(location.longitude).toFixed(5) : '',
  ].join('|')
  return `loc_${hashText(identity)}`
}

export function emptyLocationFields() {
  return {
    locationId: '',
    provider: 'manual',
    providerId: '',
    osmId: '',
    address: '',
    latitude: null,
    longitude: null,
    mapUrl: '',
    websiteURI: '',
    utcOffsetMinutes: null,
    image: {
      url: null,
      source: null,
      attribution: null,
      author: null,
      license: null,
      licenseUrl: null,
      pageUrl: null,
    },
    metadata: {},
  }
}

export function migrateLegacyLocation(value = {}) {
  const legacyGooglePlaceId = value.googlePlaceId || value.metadata?.legacyGooglePlaceId || ''
  const legacyGoogleMapsURI = value.googleMapsURI || value.metadata?.legacyGoogleMapsURI || ''
  const migrated = {
    ...emptyLocationFields(),
    ...value,
    provider: value.provider || (value.source && value.source !== 'google' ? value.source : 'manual'),
    providerId: value.providerId || value.osmId || '',
    mapUrl: value.mapUrl || '',
    image: {
      ...emptyLocationFields().image,
      ...(value.image || {}),
      url: value.image?.url || value.photoURI || null,
    },
    metadata: {
      ...(value.metadata || {}),
      ...(legacyGooglePlaceId ? { legacyGooglePlaceId } : {}),
      ...(legacyGoogleMapsURI ? { legacyGoogleMapsURI } : {}),
    },
  }

  delete migrated.googlePlaceId
  delete migrated.googleMapsURI
  delete migrated.photoURI
  delete migrated.photoAttributions
  delete migrated.photoGoogleMapsURI
  delete migrated.source

  migrated.locationId = createLocationId(migrated)
  return migrated
}

export function normalizeLocation(value = {}) {
  const normalized = migrateLegacyLocation(value)
  normalized.latitude = Number.isFinite(Number(normalized.latitude)) ? Number(normalized.latitude) : null
  normalized.longitude = Number.isFinite(Number(normalized.longitude)) ? Number(normalized.longitude) : null
  normalized.locationId = normalized.locationId || createLocationId(normalized)
  return normalized
}

export function locationFields(value = {}) {
  const normalized = normalizeLocation(value)
  return {
    locationId: normalized.locationId,
    provider: normalized.provider,
    providerId: normalized.providerId,
    osmId: normalized.osmId,
    address: normalized.address,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    mapUrl: normalized.mapUrl,
    websiteURI: normalized.websiteURI,
    utcOffsetMinutes: normalized.utcOffsetMinutes,
    image: normalized.image,
    metadata: normalized.metadata,
  }
}

export function isMappedLocation(value) {
  return Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude))
}

function normalizedText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function locationIdentityKeys(place) {
  if (!place) return []
  const keys = []
  if (place.locationId) keys.push(`location:${place.locationId}`)
  if (place.provider && place.providerId) keys.push(`provider:${place.provider}:${place.providerId}`)
  if (place.osmId) keys.push(`osm:${place.osmId}`)
  const name = normalizedText(place.name || place.displayName || place.location)
  const address = normalizedText(place.address)
  if (name && address) keys.push(`name-address:${name}|${address}`)
  const lat = Number(place.latitude)
  const lon = Number(place.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lon)) keys.push(`coord:${lat.toFixed(5)},${lon.toFixed(5)}`)
  return [...new Set(keys)]
}

export function locationMapUrl(value) {
  const lat = Number(value?.latitude)
  const lon = Number(value?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ''
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=17/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`
}

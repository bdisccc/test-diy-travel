import { mapConfig } from './config.js'
import { cached } from './cache.js'
import { mapsFetch } from './http.js'
import { createLocationId, locationMapUrl, normalizeLocation } from './locationModel.js'
import { recordMapUsage } from './usage.js'

function peliasAddress(properties = {}) {
  return properties.label
    || [properties.housenumber, properties.street, properties.locality, properties.region, properties.country].filter(Boolean).join(', ')
    || properties.name
    || ''
}

function peliasName(properties = {}) {
  return properties.name || properties.label || properties.locality || properties.region || properties.country || 'Unnamed place'
}

function normalizePeliasFeature(feature = {}) {
  const properties = feature.properties || {}
  const canonical = properties._diyCanonical || null
  const coordinates = feature.geometry?.coordinates || []
  const longitude = Number(coordinates[0])
  const latitude = Number(coordinates[1])
  const providerId = properties.gid || properties.id || feature.id || properties.source_id || ''
  const layer = properties.layer || properties.category || ''
  const source = properties.source || 'openstreetmap'
  const provider = source === 'wikidata' ? 'wikidata' : 'heigit'
  const osmId = /osm|openstreetmap/i.test(source) ? String(properties.source_id || providerId || '') : ''
  const providerName = peliasName(properties)
  const visibleName = canonical?.alias || canonical?.displayName || providerName
  const canonicalType = canonical?.intent === 'airport' ? 'airport' : ''
  const location = normalizeLocation({
    provider,
    providerId: String(providerId || ''),
    osmId,
    name: visibleName,
    displayName: properties.label || providerName,
    address: peliasAddress(properties),
    latitude,
    longitude,
    primaryType: canonicalType || layer,
    primaryTypeDisplayName: canonicalType
      ? 'Airport'
      : layer ? layer.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '',
    types: [canonicalType, layer, properties.category].filter(Boolean),
    metadata: {
      layer,
      source,
      country: properties.country || '',
      countryCode: properties.country_a || '',
      region: properties.region || '',
      locality: properties.locality || '',
      neighbourhood: properties.neighbourhood || '',
      confidence: properties.confidence ?? null,
      canonical: Boolean(canonical),
      officialName: canonical?.officialName || '',
      description: canonical?.description || '',
      locationLabel: canonical?.locationLabel || '',
      iata: canonical?.iata || '',
      icao: canonical?.icao || '',
      wikidataId: canonical?.wikidataId || '',
      entitySource: canonical ? 'wikidata' : '',
      raw: { source: properties.source || '', sourceId: properties.source_id || '' },
    },
  })
  location.locationId = createLocationId(location)
  location.mapUrl = locationMapUrl(location)
  return location
}

function normalizeCollection(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : []
  return features.map(normalizePeliasFeature).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
}

function queryString(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  return search.toString()
}


function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function searchWords(value) {
  return normalizeMatchText(value).split(' ').filter(Boolean)
}

function scoreSearchResult(place, query) {
  const q = normalizeMatchText(query)
  if (!q) return 0

  const queryWords = searchWords(q)
  const name = normalizeMatchText(place?.name || place?.displayName)
  const address = normalizeMatchText(place?.address || place?.displayName)
  const combined = `${name} ${address}`.trim()
  let score = 0

  if (name === q) score += 1400
  else if (name.startsWith(`${q} `) || name.startsWith(q)) score += 850
  else if (name.includes(q)) score += 650

  if (address === q) score += 500
  else if (address.includes(q)) score += 300

  if (queryWords.length) {
    const allInName = queryWords.every((word) => name.includes(word))
    const allInCombined = queryWords.every((word) => combined.includes(word))
    if (allInName) score += 500
    else if (allInCombined) score += 260

    for (const word of queryWords) {
      if (name.includes(word)) score += 75
      else if (address.includes(word)) score += 30
    }
  }

  const numericTokens = queryWords.filter((word) => /^\d+$/.test(word))
  if (numericTokens.length && numericTokens.every((word) => address.includes(word))) score += 180

  const confidence = Number(place?.metadata?.confidence)
  if (Number.isFinite(confidence)) score += Math.max(0, confidence) * 100

  return score
}

function rankSearchResults(places, query) {
  return [...(places || [])]
    .map((place) => {
      const matchScore = scoreSearchResult(place, query)
      return {
        ...place,
        metadata: {
          ...(place.metadata || {}),
          matchScore,
          matchStrength: matchScore >= 900 ? 'strong' : matchScore >= 450 ? 'good' : 'weak',
        },
      }
    })
    .sort((a, b) => Number(b.metadata?.matchScore || 0) - Number(a.metadata?.matchScore || 0))
}

export async function autocompletePlaces(query, { focus = null, limit = 6, signal = null } = {}) {
  const text = String(query || '').trim()
  if (text.length < mapConfig.autocompleteMinChars) return []
  const params = {
    text,
    size: Math.max(1, Math.min(10, Number(limit) || 6)),
    ...(Number.isFinite(Number(focus?.latitude)) ? { 'focus.point.lat': Number(focus.latitude) } : {}),
    ...(Number.isFinite(Number(focus?.longitude)) ? { 'focus.point.lon': Number(focus.longitude) } : {}),
  }
  const key = `autocomplete:${text.toLowerCase()}:${params['focus.point.lat'] || ''}:${params['focus.point.lon'] || ''}`
  const result = await cached(key, mapConfig.cache.searchMs, async () => {
    const { data } = await mapsFetch(`/autocomplete?${queryString(params)}`, { signal, usageKind: 'autocompleteRequests' })
    return rankSearchResults(normalizeCollection(data), text)
  }, { shouldCache: (items) => Array.isArray(items) && items.length > 0 })
  recordMapUsage('', { cacheHit: result.cacheHit })
  return result.value
}

export async function suggestPlaces(query, { focus = null, limit = 8, signal = null, intent = 'generic' } = {}) {
  const text = String(query || '').trim()
  if (text.length < mapConfig.autocompleteMinChars) return []
  const params = {
    text,
    size: Math.max(1, Math.min(12, Number(limit) || 8)),
    ...(intent !== 'generic' ? { intent } : {}),
    ...(Number.isFinite(Number(focus?.latitude)) ? { 'focus.point.lat': Number(focus.latitude) } : {}),
    ...(Number.isFinite(Number(focus?.longitude)) ? { 'focus.point.lon': Number(focus.longitude) } : {}),
  }
  const endpoint = intent === 'airport' ? '/search' : '/autocomplete'
  const key = `suggest:v7:${intent}:${text.toLowerCase()}:${params['focus.point.lat'] || ''}:${params['focus.point.lon'] || ''}`
  const result = await cached(key, mapConfig.cache.searchMs, async () => {
    const { data } = await mapsFetch(`${endpoint}?${queryString(params)}`, {
      signal,
      usageKind: intent === 'airport' ? 'searchRequests' : 'autocompleteRequests',
    })
    return rankSearchResults(normalizeCollection(data), text)
  }, { shouldCache: (items) => Array.isArray(items) && items.length > 0 })
  recordMapUsage('', { cacheHit: result.cacheHit })
  return result.value
}

export async function searchPlaces(query, { focus = null, limit = 8, signal = null, bypassCache = false, intent = 'generic' } = {}) {
  const text = String(query || '').trim()
  if (text.length < 2) return []
  const params = {
    text,
    size: Math.max(1, Math.min(12, Number(limit) || 8)),
    ...(intent !== 'generic' ? { intent } : {}),
    ...(Number.isFinite(Number(focus?.latitude)) ? { 'focus.point.lat': Number(focus.latitude) } : {}),
    ...(Number.isFinite(Number(focus?.longitude)) ? { 'focus.point.lon': Number(focus.longitude) } : {}),
  }
  const key = `search:v6:${intent}:${text.toLowerCase()}:${params['focus.point.lat'] || ''}:${params['focus.point.lon'] || ''}`
  const result = await cached(key, mapConfig.cache.searchMs, async () => {
    const { data } = await mapsFetch(`/search?${queryString(params)}`, { signal, usageKind: 'searchRequests' })
    return rankSearchResults(normalizeCollection(data), text)
  }, { bypass: bypassCache, shouldCache: (items) => Array.isArray(items) && items.length > 0 })
  recordMapUsage('', { cacheHit: result.cacheHit })
  return result.value
}

export async function reverseGeocode(latitude, longitude, { signal = null } = {}) {
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const key = `reverse:${lat.toFixed(4)},${lon.toFixed(4)}`
  const result = await cached(key, mapConfig.cache.searchMs, async () => {
    const { data } = await mapsFetch(`/reverse-geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { signal, usageKind: 'searchRequests' })
    return normalizeCollection(data)[0] || null
  })
  recordMapUsage('', { cacheHit: result.cacheHit })
  return result.value
}

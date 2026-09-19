import { mapConfig } from './config.js'
import { cached, coordinateCell } from './cache.js'
import { mapsFetch } from './http.js'
import { createLocationId, locationMapUrl, normalizeLocation } from './locationModel.js'
import { haversineMeters } from './distanceService.js'
import { recordMapUsage } from './usage.js'

function cleanCategory(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function tagsFromFeature(feature) {
  const properties = feature?.properties || {}
  return properties.osm_tags || properties.tags || properties.properties || properties.details || {}
}

function categoryFromTags(tags = {}, fallback = '') {
  const values = [
    tags.amenity,
    tags.tourism,
    tags.shop,
    tags.leisure,
    tags.historic,
    tags.railway,
    tags.public_transport,
    tags.highway,
    fallback,
  ].filter(Boolean).map(cleanCategory)

  if (values.some((v) => /restaurant|fast_food|food_court/.test(v))) return 'Food'
  if (values.some((v) => /cafe|coffee|bakery|ice_cream/.test(v))) return 'Cafe'
  if (values.some((v) => /mall|department_store|supermarket|convenience|marketplace|shop|store/.test(v))) return 'Shopping'
  if (values.some((v) => /museum|gallery|arts_centre/.test(v))) return 'Museum'
  if (values.some((v) => /park|garden|nature|beach|viewpoint/.test(v))) return 'Nature'
  if (values.some((v) => /hotel|hostel|motel|guest_house|apartment/.test(v))) return 'Hotel'
  if (values.some((v) => /station|stop|platform|subway|tram|rail|bus|ferry|airport/.test(v))) return 'Transport'
  if (values.some((v) => /cinema|theatre|theme_park|amusement|entertainment/.test(v))) return 'Entertainment'
  if (values.some((v) => /monument|memorial|historic|attraction|landmark|place_of_worship/.test(v))) return 'Attraction'
  return 'Attraction'
}



function featureName(feature, tags) {
  const properties = feature?.properties || {}
  return properties.name || tags.name || tags['name:en'] || tags.operator || 'Nearby place'
}

function featureAddress(tags = {}, properties = {}) {
  if (properties.address) return properties.address
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || ''
  return [street, city].filter(Boolean).join(', ')
}

function normalizePoiFeature(feature = {}, anchor) {
  const properties = feature.properties || {}
  const tags = tagsFromFeature(feature)
  const coordinates = feature.geometry?.coordinates || []
  const longitude = Number(coordinates[0])
  const latitude = Number(coordinates[1])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const rawId = properties.osm_id || properties.osmId || feature.id || tags['@id'] || ''
  const osmType = properties.osm_type || properties.osmType || ''
  const osmId = [osmType, rawId].filter(Boolean).join('/') || String(rawId || '')
  const fallbackCategory = properties.category || properties.category_name || properties.category_group || ''
  const category = categoryFromTags(tags, fallbackCategory)
  const place = normalizeLocation({
    provider: 'heigit',
    providerId: osmId || String(feature.id || ''),
    osmId,
    name: featureName(feature, tags),
    displayName: featureName(feature, tags),
    category,
    address: featureAddress(tags, properties),
    latitude,
    longitude,
    primaryType: cleanCategory(tags.amenity || tags.tourism || tags.shop || tags.railway || tags.public_transport || fallbackCategory),
    primaryTypeDisplayName: category,
    types: [tags.amenity, tags.tourism, tags.shop, tags.leisure, tags.railway, tags.public_transport, fallbackCategory].filter(Boolean).map(cleanCategory),
    metadata: {
      osmTags: tags,
      categoryIds: properties.category_ids || properties.categoryIds || [],
      openingHours: tags.opening_hours || '',
      website: tags.website || tags['contact:website'] || '',
      phone: tags.phone || tags['contact:phone'] || '',
    },
  })
  place.locationId = createLocationId(place)
  place.mapUrl = locationMapUrl(place)
  place.websiteURI = place.metadata.website || ''
  place.distanceMeters = haversineMeters(anchor, place)
  return place
}

function normalizePoiCollection(payload, anchor) {
  const features = Array.isArray(payload?.features) ? payload.features : []
  return features.map((feature) => normalizePoiFeature(feature, anchor)).filter(Boolean)
}

function categoryScore(place, requestedCategories = []) {
  if (!requestedCategories.length) return 0
  const normalized = requestedCategories.map((item) => String(item).toLowerCase())
  return normalized.includes(String(place.category || '').toLowerCase()) ? 1000 : 0
}

export function rankNearbyPlaces(places, { categories = [], savedPlaces = [], interests = [] } = {}) {
  const savedNames = new Set(savedPlaces.map((place) => String(place.name || '').trim().toLowerCase()))
  return [...places]
    .filter((place) => !savedNames.has(String(place.name || '').trim().toLowerCase()))
    .map((place) => {
      const distance = Number(place.distanceMeters || Infinity)
      const relevance = categoryScore(place, categories)
      const interest = interests.some((item) => String(place.category || '').toLowerCase().includes(String(item).toLowerCase())) ? 250 : 0
      const score = relevance + interest + Math.max(0, 900 - Math.min(900, distance / 2))
      return {
        ...place,
        recommendationScore: score,
        reasonForRecommendation: place.nearAnchor
          ? `Near ${place.nearAnchor}`
          : 'Near one of your planned destinations',
      }
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore || Number(a.distanceMeters || Infinity) - Number(b.distanceMeters || Infinity))
}

export async function getNearbyPlaces(location, {
  radiusMeters = mapConfig.nearbyRadiusMeters,
  limit = 30,
  kind = 'ideas',
  signal = null,
  bypassCache = false,
} = {}) {
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []

  const radius = Math.max(100, Math.min(mapConfig.maxNearbyRadiusMeters, Number(radiusMeters) || mapConfig.nearbyRadiusMeters))
  const cell = coordinateCell(latitude, longitude, 3)
  const normalizedKind = kind === 'transport' ? 'transport' : 'ideas'
  const key = `nearby:${normalizedKind}:${cell}:${radius}`
  const result = await cached(key, mapConfig.cache.nearbyMs, async () => {
    const { data } = await mapsFetch('/nearby', {
      method: 'POST',
      body: { latitude, longitude, radiusMeters: radius, limit: Math.max(1, Math.min(60, Number(limit) || 30)), kind: normalizedKind },
      signal,
      usageKind: 'poiRequests',
    })
    return normalizePoiCollection(data, { latitude, longitude })
  }, { bypass: bypassCache })
  recordMapUsage('', { cacheHit: result.cacheHit })
  return result.value
}

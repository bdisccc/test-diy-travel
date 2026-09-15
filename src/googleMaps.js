let googleMapsPromise
let getPlaceQuotaBlocked = false
let getPlaceQuotaWarningShown = false
const PLACE_PHOTO_CACHE = new Map()

function isGetPlaceQuotaError(error) {
  const text = [error?.message, error?.code, error?.status, error?.name].filter(Boolean).join(' ').toUpperCase()
  return error?.status === 429 || text.includes('RESOURCE_EXHAUSTED') || text.includes('QUOTA EXCEEDED') || text.includes('TOO MANY REQUESTS')
}

function blockGetPlaceQuota(error) {
  if (!isGetPlaceQuotaError(error)) return false
  getPlaceQuotaBlocked = true
  if (!getPlaceQuotaWarningShown) {
    getPlaceQuotaWarningShown = true
    console.warn('Google Places GetPlace daily quota is exhausted. Basic search/nearby data will be used for this session; extra details/photos may be unavailable.')
  }
  return true
}

function straightLineMeters(aLat, aLng, bLat, bLng) {
  const toRad = (value) => (Number(value) * Math.PI) / 180
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const dLat = toRad(Number(bLat) - Number(aLat))
  const dLng = toRad(Number(bLng) - Number(aLng))
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
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

function photoFromPlace(place, { maxWidth = 900, maxHeight = 650 } = {}) {
  const photo = place?.photos?.[0]
  if (!photo) return null
  try {
    const uri = photo.getURI({
      maxWidth: Math.max(120, Number(maxWidth) || 900),
      maxHeight: Math.max(120, Number(maxHeight) || 650),
    })
    if (!uri) return null
    return {
      uri,
      attributions: (photo.authorAttributions || []).map((item) => ({
        displayName: item.displayName || '',
        uri: item.uri || '',
      })),
      googleMapsURI: photo.googleMapsURI || '',
    }
  } catch (error) {
    console.warn('Could not prepare Google place photo URI:', error)
    return null
  }
}

function normalizePlace(place) {
  const latitude = typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat
  const longitude = typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng
  const photo = photoFromPlace(place)
  if (place.id && photo?.uri) PLACE_PHOTO_CACHE.set(place.id, photo)
  return {
    googlePlaceId: place.id || '',
    name: place.displayName || '',
    address: place.formattedAddress || '',
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    primaryType: place.primaryType || '',
    primaryTypeDisplayName: place.primaryTypeDisplayName || '',
    types: place.types || [],
    websiteURI: place.websiteURI || '',
    googleMapsURI: place.googleMapsURI || '',
    utcOffsetMinutes: place.utcOffsetMinutes ?? null,
    regularOpeningHours: serializeOpeningHours(place.regularOpeningHours),
    currentOpeningHours: serializeOpeningHours(place.currentOpeningHours),
    photoURI: photo?.uri || '',
    photoAttributions: photo?.attributions || [],
    photoGoogleMapsURI: photo?.googleMapsURI || '',
    source: 'google',
  }
}

export function hasGoogleMapsKey() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return Boolean(key && !key.includes('YOUR_GOOGLE_MAPS_API_KEY_HERE'))
}

export function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps)
  }

  if (googleMapsPromise) return googleMapsPromise

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  if (!key || key.includes('YOUR_GOOGLE_MAPS_API_KEY_HERE')) {
    return Promise.reject(
      new Error('Google Maps demo key is missing. Add VITE_GOOGLE_MAPS_API_KEY to .env.local and restart Vite.'),
    )
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-diy-travel-google-maps]')

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google.maps), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true })
      return
    }

    const callbackName = '__diyTravelGoogleMapsReady'
    const script = document.createElement('script')
    const params = new URLSearchParams({
      key,
      loading: 'async',
      libraries: 'places,routes',
      callback: callbackName,
      v: 'weekly',
    })

    window[callbackName] = () => {
      delete window[callbackName]
      resolve(window.google.maps)
    }

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.defer = true
    script.dataset.diyTravelGoogleMaps = 'true'
    script.onerror = () => {
      delete window[callbackName]
      googleMapsPromise = undefined
      reject(new Error('Google Maps failed to load. Check the demo key, referrer restrictions, and enabled APIs.'))
    }

    document.head.appendChild(script)
  })

  return googleMapsPromise
}

export async function searchGooglePlaces(query, { includedType = '', maxResults = 6 } = {}) {
  const value = String(query || '').trim()
  if (value.length < 2) return []
  await loadGoogleMaps()
  const { Place } = await window.google.maps.importLibrary('places')
  const request = {
    textQuery: value,
    fields: ['id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'primaryTypeDisplayName', 'types', 'photos'],
    language: 'en-US',
    maxResultCount: Math.max(1, Math.min(10, Number(maxResults) || 6)),
  }
  if (includedType) {
    request.includedType = includedType
    request.useStrictTypeFiltering = false
  }
  const { places } = await Place.searchByText(request)
  return (places || []).map(normalizePlace)
}

export async function getGooglePlaceDetails(placeId) {
  if (!placeId || getPlaceQuotaBlocked) return null
  await loadGoogleMaps()
  const { Place } = await window.google.maps.importLibrary('places')
  const place = new Place({ id: placeId })
  try {
    await place.fetchFields({
      fields: [
        'id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'primaryTypeDisplayName',
        'types', 'regularOpeningHours', 'currentOpeningHours', 'websiteURI', 'googleMapsURI',
        'utcOffsetMinutes', 'photos',
      ],
    })
    return normalizePlace(place)
  } catch (error) {
    if (blockGetPlaceQuota(error)) return null
    throw error
  }
}


const NEARBY_DISCOVERY_REQUEST_TYPES = [
  'tourist_attraction',
  'museum',
  'art_gallery',
  'park',
  'shopping_mall',
  'restaurant',
  'cafe',
  'bakery',
  'convenience_store',
  'supermarket',
  'zoo',
  'aquarium',
  'amusement_park',
]

function isUsefulNearbyDiscovery(place) {
  const types = [place.primaryType, ...(place.types || [])].filter(Boolean)
  if (!types.length) return true
  const exact = new Set([
    ...NEARBY_DISCOVERY_REQUEST_TYPES,
    'church', 'hindu_temple', 'mosque', 'synagogue', 'buddhist_temple', 'shinto_shrine',
    'historical_landmark', 'cultural_landmark', 'market', 'department_store', 'book_store',
    'gift_shop', 'clothing_store', 'dessert_shop', 'ice_cream_shop', 'coffee_shop',
  ])
  return types.some((type) => exact.has(type) || /(restaurant|cafe|bakery|museum|gallery|park|mall|store|market|zoo|aquarium|temple|shrine|church|mosque|synagogue|landmark|tourist_attraction|amusement)/.test(type))
}

export async function searchGoogleNearbyPlaces({
  latitude,
  longitude,
  minDistanceMeters = 0,
  maxDistanceMeters = 4000,
  maxResults = 8,
} = {}) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []

  await loadGoogleMaps()
  const { Place, SearchNearbyRankPreference } = await window.google.maps.importLibrary('places')
  const baseRequest = {
    fields: ['id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'primaryTypeDisplayName', 'types', 'googleMapsURI', 'photos'],
    locationRestriction: { center: { lat, lng }, radius: Math.max(100, Math.min(50000, Number(maxDistanceMeters) || 4000)) },
    maxResultCount: 20,
    rankPreference: SearchNearbyRankPreference?.DISTANCE || 'DISTANCE',
    language: 'en-US',
  }

  let places = []
  try {
    const response = await Place.searchNearby({ ...baseRequest, includedTypes: NEARBY_DISCOVERY_REQUEST_TYPES })
    places = response?.places || []
  } catch (filteredSearchError) {
    // If Google changes/limits a request type, retry broadly instead of making the UI look like
    // there are genuinely no places nearby. Filtering is then performed locally below.
    console.warn('Filtered nearby search failed; retrying without type filters.', filteredSearchError)
    const response = await Place.searchNearby(baseRequest)
    places = response?.places || []
  }

  const normalized = places
    .map(normalizePlace)
    .map((place) => ({
      ...place,
      distanceMeters: straightLineMeters(lat, lng, place.latitude, place.longitude),
    }))
    .filter((place) => Number.isFinite(place.distanceMeters) && place.distanceMeters >= Number(minDistanceMeters || 0) && place.distanceMeters <= Number(maxDistanceMeters || 4000))

  const useful = normalized.filter(isUsefulNearbyDiscovery)
  const pool = useful.length ? useful : normalized
  return pool.slice(0, Math.max(1, Math.min(10, Number(maxResults) || 8)))
}

function cachedPlacePhoto(placeId) {
  return placeId && PLACE_PHOTO_CACHE.has(placeId) ? PLACE_PHOTO_CACHE.get(placeId) : null
}


export async function getGooglePlacePhoto(placeId, { maxWidth = 560, maxHeight = 360 } = {}) {
  if (!placeId) return null

  const cached = cachedPlacePhoto(placeId)
  if (cached) return cached

  // Do not fall back to Text Search just to obtain a photo. That burns the
  // SearchText quota for every card and can turn one screen into many API calls.
  // Nearby/Text Search already ask Google for `photos`; this fetch is only for
  // older saved places that do not already carry a photo from their search result.
  if (getPlaceQuotaBlocked) return null

  await loadGoogleMaps()
  const { Place } = await window.google.maps.importLibrary('places')
  const place = new Place({ id: placeId })
  try {
    await place.fetchFields({ fields: ['photos'] })
    const result = photoFromPlace(place, { maxWidth, maxHeight })
    if (result?.uri) PLACE_PHOTO_CACHE.set(placeId, result)
    return result
  } catch (error) {
    if (blockGetPlaceQuota(error)) return null
    throw error
  }
}

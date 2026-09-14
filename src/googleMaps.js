let googleMapsPromise

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

function normalizePlace(place) {
  const latitude = typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat
  const longitude = typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng
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
    fields: ['id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'primaryTypeDisplayName', 'types'],
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
  if (!placeId) return null
  await loadGoogleMaps()
  const { Place } = await window.google.maps.importLibrary('places')
  const place = new Place({ id: placeId })
  await place.fetchFields({
    fields: [
      'id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'primaryTypeDisplayName',
      'types', 'regularOpeningHours', 'currentOpeningHours', 'websiteURI', 'googleMapsURI',
      'utcOffsetMinutes',
    ],
  })
  return normalizePlace(place)
}

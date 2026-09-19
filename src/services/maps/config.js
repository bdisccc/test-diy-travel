export const FREE_USAGE_LIMITS = Object.freeze({
  routesPerDay: 2000,
  geocodingPerDay: 1000,
  reverseGeocodingPerDay: 1000,
  autocompletePerDay: 1000,
  poiPerDay: 500,
})

export const mapConfig = Object.freeze({
  expectedWorkerVersion: '3.1.1',
  mapProvider: 'openfreemap',
  mapRenderer: 'maplibre',
  mapStyleUrl: import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
  mapLibreJsUrl: import.meta.env.VITE_MAPLIBRE_JS_URL || 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js',
  mapLibreCssUrl: import.meta.env.VITE_MAPLIBRE_CSS_URL || 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css',
  mapsApiBase: String(import.meta.env.VITE_MAPS_API_BASE || '/api/maps').replace(/\/$/, ''),
  searchProvider: 'heigit',
  routingProvider: 'openrouteservice',
  imageProvider: 'wikimedia',
  nearbyRadiusMeters: 1800,
  maxNearbyRadiusMeters: 2000,
  autocompleteMinChars: 3,
  autocompleteDebounceMs: 400,
  cache: {
    searchMs: 12 * 60 * 60 * 1000,
    nearbyMs: 12 * 60 * 60 * 1000,
    imageMs: 7 * 24 * 60 * 60 * 1000,
    routeMs: 24 * 60 * 60 * 1000,
    transitCoverageMs: 6 * 60 * 60 * 1000,
  },
})

export const QUOTA_THRESHOLDS = Object.freeze({
  conserveAt: 0.8,
  essentialOnlyAt: 0.95,
  stopAt: 1,
})

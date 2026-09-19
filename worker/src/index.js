const HEIGIT_BASE = 'https://api.heigit.org'
const CACHE_VERSION = 'v13'
const WORKER_VERSION = '3.1.1'
const OPENPOI_ALLOWED_GROUPS = new Set([100, 120, 130, 150, 160, 190, 200, 220, 260, 330, 360, 390, 420, 560, 580, 620])
const ALLOWED_ROUTE_MODES = new Set(['walking', 'cycling', 'driving'])
const RATE_BUCKETS = new Map()
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'
const WIKIMEDIA_USER_AGENT = 'DIYTravelPlanner/0.1 (https://github.com/bdisccc/diy-travel)'
const MOBILITY_DATABASE_BASE = 'https://api.mobilitydatabase.org'
const MOBILITY_TOKEN_REFRESH_AFTER_MS = 50 * 60 * 1000
let MOBILITY_TOKEN_CACHE = { accessToken: '', issuedAt: 0 }
let MOBILITY_TOKEN_PROMISE = null

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '*').split(',').map((value) => value.trim()).filter(Boolean)
}

function originAllowed(request, env) {
  const origin = request.headers.get('Origin') || ''
  if (!origin) return true
  const configured = allowedOrigins(env)
  return configured.includes('*') || configured.includes(origin)
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || ''
  const configured = allowedOrigins(env)
  const allowOrigin = configured.includes('*') ? (origin || '*') : origin
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'X-Worker-Version, X-Provider-Limit, X-Provider-Remaining, X-Provider-Reset, X-Transit-Provider, X-Mobility-Provider, X-POI-Provider, X-POI-Requests',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function clientKey(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown'
}

function allowRequest(request, maxPerMinute = 60) {
  const key = clientKey(request)
  const now = Date.now()
  const minute = Math.floor(now / 60000)
  const existing = RATE_BUCKETS.get(key)
  if (!existing || existing.minute !== minute) {
    RATE_BUCKETS.set(key, { minute, count: 1 })
    return true
  }
  existing.count += 1
  return existing.count <= maxPerMinute
}

function safeText(value, max = 120) {
  return String(value || '').trim().slice(0, max)
}

function finiteCoordinate(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : null
}

async function readBody(request) {
  try { return await request.json() } catch { return null }
}

function upstreamHeaders(env) {
  if (!env.HEIGIT_API_KEY) throw new Error('HEIGIT_API_KEY is not configured')
  return {
    Authorization: env.HEIGIT_API_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json, application/geo+json',
  }
}

function quotaHeaders(response) {
  const headers = {}
  const limit = response.headers.get('x-ratelimit-limit')
  const remaining = response.headers.get('x-ratelimit-remaining')
  const reset = response.headers.get('x-ratelimit-reset')
  if (limit) headers['X-Provider-Limit'] = limit
  if (remaining) headers['X-Provider-Remaining'] = remaining
  if (reset) headers['X-Provider-Reset'] = reset
  return headers
}

async function parseUpstream(response) {
  let body = null
  try { body = await response.json() } catch {}
  if (response.ok) return body

  const rawMessage = body?.error?.message || body?.error || body?.message || `Upstream HTTP ${response.status}`
  const lower = String(rawMessage).toLowerCase()
  const quota = response.status === 429 || lower.includes('quota') || lower.includes('rate limit')
  const access = response.status === 401 || response.status === 403 || lower.includes('disallowed') || lower.includes('unauthorized')
  const error = new Error(
    quota
      ? 'The free location service has reached its current quota.'
      : access
        ? 'This free location endpoint is not available for the current API key.'
        : 'The free location service is temporarily unavailable.',
  )
  error.status = response.status
  error.code = quota ? 'QUOTA_REACHED' : access ? 'PROVIDER_ACCESS' : 'PROVIDER_UNAVAILABLE'
  error.details = body
  error.providerMessage = String(rawMessage || '').slice(0, 240)
  throw error
}

async function cacheRequest(request, key, ttlSeconds, loader, { shouldCache = null } = {}) {
  const cache = caches.default
  const synthetic = new Request(`https://cache.diy-travel.invalid/${CACHE_VERSION}/${key}`, { method: 'GET' })
  const cached = await cache.match(synthetic)
  if (cached) return cached

  const response = await loader()
  let cacheable = response.ok
  if (cacheable && shouldCache) {
    try { cacheable = await shouldCache(response.clone()) } catch {}
  }
  if (cacheable) {
    const copy = new Response(response.body, response)
    copy.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`)
    await cache.put(synthetic, copy.clone())
    return copy
  }
  return response
}

function encodeQuery(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  return search.toString()
}


function normalizedWords(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function claimString(entity, propertyId) {
  const claims = entity?.claims?.[propertyId]
  if (!Array.isArray(claims)) return ''
  for (const claim of claims) {
    const value = claim?.mainsnak?.datavalue?.value
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function claimCoordinate(entity) {
  const claims = entity?.claims?.P625
  if (!Array.isArray(claims)) return null
  for (const claim of claims) {
    const value = claim?.mainsnak?.datavalue?.value
    const latitude = Number(value?.latitude)
    const longitude = Number(value?.longitude)
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude }
  }
  return null
}

function wikimediaHeaders() {
  return {
    Accept: 'application/json',
    'Api-User-Agent': WIKIMEDIA_USER_AGENT,
    'User-Agent': WIKIMEDIA_USER_AGENT,
  }
}

const AIRPORT_STOP_WORDS = new Set([
  'airport', 'international', 'intl', 'aerodrome', 'airfield', 'terminal',
])

function airportCoreWords(value) {
  return normalizedWords(value).filter((word) => !AIRPORT_STOP_WORDS.has(word))
}

function airportSearchVariants(value) {
  const raw = safeText(value, 120)
  if (!raw) return []

  const variants = []
  const add = (candidate) => {
    const cleaned = String(candidate || '').replace(/\s+/g, ' ').trim()
    if (!cleaned) return
    if (!variants.some((item) => item.toLowerCase() === cleaned.toLowerCase())) variants.push(cleaned)
  }

  const compact = raw.replace(/\s+/g, ' ').trim()
  const core = airportCoreWords(compact).join(' ')
  const looksLikeCode = /^[a-z0-9]{3,4}$/i.test(compact)

  // Airport-first wording gives Wikidata a much cleaner candidate set than a raw locality search.
  if (looksLikeCode) add(`${compact} airport`)
  if (core) add(`${core} airport`)
  add(compact)

  return variants.slice(0, 3)
}

async function searchWikidataEntities(searchText) {
  const searchUrl = `${WIKIDATA_API}?${encodeQuery({
    action: 'wbsearchentities',
    search: searchText,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: 12,
    format: 'json',
    maxlag: 5,
  })}`
  const response = await fetch(searchUrl, { headers: wikimediaHeaders() })
  if (!response.ok) return []
  const payload = await response.json()
  return Array.isArray(payload?.search) ? payload.search : []
}

function sparqlLiteral(value) {
  return JSON.stringify(String(value || '').trim().toLowerCase())
}

async function searchWikidataAirportIdentifiers(searchText) {
  const normalized = String(searchText || '').trim().toLowerCase()
  if (!normalized || normalized.length > 80) return []

  const literal = sparqlLiteral(normalized)
  const query = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?item WHERE {
  {
    ?item rdfs:label ?match .
    FILTER(LANG(?match) = "en")
    FILTER(LCASE(STR(?match)) = ${literal})
  } UNION {
    ?item skos:altLabel ?match .
    FILTER(LANG(?match) = "en")
    FILTER(LCASE(STR(?match)) = ${literal})
  } UNION {
    ?item wdt:P1813 ?match .
    FILTER(LANG(?match) = "en" || LANG(?match) = "")
    FILTER(LCASE(STR(?match)) = ${literal})
  } UNION {
    ?item wdt:P238 ?match .
    FILTER(LCASE(STR(?match)) = ${literal})
  } UNION {
    ?item wdt:P239 ?match .
    FILTER(LCASE(STR(?match)) = ${literal})
  }
  ?item wdt:P625 ?coordinate .
}
LIMIT 20`

  const url = `${WIKIDATA_SPARQL}?${encodeQuery({ query, format: 'json' })}`
  const response = await fetch(url, {
    headers: {
      ...wikimediaHeaders(),
      Accept: 'application/sparql-results+json',
    },
  })
  if (!response.ok) return []

  const payload = await response.json()
  return (payload?.results?.bindings || [])
    .map((binding) => String(binding?.item?.value || '').match(/Q\d+$/)?.[0] || '')
    .filter(Boolean)
}

async function fetchWikidataEntities(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))].slice(0, 40)
  if (!uniqueIds.length) return []
  const detailUrl = `${WIKIDATA_API}?${encodeQuery({
    action: 'wbgetentities',
    ids: uniqueIds.join('|'),
    props: 'labels|aliases|descriptions|claims',
    languages: 'en',
    format: 'json',
    formatversion: 2,
    maxlag: 5,
  })}`
  const response = await fetch(detailUrl, { headers: wikimediaHeaders() })
  if (!response.ok) return []
  const payload = await response.json()
  const entities = payload?.entities || {}
  return uniqueIds.map((id) => entities[id]).filter((entity) => entity && !entity.missing)
}

function airportEntitySearchText(entity) {
  const label = entity?.labels?.en?.value || ''
  const aliases = (entity?.aliases?.en || []).map((item) => item.value).filter(Boolean)
  const description = entity?.descriptions?.en?.value || ''
  const iata = claimString(entity, 'P238')
  const icao = claimString(entity, 'P239')
  return [label, ...aliases, description, iata, icao].filter(Boolean).join(' ')
}

function isAirportEntity(entity) {
  if (!claimCoordinate(entity)) return false
  const text = airportEntitySearchText(entity).toLowerCase()
  if (/railway station|train station|metro station|subway station|airport terminal|terminal building|airport hotel/.test(text)) return false

  const iata = claimString(entity, 'P238')
  const icao = claimString(entity, 'P239')
  if (iata || icao) return true
  return /\bairport\b|\baerodrome\b|\bairfield\b/.test(text)
}

function airportAliasScore(alias, query) {
  const aliasWords = normalizedWords(alias)
  const queryWords = normalizedWords(query)
  const queryCore = airportCoreWords(query)
  const aliasCore = airportCoreWords(alias)
  let score = 0

  if (aliasWords.join(' ') === queryWords.join(' ')) score += 500
  if (queryCore.length && aliasCore.join(' ') === queryCore.join(' ')) score += 360
  if (queryCore.length && queryCore.every((word) => aliasWords.includes(word))) score += 260
  if (/\bairport\b/i.test(alias)) score += 60
  score -= Math.max(0, aliasWords.length - queryWords.length) * 3
  return score
}

function airportEntityScore(entity, query) {
  const label = entity?.labels?.en?.value || ''
  const aliases = (entity?.aliases?.en || []).map((item) => item.value).filter(Boolean)
  const description = entity?.descriptions?.en?.value || ''
  const iata = claimString(entity, 'P238')
  const icao = claimString(entity, 'P239')
  const queryWords = normalizedWords(query)
  const coreWords = airportCoreWords(query)
  const queryNormalized = queryWords.join(' ')
  const textWords = normalizedWords([label, ...aliases, description].join(' '))
  const text = textWords.join(' ')
  let score = 0

  if (iata && iata.toLowerCase() === queryNormalized) score += 1200
  if (icao && icao.toLowerCase() === queryNormalized) score += 1200

  const names = [label, ...aliases].filter(Boolean)
  if (normalizedWords(label).join(' ') === queryNormalized) score += 650
  if (aliases.some((name) => normalizedWords(name).join(' ') === queryNormalized)) score += 900
  if (coreWords.length && names.some((name) => airportCoreWords(name).join(' ') === coreWords.join(' '))) score += 520
  if (coreWords.length && coreWords.every((word) => textWords.includes(word))) score += 320
  if (queryWords.length && queryWords.every((word) => textWords.includes(word))) score += 180
  if (/international airport/i.test(description)) score += 70
  else if (/\bairport\b|\baerodrome\b|\bairfield\b/i.test(description)) score += 50
  if (iata) score += 35
  if (icao) score += 20
  if (text.includes('railway station') || text.includes('train station') || text.includes('terminal building')) score -= 500

  return score
}

function airportShortcut(entity, query) {
  const queryNormalized = normalizedWords(query).join(' ')
  if (!queryNormalized) return ''
  const iata = claimString(entity, 'P238')
  const icao = claimString(entity, 'P239')
  const aliases = (entity?.aliases?.en || []).map((item) => item.value).filter(Boolean)
  const exact = aliases.find((alias) => normalizedWords(alias).join(' ') === queryNormalized) || ''
  if (!exact || /\s/.test(exact) || exact.length > 8) return ''
  if (exact.toLowerCase() === iata.toLowerCase() || exact.toLowerCase() === icao.toLowerCase()) return ''
  return exact
}

function friendlyAirportName(entity, query) {
  const label = entity?.labels?.en?.value || 'Airport'
  const aliases = (entity?.aliases?.en || []).map((item) => item.value).filter(Boolean)
  const candidates = [
    { name: label, isLabel: true },
    ...aliases.map((name) => ({ name, isLabel: false })),
  ].filter((item) => item.name)
  const airportNamed = candidates.filter((item) => /\bairport\b|\baerodrome\b|\bairfield\b/i.test(item.name))
  const pool = airportNamed.length ? airportNamed : candidates
  const best = pool
    .map((item) => ({
      ...item,
      score: airportAliasScore(item.name, query) + (item.isLabel ? 80 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]
  return best?.name || label
}

function airportLocationLabel(description = '') {
  const value = String(description || '').trim()
  if (!value) return ''

  const patterns = [
    /^(?:international\s+)?airport\s+in\s+(.+)$/i,
    /^(?:civil|public|commercial|regional|domestic)\s+airport\s+in\s+(.+)$/i,
    /^(?:international\s+)?airport\s+serving\s+(.+?)(?:\s+and\s+.+)?$/i,
    /^aerodrome\s+in\s+(.+)$/i,
    /^airfield\s+in\s+(.+)$/i,
  ]

  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]) {
      return match[1]
        .replace(/\s+/g, ' ')
        .replace(/\.$/, '')
        .trim()
    }
  }

  return ''
}

function airportEntityFeature(entity, query) {
  const coordinate = claimCoordinate(entity)
  if (!coordinate) return null
  const officialName = entity?.labels?.en?.value || 'Airport'
  const name = friendlyAirportName(entity, query)
  const description = entity?.descriptions?.en?.value || 'Airport'
  const iata = claimString(entity, 'P238')
  const icao = claimString(entity, 'P239')
  const shortcut = airportShortcut(entity, query)
  const locationLabel = airportLocationLabel(description)

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [coordinate.longitude, coordinate.latitude],
    },
    properties: {
      gid: `wikidata:${entity.id}`,
      id: entity.id,
      source: 'wikidata',
      source_id: entity.id,
      layer: 'venue',
      category: 'airport',
      name,
      label: description ? `${name}, ${description}` : name,
      _diyCanonical: {
        wikidataId: entity.id,
        alias: name,
        officialName,
        description,
        locationLabel,
        shortcut,
        iata,
        icao,
        coordinate,
        intent: 'airport',
      },
    },
  }
}

async function searchAirportsOnly(request, query, size = 8) {
  const raw = safeText(query, 120)
  if (!raw) return []
  const cacheKey = `airport-only/${encodeURIComponent(raw.toLowerCase())}/${size}`

  const response = await cacheRequest(request, cacheKey, 7 * 24 * 60 * 60, async () => {
    const candidateIds = []

    // Exact aliases, short names, IATA codes and ICAO codes are checked first.
    // This is what makes searches such as NAIA, HND, NRT and KHH useful without
    // requiring the traveler to know the airport's full official name.
    let identifierMatches = []
    if (/^[a-z0-9]{3,5}$/i.test(raw)) {
      try { identifierMatches = await searchWikidataAirportIdentifiers(raw) } catch { identifierMatches = [] }
    }
    for (const id of identifierMatches) {
      if (id && !candidateIds.includes(id)) candidateIds.push(id)
    }

    for (const variant of airportSearchVariants(raw)) {
      let matches = []
      try { matches = await searchWikidataEntities(variant) } catch { matches = [] }
      for (const item of matches) {
        if (item?.id && !candidateIds.includes(item.id)) candidateIds.push(item.id)
      }
      if (candidateIds.length >= 24) break
    }

    let entities = []
    try { entities = await fetchWikidataEntities(candidateIds) } catch { entities = [] }

    const ranked = entities
      .filter(isAirportEntity)
      .map((entity) => ({ entity, score: airportEntityScore(entity, raw) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(12, size)))

    const features = ranked
      .map(({ entity }) => airportEntityFeature(entity, raw))
      .filter(Boolean)

    return json({ type: 'FeatureCollection', features }, 200)
  }, {
    shouldCache: async (cachedResponse) => {
      const payload = await cachedResponse.json()
      return Array.isArray(payload?.features) && payload.features.length > 0
    },
  })

  return response
}

async function proxySmartSearch(request, env) {
  const url = new URL(request.url)
  const text = safeText(url.searchParams.get('text'))
  const intent = safeText(url.searchParams.get('intent'), 24).toLowerCase()
  if (!text) return json({ code: 'INVALID_QUERY', message: 'Enter an airport name, city, IATA, or ICAO code.' }, 400)
  if (intent !== 'airport') return proxyPelias(request, env, 'search')

  const size = Math.max(1, Math.min(12, Number(url.searchParams.get('size')) || 8))
  return searchAirportsOnly(request, text, size)
}

async function proxyPelias(request, env, endpoint) {
  const url = new URL(request.url)
  const text = safeText(url.searchParams.get('text'))
  if (!text && endpoint !== 'reverse') return json({ code: 'INVALID_QUERY', message: 'Enter a place or address.' }, 400)

  const params = {}
  url.searchParams.forEach((value, key) => {
    if (['text', 'size', 'focus.point.lat', 'focus.point.lon'].includes(key)) params[key] = safeText(value, 80)
  })
  if (endpoint === 'reverse') {
    const lat = finiteCoordinate(url.searchParams.get('lat'), -90, 90)
    const lon = finiteCoordinate(url.searchParams.get('lon'), -180, 180)
    if (lat == null || lon == null) return json({ code: 'INVALID_COORDINATES', message: 'Valid coordinates are required.' }, 400)
    params['point.lat'] = lat
    params['point.lon'] = lon
  } else {
    params.text = text
    params.size = Math.max(1, Math.min(12, Number(params.size) || 6))
    const focusLat = finiteCoordinate(params['focus.point.lat'], -90, 90)
    const focusLon = finiteCoordinate(params['focus.point.lon'], -180, 180)
    if (focusLat == null) delete params['focus.point.lat']
    if (focusLon == null) delete params['focus.point.lon']
  }

  const path = endpoint === 'reverse' ? 'reverse' : endpoint
  const target = `${HEIGIT_BASE}/pelias/v1/${path}?${encodeQuery(params)}`
  const cacheKey = `pelias/${path}/${encodeURIComponent(JSON.stringify(params))}`
  return cacheRequest(request, cacheKey, endpoint === 'autocomplete' ? 3600 : 43200, async () => {
    const upstream = await fetch(target, { headers: upstreamHeaders(env) })
    const data = await parseUpstream(upstream)
    return json(data, 200, quotaHeaders(upstream))
  }, {
    shouldCache: async (response) => {
      const payload = await response.json()
      return !Array.isArray(payload?.features) || payload.features.length > 0
    },
  })
}


function isLocalWorker(request) {
  try {
    const host = new URL(request.url).hostname
    return host === '127.0.0.1' || host === 'localhost'
  } catch {
    return false
  }
}


function mobilityDatabaseConfigured(env) {
  return Boolean(safeText(env.MOBILITY_DATABASE_REFRESH_TOKEN, 4096))
}

function mobilityTokenFresh() {
  return Boolean(
    MOBILITY_TOKEN_CACHE.accessToken
    && MOBILITY_TOKEN_CACHE.issuedAt
    && Date.now() - MOBILITY_TOKEN_CACHE.issuedAt < MOBILITY_TOKEN_REFRESH_AFTER_MS
  )
}

async function getMobilityDatabaseAccessToken(env, { forceRefresh = false } = {}) {
  if (!mobilityDatabaseConfigured(env)) {
    const error = new Error('Mobility Database is not configured. Add MOBILITY_DATABASE_REFRESH_TOKEN to the Worker secrets.')
    error.code = 'MOBILITY_DATABASE_NOT_CONFIGURED'
    error.status = 503
    throw error
  }

  if (!forceRefresh && mobilityTokenFresh()) return MOBILITY_TOKEN_CACHE.accessToken
  if (!forceRefresh && MOBILITY_TOKEN_PROMISE) return MOBILITY_TOKEN_PROMISE

  const refresh = async () => {
    const response = await fetch(`${MOBILITY_DATABASE_BASE}/v1/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        refresh_token: safeText(env.MOBILITY_DATABASE_REFRESH_TOKEN, 4096),
      }),
    })

    let payload = null
    try { payload = await response.json() } catch {}

    if (!response.ok) {
      const error = new Error('Mobility Database authentication failed.')
      error.code = 'MOBILITY_DATABASE_AUTH'
      error.status = response.status
      error.providerMessage = safeText(payload?.detail || payload?.details || payload?.message || payload?.error || `Mobility Database HTTP ${response.status}`, 240)
      throw error
    }

    const accessToken = safeText(
      payload?.access_token
      || payload?.accessToken
      || payload?.token
      || payload?.data?.access_token,
      8192,
    )

    if (!accessToken) {
      const error = new Error('Mobility Database did not return an access token.')
      error.code = 'MOBILITY_DATABASE_AUTH'
      error.status = 502
      throw error
    }

    MOBILITY_TOKEN_CACHE = { accessToken, issuedAt: Date.now() }
    return accessToken
  }

  if (forceRefresh) {
    MOBILITY_TOKEN_CACHE = { accessToken: '', issuedAt: 0 }
    return refresh()
  }

  MOBILITY_TOKEN_PROMISE = refresh()
  try {
    return await MOBILITY_TOKEN_PROMISE
  } finally {
    MOBILITY_TOKEN_PROMISE = null
  }
}

async function mobilityDatabaseFetch(env, path, {
  query = null,
  retryAuth = true,
} = {}) {
  const accessToken = await getMobilityDatabaseAccessToken(env)
  const qs = query ? encodeQuery(query) : ''
  const target = `${MOBILITY_DATABASE_BASE}${path}${qs ? `?${qs}` : ''}`

  let response = await fetch(target, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.status === 401 && retryAuth) {
    const refreshed = await getMobilityDatabaseAccessToken(env, { forceRefresh: true })
    response = await fetch(target, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${refreshed}`,
      },
    })
  }

  let payload = null
  try { payload = await response.json() } catch {}

  if (!response.ok) {
    const error = new Error('Mobility Database is temporarily unavailable.')
    error.code = 'MOBILITY_DATABASE_UNAVAILABLE'
    error.status = response.status
    error.providerMessage = safeText(payload?.detail || payload?.details || payload?.message || payload?.error || `Mobility Database HTTP ${response.status}`, 240)
    throw error
  }

  return payload
}

function mobilityFeedLocations(feed = {}) {
  return (Array.isArray(feed.locations) ? feed.locations : [])
    .map((location) => ({
      countryCode: safeText(location?.country_code, 8),
      subdivisionName: safeText(location?.subdivision_name, 120),
      municipality: safeText(location?.municipality, 120),
    }))
    .filter((location) => location.countryCode || location.subdivisionName || location.municipality)
}

function normalizeMobilityBoundingBox(value) {
  if (!value || typeof value !== 'object') return null
  const minimumLatitude = Number(value.minimum_latitude ?? value.minimumLatitude)
  const maximumLatitude = Number(value.maximum_latitude ?? value.maximumLatitude)
  const minimumLongitude = Number(value.minimum_longitude ?? value.minimumLongitude)
  const maximumLongitude = Number(value.maximum_longitude ?? value.maximumLongitude)
  if (![minimumLatitude, maximumLatitude, minimumLongitude, maximumLongitude].every(Number.isFinite)) return null
  return { minimumLatitude, maximumLatitude, minimumLongitude, maximumLongitude }
}

function mobilityBoxesIntersect(a, b) {
  if (!a || !b) return true
  return !(
    a.maximumLatitude < b.minimumLatitude
    || a.minimumLatitude > b.maximumLatitude
    || a.maximumLongitude < b.minimumLongitude
    || a.minimumLongitude > b.maximumLongitude
  )
}

function mobilityFeedSummary(feed = {}) {
  const sourceInfo = feed.source_info || {}
  const latestDataset = feed.latest_dataset || {}
  return {
    id: safeText(feed.id, 80),
    dataType: safeText(feed.data_type, 24),
    status: safeText(feed.status, 24),
    official: Boolean(feed.official),
    provider: safeText(feed.provider, 160),
    feedName: safeText(feed.feed_name || feed.name, 160),
    locations: mobilityFeedLocations(feed),
    latestDatasetId: safeText(latestDataset.id, 120),
    latestHostedUrl: safeText(latestDataset.hosted_url, 1000),
    downloadedAt: safeText(latestDataset.downloaded_at, 80),
    serviceDateStart: safeText(latestDataset.service_date_range_start, 80),
    serviceDateEnd: safeText(latestDataset.service_date_range_end, 80),
    agencyTimezone: safeText(latestDataset.agency_timezone, 100),
    licenseId: safeText(sourceInfo.license_id, 120),
    licenseUrl: safeText(sourceInfo.license_url, 1000),
    licenseTags: Array.isArray(sourceInfo.license_tags) ? sourceInfo.license_tags.map((value) => safeText(value, 120)).filter(Boolean) : [],
    boundingBox: normalizeMobilityBoundingBox(latestDataset.bounding_box || feed.bounding_box),
  }
}

function mobilityFeedScore(feed) {
  let score = 0
  if (feed.status === 'active') score += 500
  else if (feed.status === 'future') score += 120
  else if (feed.status === 'development') score -= 100
  else if (feed.status === 'inactive') score -= 250
  else if (feed.status === 'deprecated') score -= 500
  if (feed.official) score += 160
  if (feed.latestDatasetId) score += 40

  const serviceEnd = Date.parse(feed.serviceDateEnd || '')
  if (Number.isFinite(serviceEnd)) {
    if (serviceEnd >= Date.now() - 24 * 60 * 60 * 1000) score += 100
    else score -= 220
  }
  return score
}

function mobilityArray(payload, ...keys) {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

async function relatedRealtimeFeeds(env, feedId) {
  if (!feedId) return []
  try {
    const payload = await mobilityDatabaseFetch(env, `/v1/gtfs_feeds/${encodeURIComponent(feedId)}/gtfs_rt_feeds`)
    return mobilityArray(payload, 'gtfs_rt_feeds', 'feeds', 'results')
      .map((item) => ({
        id: safeText(item?.id, 80),
        provider: safeText(item?.provider, 160),
        feedName: safeText(item?.feed_name, 160),
        status: safeText(item?.status, 24),
        official: Boolean(item?.official),
        entityTypes: (Array.isArray(item?.entity_types) ? item.entity_types : Array.isArray(item?.entity_type) ? item.entity_type : [])
          .map((value) => safeText(value, 20)).filter(Boolean),
      }))
      .filter((item) => item.id)
  } catch (error) {
    console.warn(`Mobility Database realtime lookup failed for ${feedId}:`, error?.providerMessage || error?.message || error)
    return []
  }
}

async function proxyMobilityHealth(request, env) {
  if (!mobilityDatabaseConfigured(env)) {
    return json({
      ok: true,
      configured: false,
      provider: 'mobility-database',
      message: 'Add MOBILITY_DATABASE_REFRESH_TOKEN to worker/.dev.vars for local development.',
    }, 200)
  }

  const metadata = await mobilityDatabaseFetch(env, '/v1/metadata')
  return json({
    ok: true,
    configured: true,
    provider: 'mobility-database',
    accessTokenRefresh: 'on-demand-before-50-minutes',
    metadata,
  }, 200)
}

async function proxyMobilitySearch(request, env) {
  const url = new URL(request.url)
  const text = safeText(url.searchParams.get('text'), 160)
  const dataType = safeText(url.searchParams.get('data_type'), 80)
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 20))
  if (!text) return json({ code: 'INVALID_QUERY', message: 'Enter a place, provider, or feed name.' }, 400)

  const payload = await mobilityDatabaseFetch(env, '/v1/search', {
    query: {
      search_query: text,
      ...(dataType ? { data_type: dataType } : {}),
      limit,
    },
  })

  const results = mobilityArray(payload, 'results', 'feeds', 'gtfs_feeds', 'gtfs_rt_feeds')
  return json({
    provider: 'mobility-database',
    query: text,
    total: Number(payload?.total || results.length),
    results,
  }, 200)
}

async function proxyMobilityCoverage(request, env) {
  const body = await readBody(request)
  const latitude = finiteCoordinate(body?.latitude, -90, 90)
  const longitude = finiteCoordinate(body?.longitude, -180, 180)
  if (latitude == null || longitude == null) {
    return json({ code: 'INVALID_COORDINATES', message: 'Valid coordinates are required.' }, 400)
  }

  if (!mobilityDatabaseConfigured(env)) {
    return json({
      available: false,
      configured: false,
      provider: 'mobility-database',
      reason: 'not-configured',
      gtfsFeeds: [],
      gtfsCount: 0,
      realtimeCount: 0,
    }, 200)
  }

  const radiusKm = Math.max(5, Math.min(100, Number(body?.radiusKm) || 35))
  const limit = Math.max(1, Math.min(30, Number(body?.limit) || 12))
  const latDelta = radiusKm / 111.32
  const lonScale = Math.max(0.2, Math.cos(latitude * Math.PI / 180))
  const lonDelta = radiusKm / (111.32 * lonScale)
  const minLat = Math.max(-90, latitude - latDelta)
  const maxLat = Math.min(90, latitude + latDelta)
  const minLon = Math.max(-180, longitude - lonDelta)
  const maxLon = Math.min(180, longitude + lonDelta)

  const cacheKey = `mobility/coverage/${latitude.toFixed(2)},${longitude.toFixed(2)}/${radiusKm}/${limit}`
  return cacheRequest(request, cacheKey, 6 * 60 * 60, async () => {
    const payload = await mobilityDatabaseFetch(env, '/v1/gtfs_feeds', {
      query: {
        dataset_latitudes: `${minLat.toFixed(5)},${maxLat.toFixed(5)}`,
        dataset_longitudes: `${minLon.toFixed(5)},${maxLon.toFixed(5)}`,
        bounding_filter_method: 'partially_enclosed',
        limit: Math.max(limit * 2, 20),
      },
    })

    const requestedBox = {
      minimumLatitude: minLat,
      maximumLatitude: maxLat,
      minimumLongitude: minLon,
      maximumLongitude: maxLon,
    }
    const feeds = mobilityArray(payload, 'gtfs_feeds', 'feeds', 'results')
      .map(mobilityFeedSummary)
      .filter((feed) => feed.id && feed.dataType === 'gtfs')
      // Keep a local bounding-box check as a defensive guard in addition to the API filter.
      .filter((feed) => !feed.boundingBox || mobilityBoxesIntersect(feed.boundingBox, requestedBox))
      .sort((a, b) => mobilityFeedScore(b) - mobilityFeedScore(a))
      .slice(0, limit)

    // Realtime association requests are deliberately capped so catalog discovery
    // cannot fan out into dozens of API calls.
    const realtimePairs = await Promise.all(
      feeds.slice(0, 6).map(async (feed) => [feed.id, await relatedRealtimeFeeds(env, feed.id)]),
    )
    const realtimeByFeed = Object.fromEntries(realtimePairs)
    const enriched = feeds.map((feed) => ({
      ...feed,
      realtimeFeeds: realtimeByFeed[feed.id] || [],
    }))

    const realtimeCount = enriched.reduce((sum, feed) => sum + feed.realtimeFeeds.length, 0)
    return json({
      available: true,
      configured: true,
      provider: 'mobility-database',
      catalogOnly: true,
      radiusKm,
      gtfsFeeds: enriched,
      gtfsCount: enriched.length,
      activeGtfsCount: enriched.filter((feed) => feed.status === 'active').length,
      officialGtfsCount: enriched.filter((feed) => feed.official).length,
      realtimeCount,
      hasRealtime: realtimeCount > 0,
      note: 'Mobility Database discovers transit feeds. MOTIS remains the route engine and must load the relevant feeds before journeys can be routed.',
    }, 200, {
      'X-Mobility-Provider': 'mobility-database',
    })
  })
}

function transitBaseUrl(request, env) {
  const configured = safeText(env.MOTIS_BASE_URL, 300).replace(/\/$/, '')
  if (configured) return { url: configured, provider: 'motis' }
  // Transitous runs MOTIS and is used ONLY while Wrangler is local. The approved
  // architecture explicitly forbids using the public Transitous API as the
  // commercial production backend.
  if (isLocalWorker(request)) return { url: 'https://api.transitous.org', provider: 'transitous-dev' }
  return { url: '', provider: '' }
}

function overpassFeatureCollection(elements = [], provider = 'overpass-dev') {
  const features = elements.map((element) => {
    const lat = Number(element.lat ?? element.center?.lat)
    const lon = Number(element.lon ?? element.center?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    const tags = element.tags || {}
    return {
      type: 'Feature',
      id: `${element.type || 'osm'}-${element.id || ''}`,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        osm_id: element.id || '',
        osm_type: element.type || '',
        name: tags.name || tags['name:en'] || tags.brand || tags.operator || 'Nearby place',
        osm_tags: tags,
        category: tags.amenity || tags.tourism || tags.shop || tags.leisure || tags.historic || '',
      },
    }
  }).filter(Boolean)
  return { type: 'FeatureCollection', features, provider }
}

async function overpassNearbyDev(latitude, longitude, radiusMeters, limit) {
  const radius = Math.max(100, Math.min(2000, Number(radiusMeters) || 1800))
  const max = Math.max(1, Math.min(60, Number(limit) || 30))
  const query = `[out:json][timeout:15];(
    nwr(around:${radius},${latitude},${longitude})[amenity~"restaurant|cafe|fast_food|food_court|marketplace|cinema|theatre"];
    nwr(around:${radius},${latitude},${longitude})[tourism~"attraction|museum|gallery|hotel|hostel|guest_house|viewpoint"];
    nwr(around:${radius},${latitude},${longitude})[shop];
    nwr(around:${radius},${latitude},${longitude})[leisure~"park|garden|theme_park|amusement_arcade"];
    nwr(around:${radius},${latitude},${longitude})[historic];
  );out center tags ${max};`
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!response.ok) throw new Error(`Overpass development fallback returned ${response.status}`)
  const payload = await response.json()
  return overpassFeatureCollection(payload?.elements || [])
}

function normalizePoiGroups(groups = []) {
  return [...new Set((Array.isArray(groups) ? groups : [])
    .map((value) => Number(value))
    .filter((value) => OPENPOI_ALLOWED_GROUPS.has(value)))]
    .slice(0, 5)
}

async function fetchPoiBatch(env, latitude, longitude, radiusMeters, limit, categoryGroups) {
  const normalizedGroups = normalizePoiGroups(categoryGroups)
  if (!normalizedGroups.length) {
    const error = new Error('No valid OpenPOI category groups were provided.')
    error.code = 'INVALID_POI_GROUPS'
    error.status = 400
    throw error
  }
  const payload = {
    request: 'pois',
    geometry: {
      geojson: { type: 'Point', coordinates: [longitude, latitude] },
      buffer: radiusMeters,
    },
    filters: { category_group_ids: normalizedGroups },
    sortby: 'distance',
    limit,
  }

  const upstream = await fetch(`${HEIGIT_BASE}/openpoiservice/v0/pois`, {
    method: 'POST',
    headers: upstreamHeaders(env),
    body: JSON.stringify(payload),
  })
  const data = await parseUpstream(upstream)
  return { data, headers: quotaHeaders(upstream) }
}

function poiFeatureKey(feature) {
  const properties = feature?.properties || {}
  const coordinates = feature?.geometry?.coordinates || []
  const osmId = properties.osm_id || properties.osmId || feature?.id || ''
  const osmType = properties.osm_type || properties.osmType || ''
  if (osmId) return `${osmType}:${osmId}`
  return `${coordinates[0] || ''}:${coordinates[1] || ''}:${properties.name || ''}`
}

function mergePoiCollections(collections, limit) {
  const seen = new Set()
  const features = []
  for (const collection of collections) {
    for (const feature of collection?.features || []) {
      const key = poiFeatureKey(feature)
      if (seen.has(key)) continue
      seen.add(key)
      features.push(feature)
    }
  }

  features.sort((a, b) => {
    const aDistance = Number(a?.properties?.distance ?? Infinity)
    const bDistance = Number(b?.properties?.distance ?? Infinity)
    return aDistance - bDistance
  })

  return {
    type: 'FeatureCollection',
    features: features.slice(0, limit),
  }
}

async function proxyNearby(request, env) {
  const body = await readBody(request)
  const latitude = finiteCoordinate(body?.latitude, -90, 90)
  const longitude = finiteCoordinate(body?.longitude, -180, 180)
  const radiusMeters = Math.max(100, Math.min(2000, Number(body?.radiusMeters) || 1800))
  const limit = Math.max(1, Math.min(60, Number(body?.limit) || 30))
  const kind = safeText(body?.kind, 20).toLowerCase() === 'transport' ? 'transport' : 'ideas'
  if (latitude == null || longitude == null) return json({ code: 'INVALID_COORDINATES', message: 'Valid coordinates are required.' }, 400)

  const roundedLat = latitude.toFixed(3)
  const roundedLon = longitude.toFixed(3)
  const cacheKey = `nearby/${kind}/${roundedLat}/${roundedLon}/${radiusMeters}/${limit}`
  return cacheRequest(request, cacheKey, 43200, async () => {
    try {
      if (kind === 'transport') {
        // OpenPOI allows a maximum of five category groups per request. Transport is
        // one group, so a single request is enough for this legacy transport lookup.
        const result = await fetchPoiBatch(env, latitude, longitude, radiusMeters, limit, [580])
        return json(result.data, 200, {
          ...result.headers,
          'X-POI-Kind': kind,
          'X-POI-Provider': 'heigit',
          'X-POI-Requests': '1',
        })
      }

      // HeiGIT/OpenPOI currently accepts at most five category_group_ids per request.
      // Nearby Ideas needs broader coverage, so use two broad requests (not one request
      // per category) and merge/dedupe locally. This stays within the product target of
      // roughly 1–2 POI requests per normal planning session.
      const discoveryBatches = [
        // Food/cafes, shopping, tourist attractions/viewpoints, parks/entertainment, museums/galleries.
        [560, 420, 620, 260, 130],
        // Hotels/accommodation, historic landmarks, natural places.
        [100, 220, 330],
      ]

      const perBatchLimit = Math.min(60, Math.max(20, Math.ceil(limit * 0.8)))
      const results = []
      let lastHeaders = {}
      let firstError = null

      for (const groups of discoveryBatches) {
        try {
          const result = await fetchPoiBatch(env, latitude, longitude, radiusMeters, perBatchLimit, groups)
          results.push(result.data)
          lastHeaders = result.headers
        } catch (error) {
          firstError ||= error
        }
      }

      if (results.length) {
        const merged = mergePoiCollections(results, limit)
        return json(merged, 200, {
          ...lastHeaders,
          'X-POI-Kind': kind,
          'X-POI-Provider': 'heigit',
          'X-POI-Requests': String(results.length),
        })
      }

      throw firstError || new Error('Nearby place lookup failed')
    } catch (error) {
      // Public Overpass instances are not the production backend. This fallback exists
      // only during local Wrangler development so Nearby Ideas can still be tested if
      // the free HeiGIT POI service itself is temporarily unavailable.
      if (kind === 'ideas' && isLocalWorker(request)) {
        try {
          const fallback = await overpassNearbyDev(latitude, longitude, radiusMeters, limit)
          return json(fallback, 200, {
            'X-POI-Kind': kind,
            'X-POI-Provider': 'overpass-dev',
            'X-POI-Requests': 'fallback',
          })
        } catch (fallbackError) {
          console.error('Nearby development fallback failed:', fallbackError)
        }
      }
      throw error
    }
  })
}

function orsProfile(mode) {
  if (mode === 'walking') return 'foot-walking'
  if (mode === 'cycling') return 'cycling-regular'
  return 'driving-car'
}

async function proxyRoute(request, env) {
  const body = await readBody(request)
  const mode = safeText(body?.mode, 20).toLowerCase()
  if (!ALLOWED_ROUTE_MODES.has(mode)) return json({ code: 'INVALID_MODE', message: 'Route mode must be walking, cycling, or driving.' }, 400)

  const originLat = finiteCoordinate(body?.origin?.latitude, -90, 90)
  const originLon = finiteCoordinate(body?.origin?.longitude, -180, 180)
  const destLat = finiteCoordinate(body?.destination?.latitude, -90, 90)
  const destLon = finiteCoordinate(body?.destination?.longitude, -180, 180)
  if ([originLat, originLon, destLat, destLon].some((value) => value == null)) {
    return json({ code: 'INVALID_COORDINATES', message: 'Valid origin and destination coordinates are required.' }, 400)
  }

  const payload = {
    coordinates: [[originLon, originLat], [destLon, destLat]],
    instructions: true,
  }
  if (body?.alternatives) {
    payload.alternative_routes = { target_count: 2, share_factor: 0.6, weight_factor: 1.4 }
  }

  const cacheKey = `route/${mode}/${originLat.toFixed(5)},${originLon.toFixed(5)}/${destLat.toFixed(5)},${destLon.toFixed(5)}/${body?.alternatives ? 'alt' : 'single'}`
  return cacheRequest(request, cacheKey, 86400, async () => {
    const upstream = await fetch(`${HEIGIT_BASE}/openrouteservice/v2/directions/${orsProfile(mode)}/geojson`, {
      method: 'POST',
      headers: upstreamHeaders(env),
      body: JSON.stringify(payload),
    })
    const data = await parseUpstream(upstream)
    return json(data, 200, quotaHeaders(upstream))
  })
}


async function proxyTransitPlan(request, env) {
  const body = await readBody(request)
  const originLat = finiteCoordinate(body?.origin?.latitude, -90, 90)
  const originLon = finiteCoordinate(body?.origin?.longitude, -180, 180)
  const destLat = finiteCoordinate(body?.destination?.latitude, -90, 90)
  const destLon = finiteCoordinate(body?.destination?.longitude, -180, 180)
  if ([originLat, originLon, destLat, destLon].some((value) => value == null)) {
    return json({ code: 'INVALID_COORDINATES', message: 'Valid origin and destination coordinates are required.' }, 400)
  }

  const transit = transitBaseUrl(request, env)
  if (!transit.url) {
    return json({
      available: false,
      reason: 'not-configured',
      code: 'TRANSIT_NOT_CONFIGURED',
      message: 'Public transportation information is not configured for this environment yet.',
      itineraries: [],
    }, 200)
  }

  const params = new URLSearchParams()
  params.set('fromPlace', `${originLat},${originLon}`)
  params.set('toPlace', `${destLat},${destLon}`)
  params.set('transitModes', 'TRANSIT')
  params.set('directModes', '')
  params.set('preTransitModes', 'WALK')
  params.set('postTransitModes', 'WALK')
  params.set('radius', '1500')
  params.set('detailedLegs', 'true')
  params.set('detailedTransfers', 'true')
  params.set('joinInterlinedLegs', 'false')
  params.set('numItineraries', '5')
  params.set('maxItineraries', '8')
  params.set('searchWindow', '3600')
  params.set('realtimeMode', 'REALTIME')
  if (safeText(body?.time, 50)) params.set('time', safeText(body.time, 50))
  if (body?.arriveBy) params.set('arriveBy', 'true')

  const key = `transit/plan/${transit.provider}/${originLat.toFixed(4)},${originLon.toFixed(4)}/${destLat.toFixed(4)},${destLon.toFixed(4)}/${safeText(body?.time, 30)}/${body?.arriveBy ? 'arrive' : 'depart'}`
  return cacheRequest(request, key, transit.provider === 'transitous-dev' ? 45 : 60, async () => {
    const upstream = await fetch(`${transit.url}/api/v6/plan?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': WIKIMEDIA_USER_AGENT },
    })
    let data = null
    try { data = await upstream.json() } catch {}
    if (!upstream.ok) {
      const error = new Error('Public transportation routing is temporarily unavailable.')
      error.code = 'TRANSIT_UNAVAILABLE'
      error.status = upstream.status
      error.providerMessage = safeText(data?.message || data?.error || `MOTIS HTTP ${upstream.status}`, 240)
      throw error
    }
    return json({
      available: true,
      provider: transit.provider,
      providerLabel: transit.provider === 'transitous-dev' ? 'Transitous · MOTIS (development only)' : 'MOTIS',
      itineraries: Array.isArray(data?.itineraries) ? data.itineraries : [],
    }, 200, { 'X-Transit-Provider': transit.provider })
  })
}

function transitModesFromOsmTags(tags = {}) {
  const modes = new Set()
  const railway = String(tags.railway || '').toLowerCase()
  const publicTransport = String(tags.public_transport || '').toLowerCase()
  const highway = String(tags.highway || '').toLowerCase()
  const amenity = String(tags.amenity || '').toLowerCase()
  const route = String(tags.route || '').toLowerCase()
  if (highway === 'bus_stop' || amenity === 'bus_station' || route === 'bus') modes.add('BUS')
  if (railway === 'subway_entrance' || railway === 'station' || railway === 'halt' || publicTransport === 'station') modes.add('RAIL')
  if (railway === 'tram_stop' || route === 'tram') modes.add('TRAM')
  if (amenity === 'ferry_terminal' || route === 'ferry') modes.add('FERRY')
  if (!modes.size && (publicTransport === 'platform' || publicTransport === 'stop_position')) modes.add('TRANSIT')
  return [...modes]
}

async function overpassTransitStopsDev(latitude, longitude, radiusMeters, limit) {
  const radius = Math.max(150, Math.min(3000, Number(radiusMeters) || 1800))
  const max = Math.max(1, Math.min(60, Number(limit) || 30))
  const query = `[out:json][timeout:15];(
    nwr(around:${radius},${latitude},${longitude})[highway=bus_stop];
    nwr(around:${radius},${latitude},${longitude})[amenity=bus_station];
    nwr(around:${radius},${latitude},${longitude})[amenity=ferry_terminal];
    nwr(around:${radius},${latitude},${longitude})[railway~"station|halt|tram_stop|subway_entrance"];
    nwr(around:${radius},${latitude},${longitude})[public_transport~"station|platform|stop_position"];
  );out center tags ${max};`
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!response.ok) throw new Error(`Overpass transit fallback returned ${response.status}`)
  const payload = await response.json()
  const stops = (payload?.elements || []).map((element) => {
    const lat = Number(element.lat ?? element.center?.lat)
    const lon = Number(element.lon ?? element.center?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    const tags = element.tags || {}
    return {
      id: `osm-${element.type || 'node'}-${element.id || ''}`,
      stopId: `osm-${element.type || 'node'}-${element.id || ''}`,
      name: tags.name || tags['name:en'] || tags.ref || 'Transit stop',
      lat,
      lon,
      modes: transitModesFromOsmTags(tags),
      provider: 'overpass-dev',
      stopCode: tags.ref || tags.local_ref || '',
      description: tags.operator || '',
    }
  }).filter(Boolean)
  return stops.slice(0, max)
}

async function proxyTransitStops(request, env) {
  const body = await readBody(request)
  const latitude = finiteCoordinate(body?.latitude, -90, 90)
  const longitude = finiteCoordinate(body?.longitude, -180, 180)
  const radiusMeters = Math.max(150, Math.min(3000, Number(body?.radiusMeters) || 1800))
  const limit = Math.max(1, Math.min(60, Number(body?.limit) || 30))
  if (latitude == null || longitude == null) return json({ code: 'INVALID_COORDINATES', message: 'Valid coordinates are required.' }, 400)

  const transit = transitBaseUrl(request, env)
  if (!transit.url) return json({ available: false, reason: 'not-configured', stops: [] }, 200)

  const latDelta = radiusMeters / 111320
  const lonScale = Math.max(0.2, Math.cos(latitude * Math.PI / 180))
  const lonDelta = radiusMeters / (111320 * lonScale)
  const min = `${latitude - latDelta},${longitude - lonDelta}`
  const max = `${latitude + latDelta},${longitude + lonDelta}`
  const params = new URLSearchParams({ min, max, grouped: 'true', language: 'en' })
  const key = `transit/stops/${transit.provider}/${latitude.toFixed(3)},${longitude.toFixed(3)}/${radiusMeters}`

  return cacheRequest(request, key, 300, async () => {
    const upstream = await fetch(`${transit.url}/api/v6/map/stops?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': WIKIMEDIA_USER_AGENT },
    })
    let data = null
    try { data = await upstream.json() } catch {}
    if (!upstream.ok) {
      if (isLocalWorker(request)) {
        try {
          const stops = await overpassTransitStopsDev(latitude, longitude, radiusMeters, limit)
          return json({ available: true, provider: 'overpass-dev', stops }, 200, {
            'X-Transit-Provider': 'overpass-dev',
            'X-Transit-Fallback': 'nearby-stops-only',
          })
        } catch (fallbackError) {
          console.error('Nearby transit development fallback failed:', fallbackError)
        }
      }
      const error = new Error('Nearby public transportation is temporarily unavailable.')
      error.code = 'TRANSIT_UNAVAILABLE'
      error.status = upstream.status
      error.providerMessage = safeText(data?.message || data?.error || `MOTIS HTTP ${upstream.status}`, 240)
      throw error
    }
    const stops = (Array.isArray(data) ? data : []).slice(0, limit).map((stop) => ({ ...stop, provider: transit.provider }))
    return json({ available: true, provider: transit.provider, stops }, 200, { 'X-Transit-Provider': transit.provider })
  })
}

async function handle(request, env) {
  const url = new URL(request.url)
  const cors = corsHeaders(request, env)
  if (!originAllowed(request, env)) return json({ code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed to use the map proxy.' }, 403, { ...cors, 'X-Worker-Version': WORKER_VERSION })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (!allowRequest(request, Number(env.MAX_REQUESTS_PER_MINUTE) || 60)) {
    return json({ code: 'RATE_LIMITED', message: 'Too many location requests. Please wait a moment.' }, 429, { ...cors, 'X-Worker-Version': WORKER_VERSION })
  }

  try {
    let response
    if (url.pathname.endsWith('/api/maps/autocomplete') && request.method === 'GET') response = await proxyPelias(request, env, 'autocomplete')
    else if (url.pathname.endsWith('/api/maps/search') && request.method === 'GET') {
      const intent = safeText(url.searchParams.get('intent'), 24).toLowerCase()
      response = intent === 'airport'
        ? await proxySmartSearch(request, env)
        : await proxyPelias(request, env, 'search')
    }
    // Backward-compatible alias for v3.0.2 clients. New frontend code uses /search?intent=airport.
    else if (url.pathname.endsWith('/api/maps/smart-search') && request.method === 'GET') response = await proxySmartSearch(request, env)
    else if (url.pathname.endsWith('/api/maps/reverse-geocode') && request.method === 'GET') response = await proxyPelias(request, env, 'reverse')
    else if (url.pathname.endsWith('/api/maps/nearby') && request.method === 'POST') response = await proxyNearby(request, env)
    else if (url.pathname.endsWith('/api/maps/route') && request.method === 'POST') response = await proxyRoute(request, env)
    else if (url.pathname.endsWith('/api/maps/transit/plan') && request.method === 'POST') response = await proxyTransitPlan(request, env)
    else if (url.pathname.endsWith('/api/maps/transit/stops') && request.method === 'POST') response = await proxyTransitStops(request, env)
    else if (url.pathname.endsWith('/api/maps/mobility/health') && request.method === 'GET') response = await proxyMobilityHealth(request, env)
    else if (url.pathname.endsWith('/api/maps/mobility/search') && request.method === 'GET') response = await proxyMobilitySearch(request, env)
    else if (url.pathname.endsWith('/api/maps/mobility/coverage') && request.method === 'POST') response = await proxyMobilityCoverage(request, env)
    else if (url.pathname.endsWith('/api/maps/diagnostics')) {
      const transit = transitBaseUrl(request, env)
      response = json({
        ok: true,
        version: WORKER_VERSION,
        build: 'stabilize-search-mobility-catalog',
        routes: [
          '/api/maps/nearby',
          '/api/maps/route',
          '/api/maps/transit/plan',
          '/api/maps/transit/stops',
          '/api/maps/mobility/health',
          '/api/maps/mobility/search',
          '/api/maps/mobility/coverage',
        ],
        poiBatches: [[560, 420, 620, 260, 130], [100, 220, 330]],
        transitProvider: transit.provider || 'not-configured',
        transitBaseConfigured: Boolean(transit.url),
        mobilityDatabaseConfigured: mobilityDatabaseConfigured(env),
        mobilityTokenStrategy: 'refresh-on-demand-before-50-minutes',
      })
    }
    else if (url.pathname.endsWith('/api/maps/health')) {
      const transit = transitBaseUrl(request, env)
      response = json({
        ok: true,
        version: WORKER_VERSION,
        build: 'stabilize-search-mobility-catalog',
        provider: 'heigit',
        transitProvider: transit.provider || 'not-configured',
        mobilityDatabase: mobilityDatabaseConfigured(env) ? 'configured' : 'not-configured',
        mobilityTokenStrategy: 'refresh-on-demand-before-50-minutes',
        airportSearch: 'wikidata-only',
        poiMaxGroupsPerRequest: 5,
        transitEndpoints: true,
        paidFallback: false,
      })
    }
    else response = json({ code: 'NOT_FOUND', message: 'Map endpoint not found.' }, 404)

    const headers = new Headers(response.headers)
    Object.entries(cors).forEach(([key, value]) => headers.set(key, value))
    headers.set('X-Worker-Version', WORKER_VERSION)
    return new Response(response.body, { status: response.status, headers })
  } catch (error) {
    console.error('Map proxy error:', error)
    return json({
      code: error?.code || 'PROVIDER_UNAVAILABLE',
      message: error?.message || 'The free location service is temporarily unavailable.',
      providerStatus: Number(error?.status || 0) || undefined,
      providerMessage: error?.providerMessage || undefined,
    }, error?.status === 429 ? 429 : error?.status === 401 || error?.status === 403 ? error.status : 503, {
      ...cors,
      'X-Worker-Version': WORKER_VERSION,
    })
  }
}

export default { fetch: handle }

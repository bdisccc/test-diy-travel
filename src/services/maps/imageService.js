import { mapConfig } from './config.js'
import { cached } from './cache.js'
import { recordMapUsage } from './usage.js'

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'

function textScore(query, title) {
  const a = String(query || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const b = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!a || !b) return 0
  if (a === b) return 100
  if (b.includes(a) || a.includes(b)) return 75
  const aw = new Set(a.split(' '))
  const bw = b.split(' ')
  const overlap = bw.filter((word) => aw.has(word)).length
  return overlap * 10
}

async function wikiFetch(params, signal) {
  const url = new URL(WIKIPEDIA_API)
  Object.entries({ action: 'query', format: 'json', origin: '*', ...params }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Wikimedia HTTP ${response.status}`)
  return response.json()
}

async function commonsAttribution(fileName, signal) {
  if (!fileName) return null
  const url = new URL(COMMONS_API)
  const title = String(fileName).startsWith('File:') ? String(fileName) : `File:${fileName}`
  const params = {
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'imageinfo',
    titles: title,
    iiprop: 'url|extmetadata',
  }
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  const response = await fetch(url, { signal })
  if (!response.ok) return null
  const data = await response.json()
  const page = Object.values(data?.query?.pages || {})[0]
  const info = page?.imageinfo?.[0]
  if (!info) return null
  const meta = info.extmetadata || {}
  const strip = (value) => String(value || '').replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
  return {
    author: strip(meta.Artist?.value || meta.Credit?.value || ''),
    license: strip(meta.LicenseShortName?.value || meta.UsageTerms?.value || ''),
    licenseUrl: meta.LicenseUrl?.value || '',
    fileUrl: info.descriptionurl || '',
  }
}

function choosePage(pages, place) {
  const entries = Object.values(pages || {}).filter((page) => page?.thumbnail?.source)
  if (!entries.length) return null
  return entries
    .map((page) => ({ page, score: textScore(place.name || place.displayName, page.title) }))
    .sort((a, b) => b.score - a.score)[0]?.page || entries[0]
}

async function searchByName(place, signal) {
  const data = await wikiFetch({
    generator: 'search',
    gsrsearch: place.name || place.displayName || '',
    gsrlimit: 6,
    prop: 'pageimages|info',
    inprop: 'url',
    piprop: 'thumbnail|name',
    pithumbsize: 900,
    pilicense: 'free',
  }, signal)
  return choosePage(data?.query?.pages, place)
}

async function searchByCoordinates(place, signal) {
  const lat = Number(place.latitude)
  const lon = Number(place.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const data = await wikiFetch({
    generator: 'geosearch',
    ggscoord: `${lat}|${lon}`,
    ggsradius: 1500,
    ggslimit: 10,
    prop: 'coordinates|pageimages|info',
    inprop: 'url',
    piprop: 'thumbnail|name',
    pithumbsize: 900,
    pilicense: 'free',
  }, signal)
  return choosePage(data?.query?.pages, place)
}

export async function getPlaceImage(place, { signal = null, bypassCache = false } = {}) {
  if (place?.image?.url) return place.image
  const key = `image:v2:${place?.locationId || place?.providerId || place?.name || 'unknown'}`
  const result = await cached(key, mapConfig.cache.imageMs, async () => {
    recordMapUsage('imageRequests')
    let page = null
    // Nearby cards already have coordinates. Prefer a geographically local page first
    // so generic names do not accidentally pull a same-named place from another country.
    try { page = await searchByCoordinates(place, signal) } catch {}
    if (!page) {
      try { page = await searchByName(place, signal) } catch {}
    }
    if (!page?.thumbnail?.source) return null
    let attribution = null
    try { attribution = await commonsAttribution(page.pageimage, signal) } catch {}
    return {
      url: page.thumbnail.source,
      source: 'Wikimedia',
      attribution: attribution?.author || page.title,
      author: attribution?.author || '',
      license: attribution?.license || '',
      licenseUrl: attribution?.licenseUrl || '',
      pageUrl: attribution?.fileUrl || page.fullurl || `https://en.wikipedia.org/?curid=${page.pageid}`,
    }
  }, { bypass: bypassCache })
  recordMapUsage('', { cacheHit: result.cacheHit })
  return result.value
}

const MEMORY_CACHE = new Map()
const PENDING_REQUESTS = new Map()
const PREFIX = 'diy-travel-map-cache:'

function safeStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {}
  return null
}

export function roundCoordinate(value, precision = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return number.toFixed(precision)
}

export function coordinateCell(latitude, longitude, precision = 3) {
  return `${roundCoordinate(latitude, precision)},${roundCoordinate(longitude, precision)}`
}

export function getCached(key) {
  const now = Date.now()
  const memory = MEMORY_CACHE.get(key)
  if (memory && memory.expiresAt > now) return memory.value
  if (memory) MEMORY_CACHE.delete(key)

  const storage = safeStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(`${PREFIX}${key}`)
    if (!raw) return null
    const record = JSON.parse(raw)
    if (!record || record.expiresAt <= now) {
      storage.removeItem(`${PREFIX}${key}`)
      return null
    }
    MEMORY_CACHE.set(key, record)
    return record.value
  } catch {
    return null
  }
}

export function setCached(key, value, ttlMs) {
  const record = { value, expiresAt: Date.now() + Math.max(1000, Number(ttlMs) || 0) }
  MEMORY_CACHE.set(key, record)
  const storage = safeStorage()
  if (!storage) return value
  try {
    storage.setItem(`${PREFIX}${key}`, JSON.stringify(record))
  } catch {
    // Storage can be full/private. Memory cache still works.
  }
  return value
}

export async function cached(key, ttlMs, loader, { bypass = false, shouldCache = () => true } = {}) {
  if (!bypass) {
    const hit = getCached(key)
    if (hit != null) return { value: hit, cacheHit: true }
    if (PENDING_REQUESTS.has(key)) return { value: await PENDING_REQUESTS.get(key), cacheHit: true }
  }

  const request = Promise.resolve().then(loader)
  PENDING_REQUESTS.set(key, request)
  try {
    const value = await request
    if (shouldCache(value)) setCached(key, value, ttlMs)
    return { value, cacheHit: false }
  } finally {
    if (PENDING_REQUESTS.get(key) === request) PENDING_REQUESTS.delete(key)
  }
}

export function clearMapCache() {
  MEMORY_CACHE.clear()
  PENDING_REQUESTS.clear()
  const storage = safeStorage()
  if (!storage) return
  try {
    const keys = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((key) => storage.removeItem(key))
  } catch {}
}

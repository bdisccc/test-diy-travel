import { getMapUsageSnapshot } from '../services/maps/index.js'

export function installMapUsageDebugger() {
  if (!import.meta.env.DEV) return () => {}

  globalThis.MapUsage = {
    snapshot() {
      const value = getMapUsageSnapshot()
      console.table(value.daily)
      return value
    },
  }

  return () => {
    try { delete globalThis.MapUsage } catch {}
  }
}

import { getStreetTransportOptions, getStreetRoute } from './streetRoutingService.js'
import { getTransitJourneys, getNearbyTransitStops } from './transitRoutingService.js'
import { getMobilityCatalogStatus, getTransitCatalogCoverage } from './mobilityCatalogService.js'
import { bestJourneyByMode } from './transportNormalizer.js'

function emptyTransit(reason = '') {
  return { available: false, provider: '', reason, journeys: [] }
}

export async function getTransportOptions(origin, destination, options = {}) {
  const {
    includeTransit = true,
    includeCoverage = true,
    coverageRadiusKm = 35,
    coverageLimit = 12,
    ...transitOptions
  } = options

  const street = getStreetTransportOptions(origin, destination)

  if (!includeTransit) {
    return {
      street,
      transit: emptyTransit('not-requested'),
      transitModes: [],
      coverage: null,
    }
  }

  let transit = emptyTransit()
  try {
    transit = await getTransitJourneys(origin, destination, transitOptions)
  } catch (error) {
    if (error?.code === 'WORKER_VERSION_MISMATCH') throw error
    transit = { ...emptyTransit(error?.code || 'unavailable'), error }
  }

  let coverage = null
  if (includeCoverage && !(transit.journeys || []).length) {
    try {
      coverage = await getTransitCatalogCoverage(origin, {
        radiusKm: coverageRadiusKm,
        limit: coverageLimit,
        signal: transitOptions.signal || null,
      })
    } catch (error) {
      if (error?.code === 'WORKER_VERSION_MISMATCH') throw error
      coverage = {
        available: false,
        configured: true,
        provider: 'mobility-database',
        catalogOnly: true,
        reason: error?.code || 'unavailable',
        gtfsFeeds: [],
        gtfsCount: 0,
        realtimeCount: 0,
        hasRealtime: false,
        error,
      }
    }
  }

  return {
    street,
    transit,
    transitModes: bestJourneyByMode(transit.journeys || []),
    coverage,
  }
}

export {
  getStreetTransportOptions,
  getStreetRoute,
  getTransitJourneys,
  getNearbyTransitStops,
  getTransitCatalogCoverage,
  getMobilityCatalogStatus,
  bestJourneyByMode,
}

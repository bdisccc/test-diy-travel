import { getStreetTransportOptions, getStreetRoute } from './streetRoutingService.js'
import { getTransitJourneys, getNearbyTransitStops } from './transitRoutingService.js'
import { bestJourneyByMode } from './transportNormalizer.js'

export async function getTransportOptions(origin, destination, options = {}) {
  const { includeTransit = true, ...transitOptions } = options
  const street = getStreetTransportOptions(origin, destination)

  if (!includeTransit) {
    return {
      street,
      transit: { available: false, provider: '', reason: 'not-requested', journeys: [] },
      transitModes: [],
    }
  }

  let transit = { available: false, provider: '', reason: '', journeys: [] }
  try {
    transit = await getTransitJourneys(origin, destination, transitOptions)
  } catch (error) {
    transit = { available: false, provider: '', reason: error?.code || 'unavailable', journeys: [], error }
  }

  return {
    street,
    transit,
    transitModes: bestJourneyByMode(transit.journeys || []),
  }
}

export { getStreetTransportOptions, getStreetRoute, getTransitJourneys, getNearbyTransitStops, bestJourneyByMode }

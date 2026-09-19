import { getRoute, getRouteEstimates } from '../maps/routingService.js'

export function getStreetTransportOptions(origin, destination) {
  return getRouteEstimates(origin, destination)
}

export function getStreetRoute(origin, destination, mode, options = {}) {
  return getRoute(origin, destination, mode, options)
}

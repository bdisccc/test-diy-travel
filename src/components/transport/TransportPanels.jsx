import { useEffect, useState } from 'react'
import {
  Bike,
  BusFront,
  Car,
  ChevronDown,
  Footprints,
  LoaderCircle,
  MapPin,
  Navigation,
  Ship,
  TrainFront,
} from 'lucide-react'
import TripMap from '../TripMap.jsx'
import {
  formatDistance as formatMapDistance,
  haversineKm as mapHaversineKm,
} from '../../services/maps/index.js'
import {
  bestJourneyByMode,
  getNearbyTransitStops,
  getStreetRoute,
  getTransitCatalogCoverage,
  getTransportOptions,
  transportModeLabel,
} from '../../services/transportation/index.js'
import { isMapped } from '../../services/scheduling/tripSchedule.js'

export function TimelineLegSummary({ origin, destination }) {
  const distanceKm = mapHaversineKm(origin, destination)
  const [options, setOptions] = useState([])

  useEffect(() => {
    let cancelled = false
    if (distanceKm == null) {
      setOptions([])
      return () => { cancelled = true }
    }
    getTransportOptions(origin, destination, { includeTransit: false })
      .then((result) => { if (!cancelled) setOptions(result?.street || []) })
      .catch((error) => console.warn('Local travel estimate failed:', error))
    return () => { cancelled = true }
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude])

  if (distanceKm == null) return null
  const walk = options.find((option) => option.mode === 'WALK')
  const bike = options.find((option) => option.mode === 'BIKE')
  const drive = options.find((option) => option.mode === 'DRIVE')

  return (
    <div className="timeline-leg-summary">
      <div className="timeline-leg-destination"><Navigation size={13} /><span>Next stop · {formatMapDistance(distanceKm * 1000, true)}</span></div>
      <div className="timeline-leg-options timeline-leg-options-desktop">
        {walk?.route && <span><Footprints size={13} /> Walk {walk.route.localizedValues.duration.text}</span>}
        {bike?.route && <span><Bike size={13} /> Bike {bike.route.localizedValues.duration.text}</span>}
        {drive?.route && <span><Car size={13} /> Drive {drive.route.localizedValues.duration.text}</span>}
      </div>
      <details className="timeline-leg-mobile-dropdown">
        <summary><span><Navigation size={14} /> Travel estimates</span><ChevronDown size={15} /></summary>
        <div className="timeline-leg-mobile-menu">
          {walk?.route && <div className="timeline-leg-mobile-option"><span><Footprints size={15} /> Walk</span><strong>{walk.route.localizedValues.duration.text}</strong></div>}
          {bike?.route && <div className="timeline-leg-mobile-option"><span><Bike size={15} /> Bike</span><strong>{bike.route.localizedValues.duration.text}</strong></div>}
          {drive?.route && <div className="timeline-leg-mobile-option"><span><Car size={15} /> Drive / taxi</span><strong>{drive.route.localizedValues.duration.text}</strong></div>}
        </div>
      </details>
    </div>
  )
}


function transportIcon(mode, size = 18) {
  const normalized = String(mode || '').toUpperCase()
  if (normalized === 'WALK') return <Footprints size={size} />
  if (normalized === 'BIKE' || normalized === 'BICYCLE' || normalized === 'BIKE_SHARE') return <Bike size={size} />
  if (normalized === 'BUS' || normalized === 'COACH' || normalized === 'TROLLEYBUS') return <BusFront size={size} />
  if (normalized === 'FERRY') return <Ship size={size} />
  if (['SUBWAY', 'RAIL', 'TRAM', 'MONORAIL', 'FUNICULAR', 'CABLE_CAR'].includes(normalized)) return <TrainFront size={size} />
  return <Car size={size} />
}

function modeLabel(mode) {
  if (mode === 'BIKE') return 'Bike'
  if (mode === 'DRIVE') return 'Drive / taxi'
  return transportModeLabel(mode)
}

function transitJourneySummary(journey) {
  if (!journey) return ''
  const parts = []
  if (Number.isFinite(Number(journey.transfers))) parts.push(`${journey.transfers} transfer${journey.transfers === 1 ? '' : 's'}`)
  if (journey.walkingDistanceMeters > 0) parts.push(`${formatMapDistance(journey.walkingDistanceMeters)} walk`)
  return parts.join(' · ')
}

function serviceErrorMessage(error, fallback) {
  const base = error?.message || fallback
  const providerMessage = error?.details?.providerMessage || error?.details?.originalResponse?.providerMessage || ''
  if (import.meta.env.DEV && providerMessage && !String(base).includes(providerMessage)) {
    return `${base} Provider response: ${providerMessage}`
  }
  return base
}

function catalogCoverageMessage(coverage) {
  if (!coverage) return ''
  if (coverage.reason === 'not-configured' || coverage.configured === false) {
    return 'Transit feed discovery is not configured yet. Add the Mobility Database refresh token to the Worker secret file.'
  }
  if (coverage.gtfsCount > 0) {
    const feedText = `${coverage.gtfsCount} GTFS feed${coverage.gtfsCount === 1 ? '' : 's'}`
    const liveText = coverage.realtimeCount > 0
      ? ` · ${coverage.realtimeCount} related realtime feed${coverage.realtimeCount === 1 ? '' : 's'}`
      : ''
    return `Mobility Database found ${feedText}${liveText} near this area. Feed coverage exists, but the current MOTIS router did not return a public-transit journey for this leg and time.`
  }
  if (coverage.available) return 'Mobility Database did not find GTFS feed coverage near the start of this leg.'
  return ''
}

export function InAppRouteRecommendations({
  origin,
  destination,
  compact = false,
  date = '',
  time = '',
  utcOffsetMinutes = null,
  bufferMinutes = 0,
}) {
  const [estimates, setEstimates] = useState([])
  const [activeMode, setActiveMode] = useState('WALK')
  const [route, setRoute] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [transitJourneys, setTransitJourneys] = useState([])
  const [transitStatus, setTransitStatus] = useState('idle')
  const [transitMessage, setTransitMessage] = useState('')
  const [activeTransitJourney, setActiveTransitJourney] = useState(null)
  const [catalogCoverage, setCatalogCoverage] = useState(null)
  const ready = isMapped(origin) && isMapped(destination)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setRoute(null)
    setStatus('idle')
    setError('')
    setActiveTransitJourney(null)
    setTransitJourneys([])
    setTransitMessage('')
    setCatalogCoverage(null)
    if (!ready) {
      setEstimates([])
      setTransitStatus('idle')
      return () => controller.abort()
    }

    setTransitStatus('loading')
    getTransportOptions(origin, destination, { date, time, utcOffsetMinutes, bufferMinutes, signal: controller.signal })
      .then((result) => {
        if (cancelled) return
        const street = result?.street || []
        setEstimates(street)
        const walk = street.find((item) => item.mode === 'WALK')
        const shortest = street.filter((item) => item.route).sort((a, b) => (a.minutes || Infinity) - (b.minutes || Infinity))[0]
        setActiveMode(walk?.minutes <= 20 ? 'WALK' : (shortest?.mode || 'WALK'))

        const journeys = result?.transit?.journeys || []
        const coverage = result?.coverage || null
        setTransitJourneys(journeys)
        setCatalogCoverage(coverage)
        setTransitStatus(journeys.length ? 'ready' : 'empty')
        if (!journeys.length) {
          const coverageMessage = catalogCoverageMessage(coverage)
          const routerErrorMessage = result?.transit?.error
            ? serviceErrorMessage(result.transit.error, 'The public-transit router is temporarily unavailable.')
            : ''
          setTransitMessage(coverageMessage
            ? `${coverageMessage}${import.meta.env.DEV && routerErrorMessage ? ` ${routerErrorMessage}` : ''}`
            : (result?.transit?.reason === 'not-configured'
              ? 'Public transportation information is not configured for this environment yet.'
              : (routerErrorMessage || 'No public transportation route was found for this trip and time.')))
        }
      })
      .catch((transportError) => {
        if (cancelled || transportError?.name === 'AbortError') return
        console.warn('Transportation lookup unavailable:', transportError)
        setTransitStatus('error')
        setTransitMessage(serviceErrorMessage(transportError, 'Public transportation information is temporarily unavailable. Walk, bike, and drive still work.'))
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude, date, time, utcOffsetMinutes, bufferMinutes])

  async function loadDetailed(mode, forceRefresh = false) {
    if (!ready || status === 'loading') return
    setActiveTransitJourney(null)
    setActiveMode(mode)
    setStatus('loading')
    setError('')
    try {
      const detailed = await getStreetRoute(origin, destination, mode, { bypassCache: forceRefresh, alternatives: false })
      if (!detailed) throw new Error('No detailed route was returned for this trip.')
      setRoute(detailed)
      setStatus('ready')
    } catch (routeError) {
      console.warn('Detailed route unavailable:', routeError)
      setRoute(null)
      setStatus('error')
      setError(serviceErrorMessage(routeError, 'Detailed routes are temporarily unavailable. Approximate distances are still available.'))
    }
  }

  function openTransitJourney(journey) {
    setRoute(null)
    setStatus('idle')
    setError('')
    setActiveTransitJourney(journey)
  }

  if (!ready) {
    return <div className={`route-recommendation ${compact ? 'compact' : ''}`}><div className="route-loading"><MapPin size={17} /> Map both locations first</div></div>
  }

  const straightDistance = formatMapDistance((mapHaversineKm(origin, destination) || 0) * 1000, true)
  const transitModes = bestJourneyByMode(transitJourneys)

  return (
    <div className={`route-recommendation route-summary-only ${compact ? 'compact' : ''}`}>
      <div className="route-distance-banner">
        <MapPin size={16} />
        <span><strong>{origin?.location || origin?.name || 'Start'}</strong> → <strong>{destination?.location || destination?.name || 'Destination'}</strong></span>
        <b>{straightDistance}</b>
      </div>

      <div className="route-mode-actions route-mode-actions-dynamic" aria-label="Available transportation options">
        {estimates.map((option) => (
          <button
            type="button"
            key={option.mode}
            className={`route-mode-action ${!activeTransitJourney && activeMode === option.mode ? 'active' : ''}`}
            onClick={() => loadDetailed(option.mode)}
            disabled={status === 'loading'}
            title={`${modeLabel(option.mode)} · ${option.route?.localizedValues?.distance?.text || ''}`}
          >
            <span className="route-mode-name">{transportIcon(option.mode, 18)} <span>{modeLabel(option.mode)}</span></span>
            <strong className="route-mode-metric">{option.route?.localizedValues?.distance?.text || '—'}</strong>
            <small>{option.route?.localizedValues?.duration?.text || 'Estimate unavailable'}</small>
          </button>
        ))}

        {transitModes.map((journey) => (
          <button
            type="button"
            key={`${journey.primaryMode}-${journey.id}`}
            className={`route-mode-action transit-mode-action ${activeTransitJourney?.id === journey.id ? 'active' : ''}`}
            onClick={() => openTransitJourney(journey)}
            title={`${modeLabel(journey.primaryMode)} · ${journey.durationLabel}`}
          >
            <span className="route-mode-name">{transportIcon(journey.primaryMode, 18)} <span>{modeLabel(journey.primaryMode)}</span></span>
            <strong className="route-mode-metric">{journey.totalDistanceMeters > 0 ? formatMapDistance(journey.totalDistanceMeters) : journey.durationLabel}</strong>
            <small>{journey.durationLabel}{transitJourneySummary(journey) ? ` · ${transitJourneySummary(journey)}` : ""}</small>
          </button>
        ))}
      </div>

      {transitStatus === 'loading' && <div className="transit-inline-status"><LoaderCircle className="spin" size={13} /> Checking public transportation…</div>}
      {(transitStatus === 'empty' || transitStatus === 'error') && transitMessage && <div className="transit-inline-status muted">{transitMessage}</div>}

      {transitStatus === 'empty' && catalogCoverage?.gtfsCount > 0 && (
        <div className="route-provider-note"><span>Feed discovery · Mobility Database catalog. Journey routing still comes from MOTIS.</span></div>
      )}

      {status === 'loading' && <div className="route-loading"><LoaderCircle className="spin" size={18} /> Calculating {modeLabel(activeMode).toLowerCase()} route…</div>}
      {status === 'error' && <div className="route-error"><strong>Detailed route unavailable</strong><span>{error}</span></div>}

      {status === 'ready' && route && !activeTransitJourney && (
        <div className="route-detailed-card">
          <div className="route-detailed-card-head">
            <div><strong>{modeLabel(activeMode)} route</strong><span>{route.localizedValues.duration.text} · {route.localizedValues.distance.text}</span></div>
            <button type="button" className="ghost-button route-refresh" onClick={() => loadDetailed(activeMode, true)}>Refresh</button>
          </div>
          {route.geometry && <TripMap locations={[origin, destination]} routeGeometry={route.geometry} className="route-inline-map" />}
          <div className="route-provider-note route-provider-note-estimate"><span>Detailed street route from HeiGIT openrouteservice. No paid fallback is used.</span></div>
        </div>
      )}

      {activeTransitJourney && (
        <div className="route-detailed-card transit-journey-card">
          <div className="route-detailed-card-head">
            <div>
              <strong>{modeLabel(activeTransitJourney.primaryMode)} journey</strong>
              <span>{activeTransitJourney.durationLabel} · {activeTransitJourney.transfers} transfer{activeTransitJourney.transfers === 1 ? '' : 's'}{activeTransitJourney.walkingDistanceMeters ? ` · ${formatMapDistance(activeTransitJourney.walkingDistanceMeters)} walking` : ''}</span>
            </div>
          </div>
          {(activeTransitJourney.departureLabel || activeTransitJourney.arrivalLabel) && (
            <div className="transit-journey-times"><span>Depart <strong>{activeTransitJourney.departureLabel || '—'}</strong></span><span>Arrive <strong>{activeTransitJourney.arrivalLabel || '—'}</strong></span>{activeTransitJourney.realtime && <span className="transit-live-pill">Live data</span>}</div>
          )}
          <div className="transit-leg-list">
            {activeTransitJourney.legs.map((leg, index) => (
              <div className="transit-leg-row" key={`${activeTransitJourney.id}-${index}-${leg.type}`}>
                <div className="transit-leg-icon">{transportIcon(leg.type, 15)}</div>
                <div>
                  <strong>{leg.routeName || modeLabel(leg.type)}</strong>
                  <span>{leg.from?.name || 'Start'} → {leg.to?.name || 'Destination'}</span>
                  <small>{leg.durationMinutes} min{leg.stops ? ` · ${leg.stops} stop${leg.stops === 1 ? '' : 's'}` : ''}{leg.headsign ? ` · toward ${leg.headsign}` : ''}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="route-provider-note"><span>{activeTransitJourney.provider === 'transitous-dev' ? 'Development preview from Transitous/MOTIS. Production will use our configured MOTIS instance and verified transit feeds.' : 'Public-transit journey from MOTIS and configured open transit feeds.'}</span></div>
        </div>
      )}
    </div>
  )
}

export function NearbyTransportStops({ location }) {
  const [status, setStatus] = useState('idle')
  const [stops, setStops] = useState([])
  const [error, setError] = useState('')
  const [activeStop, setActiveStop] = useState(null)
  const [walkRoute, setWalkRoute] = useState(null)
  const [routeStatus, setRouteStatus] = useState('idle')
  const [routeError, setRouteError] = useState('')
  const [catalogCoverage, setCatalogCoverage] = useState(null)

  async function findStops(forceRefresh = false) {
    if (!isMapped(location) || status === 'loading') return
    setStatus('loading')
    setError('')
    setCatalogCoverage(null)
    try {
      const [result, coverage] = await Promise.all([
        getNearbyTransitStops(location, { radiusMeters: 1800, limit: 24, bypassCache: forceRefresh }),
        getTransitCatalogCoverage(location, { radiusKm: 35, limit: 12, bypassCache: forceRefresh }).catch((coverageError) => {
          if (coverageError?.code === 'WORKER_VERSION_MISMATCH') throw coverageError
          console.warn('Transit feed catalog lookup unavailable:', coverageError)
          return null
        }),
      ])
      setCatalogCoverage(coverage)
      setStops((result || []).slice(0, 12))
      setStatus('ready')
      if (!result?.length) {
        setError(catalogCoverageMessage(coverage) || 'No public transportation stops were found nearby in the available transit feeds.')
      }
    } catch (searchError) {
      console.warn('Nearby transportation lookup unavailable:', searchError)
      let coverage = null
      if (searchError?.code !== 'WORKER_VERSION_MISMATCH') {
        try {
          coverage = await getTransitCatalogCoverage(location, { radiusKm: 35, limit: 12, bypassCache: forceRefresh })
        } catch (coverageError) {
          if (coverageError?.code === 'WORKER_VERSION_MISMATCH') {
            setStatus('error')
            setStops([])
            setError(serviceErrorMessage(coverageError, 'The local map Worker is out of date.'))
            return
          }
        }
      }
      setCatalogCoverage(coverage)
      setStatus('error')
      setStops([])
      setError(catalogCoverageMessage(coverage) || serviceErrorMessage(searchError, 'Public transportation information is temporarily unavailable for this area. Street routes still work.'))
    }
  }

  useEffect(() => {
    if (!isMapped(location)) return undefined
    const timer = window.setTimeout(() => {
      findStops(false)
    }, 120)
    return () => window.clearTimeout(timer)
    // Run only when the mapped anchor actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude])

  async function loadWalkingRoute(stop) {
    setActiveStop(stop)
    setWalkRoute(null)
    setRouteStatus('loading')
    setRouteError('')
    try {
      const result = await getStreetRoute(location, stop, 'WALK')
      setWalkRoute(result)
      setRouteStatus('ready')
    } catch (walkError) {
      console.warn('Walking route to transit stop unavailable:', walkError)
      setRouteStatus('error')
      setRouteError(serviceErrorMessage(walkError, 'The detailed walking route is temporarily unavailable. The approximate stop distance is still shown.'))
    }
  }

  if (!isMapped(location)) return null

  return (
    <div className="nearby-transit-block">
      <div className="nearby-transit-head">
        <div><strong>Nearby transportation</strong><span>Actual transit stops from the configured MOTIS/GTFS coverage near {location.name || location.location || 'this location'}</span></div>
        <button
          type="button"
          className="secondary-button nearby-transit-action"
          onClick={() => findStops(Boolean(stops.length))}
          disabled={status === 'loading'}
          aria-busy={status === 'loading'}
          data-debug-name="Find nearby transit stops"
        >
          {status === 'loading' ? <LoaderCircle className="spin" size={15} /> : <TrainFront size={15} />}
          {status === 'loading' ? 'Finding…' : stops.length ? 'Refresh stops' : status === 'error' ? 'Try again' : 'Find stops'}
        </button>
      </div>
      {error && <div className={`nearby-transit-message ${status === 'error' ? 'error' : ''}`}>{error}</div>}
      {catalogCoverage?.gtfsCount > 0 && (
        <div className="route-provider-note"><span>Catalog coverage · {catalogCoverage.gtfsCount} GTFS feed{catalogCoverage.gtfsCount === 1 ? '' : 's'}{catalogCoverage.realtimeCount ? ` · ${catalogCoverage.realtimeCount} realtime` : ''} · Mobility Database</span></div>
      )}
      {stops.length > 0 && (
        <div className="nearby-transit-list">
          {stops.map((stop) => (
            <div className="nearby-transit-item" key={stop.locationId}>
              <div className="nearby-transit-icon">{transportIcon(stop.transitMode, 16)}</div>
              <div><strong>{stop.name}</strong><span>{(stop.modes || []).filter((mode) => mode !== 'WALK').map(modeLabel).slice(0, 3).join(' · ') || 'Transit'} · {formatMapDistance(stop.distanceMeters)}</span></div>
              <button type="button" className="ghost-button" onClick={() => loadWalkingRoute(stop)} disabled={routeStatus === 'loading' && activeStop?.locationId === stop.locationId}><Footprints size={14} /> Walk route</button>
            </div>
          ))}
        </div>
      )}
      {routeStatus === 'loading' && <div className="route-loading"><LoaderCircle className="spin" size={16} /> Calculating walking route…</div>}
      {routeStatus === 'error' && <div className="nearby-transit-message error">{routeError}</div>}
      {walkRoute && activeStop && (
        <div className="nearby-transit-route">
          <div><strong>Walk to {activeStop.name}</strong><span>{walkRoute.localizedValues.duration.text} · {walkRoute.localizedValues.distance.text}</span></div>
          {walkRoute.geometry && <TripMap locations={[location, activeStop]} routeGeometry={walkRoute.geometry} className="route-inline-map" />}
        </div>
      )}
    </div>
  )
}


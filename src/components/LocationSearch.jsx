import { Fragment, useEffect, useRef, useState } from 'react'
import { LoaderCircle, MapPin, Plane, Search } from 'lucide-react'
import { mapConfig, searchPlaces, suggestPlaces } from '../services/maps/index.js'

function resultSubtitle(place) {
  const meta = place?.metadata || {}
  if (meta.canonical) {
    const bits = []
    if (meta.officialName && meta.officialName !== place.name) bits.push(meta.officialName)
    if (meta.iata) bits.push(meta.iata)
    if (meta.icao) bits.push(meta.icao)
    if (meta.description) bits.push(meta.description)
    if (bits.length) return bits.join(' · ')
  }
  return place?.address || place?.displayName || 'Coordinates available'
}

function airportLocationLine(place) {
  const meta = place?.metadata || {}
  if (meta.locationLabel) return meta.locationLabel

  const fallback = [meta.locality, meta.region, meta.country]
    .map((value) => String(value || '').trim())
    .filter((value, index, items) => value && items.indexOf(value) === index)

  return fallback.join(', ') || 'Location available'
}

function airportCodeLine(place) {
  const meta = place?.metadata || {}
  return [meta.iata, meta.icao].filter(Boolean).join(' · ')
}

export default function LocationSearch({
  onSelect,
  placeholder = 'Search a place or address…',
  compact = false,
  focus = null,
  label = '',
  initialValue = '',
  onQueryChange = null,
  intent = 'generic',
}) {
  const [query, setQuery] = useState(initialValue || '')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [resultMode, setResultMode] = useState('suggestions')
  const rootRef = useRef(null)
  const controllerRef = useRef(null)
  const requestIdRef = useRef(0)
  const skipNextSuggestRef = useRef(false)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    if (initialValue !== undefined && initialValue !== null && String(initialValue) !== query) {
      skipNextSuggestRef.current = true
      setQuery(String(initialValue))
    }
  }, [initialValue])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setResults([])
        setActiveIndex(-1)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    const value = query.trim()
    if (skipNextSuggestRef.current) {
      skipNextSuggestRef.current = false
      return undefined
    }
    if (value.length < mapConfig.autocompleteMinChars) {
      controllerRef.current?.abort()
      setResults([])
      setActiveIndex(-1)
      setStatus('idle')
      setError('')
      return undefined
    }

    const requestId = ++requestIdRef.current
    const timer = window.setTimeout(async () => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      setStatus('searching')
      setError('')

      try {
        const places = await suggestPlaces(value, {
          focus,
          limit: 8,
          signal: controller.signal,
          intent,
        })
        if (requestId !== requestIdRef.current || controller.signal.aborted) return
        setResults(places)
        setActiveIndex(-1)
        setResultMode('suggestions')
        setStatus('ready')
      } catch (searchError) {
        if (controller.signal.aborted) return
        console.warn('Location suggestions unavailable:', searchError)
        if (requestId !== requestIdRef.current) return
        setResults([])
        setActiveIndex(-1)
        setStatus('error')
        setError(searchError?.message || 'Location suggestions are temporarily unavailable.')
      }
    }, mapConfig.autocompleteDebounceMs)

    return () => window.clearTimeout(timer)
  }, [query, focus?.latitude, focus?.longitude, intent])

  async function submitSearch(event) {
    event?.preventDefault?.()
    const value = query.trim()
    if (value.length < 2) return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setStatus('searching')
    setError('')

    try {
      const places = await searchPlaces(value, {
        focus,
        limit: 8,
        signal: controller.signal,
        bypassCache: true,
        intent,
      })
      if (controller.signal.aborted) return
      setResults(places)
      setActiveIndex(-1)
      setResultMode('search')
      setStatus('ready')
      if (!places.length) setError(intent === 'airport'
        ? 'No matching airports were found. Try an airport name, city, IATA code, or ICAO code.'
        : 'No matching places were found. Try another name, neighborhood, city, or address.')
    } catch (searchError) {
      if (controller.signal.aborted) return
      setStatus('error')
      setError(searchError?.message || 'Location search is temporarily unavailable.')
    }
  }

  function choose(place) {
    if (!place) return
    skipNextSuggestRef.current = true
    setQuery(place.name || place.displayName || '')
    setResults([])
    setActiveIndex(-1)
    setStatus('idle')
    setError('')
    onSelect?.(place)
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % results.length)
      return
    }

    if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault()
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1))
      return
    }

    if (event.key === 'Escape') {
      setResults([])
      setActiveIndex(-1)
      setError('')
      return
    }

    if (event.key === 'Enter' && results.length && activeIndex >= 0) {
      event.preventDefault()
      choose(results[activeIndex])
    }
  }

  const hasCanonicalResult = Boolean(results[0]?.metadata?.canonical)
  const airportMode = intent === 'airport'

  return (
    <div ref={rootRef} className={`location-search ${compact ? 'compact' : ''}`}>
      {label && <span className="location-search-label">{label}</span>}
      <form className="location-search-box" onSubmit={submitSearch}>
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setResults([])
            setActiveIndex(-1)
            setResultMode('suggestions')
            setError('')
            onQueryChange?.(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
        />
        {status === 'searching' && <LoaderCircle className="spin" size={17} aria-label="Searching places" />}
      </form>

      {results.length > 0 && (
        <div className="location-results" role="listbox" aria-label="Place suggestions">
          {results.map((place, index) => {
            const isCanonical = Boolean(place.metadata?.canonical)
            const strongGenericMatch = resultMode === 'search' && index === 0 && place.metadata?.matchStrength === 'strong'
            const isBestMatch = airportMode ? index === 0 : (isCanonical || strongGenericMatch)
            const ResultIcon = airportMode ? Plane : MapPin
            return (
              <Fragment key={place.locationId}>
                {airportMode && index === 1 && <div className="location-results-divider">Other airports</div>}
                {!airportMode && (hasCanonicalResult || (resultMode === 'search' && results[0]?.metadata?.matchStrength === 'strong')) && index === 1 && <div className="location-results-divider">Other matches</div>}
                <button
                  type="button"
                  className={`location-result ${index === activeIndex ? 'is-active' : ''} ${isBestMatch ? 'is-canonical' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(place)}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <ResultIcon size={16} />
                  <span className="location-result-copy">
                    <span className="location-result-title">
                      <strong>{place.name}</strong>
                      {isBestMatch && <em>Best match</em>}
                    </span>
                    {airportMode ? (
                      <>
                        <small className="airport-result-location">{airportLocationLine(place)}</small>
                        {airportCodeLine(place) && <small className="airport-result-codes">{airportCodeLine(place)}</small>}
                      </>
                    ) : (
                      <small>{resultSubtitle(place)}</small>
                    )}
                  </span>
                </button>
              </Fragment>
            )
          })}
          <div className="location-source">
            {airportMode ? 'Airport data · Wikidata' : 'OpenStreetMap data · search by HeiGIT'}
          </div>
        </div>
      )}

      {error && <div className="location-search-error">{error}</div>}
    </div>
  )
}

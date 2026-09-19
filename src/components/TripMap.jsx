import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, MapPin } from 'lucide-react'
import { isMappedLocation } from '../services/maps/index.js'
import { loadMapLibre, mapStyleUrl } from '../services/maps/mapProvider.js'

export default function TripMap({ locations = [], routeGeometry = null, className = '' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const mappedLocations = useMemo(
    () => locations.filter((item) => isMappedLocation(item?.locationData || item)).slice(0, 50),
    [locations],
  )

  useEffect(() => {
    let cancelled = false
    let resizeObserver

    async function init() {
      if (!containerRef.current || mapRef.current) return
      try {
        const maplibregl = await loadMapLibre()
        if (cancelled || !containerRef.current) return
        const first = mappedLocations[0]?.locationData || mappedLocations[0]
        const center = first ? [Number(first.longitude), Number(first.latitude)] : [121.5654, 25.033]
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: mapStyleUrl(),
          center,
          zoom: first ? 12 : 4,
          attributionControl: false,
        })
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
        map.addControl(new maplibregl.AttributionControl({
          compact: true,
          customAttribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>',
        }), 'bottom-right')
        map.on('load', () => !cancelled && setStatus('ready'))
        map.on('error', (event) => {
          if (!cancelled && event?.error) console.warn('MapLibre map warning:', event.error)
        })
        mapRef.current = map

        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(() => map.resize())
          resizeObserver.observe(containerRef.current)
        }
      } catch (mapError) {
        console.warn('MapLibre failed to initialize:', mapError)
        if (!cancelled) {
          setStatus('error')
          setError('The interactive map is temporarily unavailable. Your itinerary is still saved.')
        }
      }
    }

    init()
    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return
    const maplibregl = globalThis.maplibregl
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []
    if (!maplibregl) return

    const bounds = new maplibregl.LngLatBounds()
    mappedLocations.forEach((entry, index) => {
      const location = entry.locationData || entry
      const longitude = Number(location.longitude)
      const latitude = Number(location.latitude)
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return
      const element = document.createElement('button')
      element.type = 'button'
      element.className = 'trip-map-marker'
      const label = document.createElement('span')
      label.textContent = String(index + 1)
      element.appendChild(label)
      element.title = entry.title || location.name || location.location || 'Trip stop'
      const marker = new maplibregl.Marker({ element }).setLngLat([longitude, latitude]).addTo(map)
      markersRef.current.push(marker)
      bounds.extend([longitude, latitude])
    })

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 42, maxZoom: 15, duration: 450 })
    }
  }, [mappedLocations, status])

  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return
    const sourceId = 'diy-travel-route'
    const layerId = 'diy-travel-route-line'
    if (!routeGeometry) {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
      return
    }

    const data = { type: 'Feature', geometry: routeGeometry, properties: {} }
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(data)
    } else {
      map.addSource(sourceId, { type: 'geojson', data })
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: { 'line-width': 5, 'line-opacity': 0.82, 'line-color': '#166a58' },
      })
    }
  }, [routeGeometry, status])

  return (
    <div className={`trip-map ${className}`}>
      <div ref={containerRef} className="trip-map-canvas" />
      {status === 'loading' && <div className="trip-map-state"><LoaderCircle className="spin" size={19} /> Loading map…</div>}
      {status === 'error' && <div className="trip-map-state error"><MapPin size={18} /> {error}</div>}
    </div>
  )
}

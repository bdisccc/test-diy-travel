import { useEffect, useMemo, useRef, useState } from 'react'
import { Coffee, Hotel, Landmark, LoaderCircle, MapPin, ShoppingBag, TrainFront, Trees, Utensils } from 'lucide-react'
import { getPlaceImage } from '../services/maps/index.js'

function categoryIcon(category, size = 20) {
  const value = String(category || '').toLowerCase()
  if (value.includes('cafe')) return <Coffee size={size} />
  if (value.includes('food') || value.includes('restaurant')) return <Utensils size={size} />
  if (value.includes('shopping') || value.includes('store')) return <ShoppingBag size={size} />
  if (value.includes('hotel') || value.includes('stay')) return <Hotel size={size} />
  if (value.includes('nature') || value.includes('park')) return <Trees size={size} />
  if (value.includes('transport') || value.includes('station')) return <TrainFront size={size} />
  if (value.includes('museum') || value.includes('attraction')) return <Landmark size={size} />
  return <MapPin size={size} />
}

export default function PlacePhoto({ place = null, name = 'Place', className = '' }) {
  const figureRef = useRef(null)
  const embedded = useMemo(() => place?.image?.url ? place.image : null, [place?.image?.url])
  const [photo, setPhoto] = useState(embedded)
  const [visible, setVisible] = useState(Boolean(embedded))
  const [status, setStatus] = useState(embedded ? 'ready' : 'idle')

  useEffect(() => {
    const node = figureRef.current
    if (!node || embedded) {
      setVisible(true)
      return undefined
    }
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '220px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [embedded])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    if (embedded) {
      setPhoto(embedded)
      setStatus('ready')
      return () => controller.abort()
    }
    if (!visible || !place) return () => controller.abort()

    setStatus('loading')
    getPlaceImage(place, { signal: controller.signal })
      .then((image) => {
        if (cancelled) return
        setPhoto(image)
        setStatus(image?.url ? 'ready' : 'empty')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.warn('Wikimedia image unavailable:', error)
        if (!cancelled) setStatus('empty')
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [embedded, visible, place?.locationId, place?.name])

  return (
    <figure ref={figureRef} className={`place-photo ${className} ${status}`}>
      {status === 'loading' || status === 'idle' ? (
        <div className="place-photo-skeleton"><LoaderCircle size={18} /></div>
      ) : status === 'ready' ? (
        <>
          <img src={photo.url} alt={name} loading="lazy" onError={() => setStatus('empty')} />
          <figcaption>
            {photo.pageUrl ? <a href={photo.pageUrl} target="_blank" rel="noreferrer">{photo.attribution || 'Wikimedia'}</a> : <span>{photo.attribution || 'Wikimedia'}</span>}
            <span className="photo-source">{[photo.source || 'Wikimedia', photo.license].filter(Boolean).join(' · ')}</span>
          </figcaption>
        </>
      ) : (
        <div className="place-photo-empty" aria-label={`No image available for ${name}`}>
          {categoryIcon(place?.category || place?.primaryTypeDisplayName)}
          <span>{place?.category || 'Place'}</span>
        </div>
      )}
    </figure>
  )
}

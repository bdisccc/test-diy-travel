import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, MapPin } from 'lucide-react'
import { getGooglePlacePhoto } from '../googleMaps.js'

function photoFromPlaceData(place) {
  if (!place?.photoURI) return null
  return {
    uri: place.photoURI,
    attributions: place.photoAttributions || [],
    googleMapsURI: place.photoGoogleMapsURI || '',
  }
}

export default function PlacePhoto({ placeId, place = null, name = 'Place', className = '' }) {
  const figureRef = useRef(null)
  const embeddedPhoto = photoFromPlaceData(place)
  const [photo, setPhoto] = useState(embeddedPhoto)
  const [visible, setVisible] = useState(Boolean(embeddedPhoto))
  const [status, setStatus] = useState(embeddedPhoto?.uri ? 'ready' : placeId ? 'idle' : 'empty')

  useEffect(() => {
    const node = figureRef.current
    if (!node || embeddedPhoto?.uri || !placeId) {
      setVisible(true)
      return undefined
    }

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '180px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [embeddedPhoto?.uri, placeId])

  useEffect(() => {
    let cancelled = false

    if (embeddedPhoto?.uri) {
      setPhoto(embeddedPhoto)
      setStatus('ready')
      return () => { cancelled = true }
    }

    if (!placeId) {
      setPhoto(null)
      setStatus('empty')
      return () => { cancelled = true }
    }

    if (!visible) {
      setStatus('idle')
      return () => { cancelled = true }
    }

    setStatus('loading')
    getGooglePlacePhoto(placeId, { maxWidth: 900, maxHeight: 650 })
      .then((result) => {
        if (cancelled) return
        setPhoto(result)
        setStatus(result?.uri ? 'ready' : 'empty')
      })
      .catch((error) => {
        console.warn('Google place photo unavailable:', error)
        if (!cancelled) setStatus('empty')
      })

    return () => { cancelled = true }
  }, [placeId, embeddedPhoto?.uri, visible])

  return (
    <figure ref={figureRef} className={`place-photo ${className} ${status}`}>
      {status === 'loading' || status === 'idle' ? (
        <div className="place-photo-skeleton"><LoaderCircle size={18} /></div>
      ) : status === 'ready' ? (
        <>
          <img src={photo.uri} alt={name} loading="lazy" />
          <figcaption>
            {photo.attributions?.slice(0, 1).map((item, index) => (
              item.uri
                ? <a key={`${item.displayName}-${index}`} href={item.uri} target="_blank" rel="noreferrer">Photo: {item.displayName || 'Contributor'}</a>
                : <span key={index}>Photo: {item.displayName || 'Contributor'}</span>
            ))}
            <span className="photo-maps-attribution">Google Maps</span>
          </figcaption>
        </>
      ) : (
        <div className="place-photo-empty" aria-label={`No photo available for ${name}`}>
          <MapPin size={18} />
          <span>Nearby</span>
        </div>
      )}
    </figure>
  )
}

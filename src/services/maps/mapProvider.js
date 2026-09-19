import { mapConfig } from './config.js'

let mapLibrePromise

export function loadMapLibre() {
  if (globalThis.maplibregl?.Map) return Promise.resolve(globalThis.maplibregl)
  if (mapLibrePromise) return mapLibrePromise

  mapLibrePromise = new Promise((resolve, reject) => {
    const cssId = 'diy-travel-maplibre-css'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = mapConfig.mapLibreCssUrl
      document.head.appendChild(link)
    }

    const existing = document.querySelector('script[data-diy-travel-maplibre]')
    if (existing) {
      existing.addEventListener('load', () => resolve(globalThis.maplibregl), { once: true })
      existing.addEventListener('error', () => reject(new Error('MapLibre failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = mapConfig.mapLibreJsUrl
    script.async = true
    script.dataset.diyTravelMaplibre = 'true'
    script.onload = () => resolve(globalThis.maplibregl)
    script.onerror = () => {
      mapLibrePromise = undefined
      reject(new Error('MapLibre failed to load.'))
    }
    document.head.appendChild(script)
  })

  return mapLibrePromise
}

export function mapStyleUrl() {
  return mapConfig.mapStyleUrl
}

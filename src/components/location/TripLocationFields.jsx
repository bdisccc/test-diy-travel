import { ExternalLink, MapPin } from 'lucide-react'
import LocationSearch from '../LocationSearch.jsx'
import { emptyLocationFields, locationMapUrl } from '../../services/maps/index.js'
import { isMapped } from '../../services/scheduling/tripSchedule.js'

export function AirportLocationField({ title, value, onChange, onPlaceSelect }) {
  function clearMappedLocation(nextValue) {
    onChange({
      location: nextValue,
      ...emptyLocationFields(),
    })
  }

  const airportMeta = value.metadata || {}
  const airportCodeValues = [airportMeta.shortcut, airportMeta.iata, airportMeta.icao]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  const airportCodes = [...new Set(airportCodeValues)].join(' · ')
  const officialAirportName = airportMeta.officialName && airportMeta.officialName !== value.location
    ? airportMeta.officialName
    : ''
  const airportIdentity = [officialAirportName, airportCodes].filter(Boolean).join(' · ')

  return (
    <div className="manual-flight-airport-field">
      <label><span>{title} airport</span></label>
      <LocationSearch
        compact
        intent="airport"
        initialValue={value.location || ''}
        placeholder="Search airport, city, code, or shortcut…"
        onQueryChange={(nextValue) => {
          if (nextValue !== value.location) clearMappedLocation(nextValue)
        }}
        onSelect={(place) => onPlaceSelect?.(place)}
      />
      {isMapped(value) && (
        <div className="airport-field-details mapped">
          <MapPin size={16} />
          <div>
            <strong>{value.location || value.name || 'Selected location'}</strong>
            {airportIdentity && <small className="airport-selected-identity">{airportIdentity}</small>}
            <span>{value.address || value.displayName || 'Coordinates saved for routes.'}</span>
          </div>
          <a href={locationMapUrl(value)} target="_blank" rel="noreferrer" title="Open in OpenStreetMap"><ExternalLink size={15} /></a>
        </div>
      )}
    </div>
  )
}


export function MappedLocationSummary({ value, emptyText = 'Not mapped yet' }) {
  if (!isMapped(value)) return <div className="mapped-location empty"><MapPin size={15} /><span>{emptyText}</span></div>
  return (
    <div className="mapped-location">
      <MapPin size={15} />
      <div>
        <strong>{value.location || value.name || 'Mapped location'}</strong>
        <span>{value.address || 'Coordinates saved'}</span>
      </div>
      {isMapped(value) && <a href={locationMapUrl(value)} target="_blank" rel="noreferrer" title="Open in OpenStreetMap"><ExternalLink size={14} /></a>}
    </div>
  )
}


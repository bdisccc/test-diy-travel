function searchableText(...values) {
  return values.flatMap((value) => {
    if (!value) return []
    if (typeof value === 'string') return [value]
    return [value.name, value.location, value.address, value.city, value.country].filter(Boolean)
  }).join(' ').toLowerCase()
}

export function detectTransitRegion(origin, destination) {
  const text = searchableText(origin, destination)
  if (/philippines|metro manila|manila|makati|pasay|quezon city|mandaluyong|taguig|pasig/.test(text)) return 'PH'
  if (/japan|tokyo|osaka|kyoto|yokohama|nagoya|sapporo|fukuoka|kobe|nara/.test(text)) return 'JP'
  if (/taiwan|taipei|kaohsiung|tainan|taichung|taoyuan|hsinchu|keelung/.test(text)) return 'TW'
  return ''
}

export function regionalTransitSource(origin, destination) {
  const region = detectTransitRegion(origin, destination)
  if (region === 'PH') {
    return {
      region,
      title: 'Metro Manila transit reference',
      provider: 'Sakay.ph',
      description: 'Sakay.ph provides community/open GTFS route data for Metro Manila. Use it as a route reference and confirm current service locally.',
      actionLabel: 'Open Sakay.ph',
      actionUrl: 'https://sakay.ph/',
      sourceLabel: 'GTFS source',
      sourceUrl: 'https://github.com/sakayph/gtfs',
      caution: 'The public Sakay GTFS repository came from the Philippine Transit App Challenge, so it should not be treated as a guaranteed live timetable.',
    }
  }
  if (region === 'JP') {
    return {
      region,
      title: 'Japan official transit data',
      provider: 'ODPT',
      description: 'ODPT publishes official railway, bus, airline and passenger-ship data from participating Japanese operators, including dynamic data where available.',
      actionLabel: 'View ODPT',
      actionUrl: 'https://www.odpt.org/',
      sourceLabel: 'Developer data',
      sourceUrl: 'https://developer.odpt.org/',
      caution: 'Direct in-app timetable lookup needs an ODPT developer token and operator-specific data matching.',
    }
  }
  if (region === 'TW') {
    return {
      region,
      title: 'Taiwan official schedules',
      provider: 'TDX / Taiwan Railway',
      description: 'Taiwan TDX provides official rail, bus and shipping datasets. Taiwan Railway also publishes a traveler-facing timetable search.',
      actionLabel: 'Check Taiwan Rail schedule',
      actionUrl: 'https://tip.railway.gov.tw/tra-tip-web/tip/tip001/tip112/gobystation',
      sourceLabel: 'TDX data',
      sourceUrl: 'https://tdx.transportdata.tw/',
      caution: 'TDX programmatic access requires credentials for normal app use; the timetable link works as a traveler fallback.',
    }
  }
  return null
}

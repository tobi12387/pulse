import { redis } from './redis.js'

export interface WeatherSnapshot {
  date: string              // YYYY-MM-DD (local date of the snapshot)
  tempC: number
  feelsC: number
  humidityPct: number
  windKmh: number
  windDir: number           // 0-359 degrees
  precipMm: number          // last 1h or 0
  conditions: string        // 'clear' | 'clouds' | 'rain' | 'snow' | 'thunderstorm' | 'fog' | 'other'
  sunriseTime: string | null  // ISO timestamp
  sunsetTime: string | null   // ISO timestamp
}

type OWCondition = 'clear' | 'clouds' | 'rain' | 'snow' | 'thunderstorm' | 'fog' | 'other'

const BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall'

function getApiKey(): string | null {
  return process.env['OPENWEATHER_API_KEY'] ?? null
}

function fmt(n: number): string {
  return n.toFixed(4)
}

function cacheKey(type: 'current' | 'forecast' | 'hist', lat: number, lon: number, extra?: string | number): string {
  const coords = `${fmt(lat)},${fmt(lon)}`
  if (type === 'hist') return `weather:hist:${coords}:${extra}`
  if (type === 'forecast') return `weather:forecast:${coords}:${extra}`
  return `weather:current:${coords}`
}

function mapCondition(main: string): OWCondition {
  switch (main) {
    case 'Clear': return 'clear'
    case 'Clouds': return 'clouds'
    case 'Rain':
    case 'Drizzle': return 'rain'
    case 'Snow': return 'snow'
    case 'Thunderstorm': return 'thunderstorm'
    case 'Mist':
    case 'Fog':
    case 'Haze':
    case 'Smoke':
    case 'Dust':
    case 'Sand':
    case 'Ash':
    case 'Squall':
    case 'Tornado': return 'fog'
    default: return 'other'
  }
}

function unixToIso(ts: number): string {
  return new Date(ts * 1000).toISOString()
}

function unixToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

interface OWCurrentData {
  dt: number
  temp: number
  feels_like: number
  humidity: number
  wind_speed: number
  wind_deg: number
  rain?: { '1h'?: number }
  snow?: { '1h'?: number }
  weather: Array<{ main: string }>
  sunrise?: number
  sunset?: number
}

function parseSnapshot(data: OWCurrentData, sunriseTs?: number, sunsetTs?: number): WeatherSnapshot {
  const precipMm = data.rain?.['1h'] ?? data.snow?.['1h'] ?? 0
  const sunrise = data.sunrise ?? sunriseTs
  const sunset = data.sunset ?? sunsetTs
  return {
    date: unixToDate(data.dt),
    tempC: data.temp,
    feelsC: data.feels_like,
    humidityPct: data.humidity,
    windKmh: Math.round(data.wind_speed * 3.6 * 10) / 10,
    windDir: data.wind_deg,
    precipMm,
    conditions: mapCondition(data.weather[0]?.main ?? ''),
    sunriseTime: sunrise != null ? unixToIso(sunrise) : null,
    sunsetTime: sunset != null ? unixToIso(sunset) : null,
  }
}

async function fetchOW(url: string, timeoutMs = 6000): Promise<unknown | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) {
      console.warn(`[weather] non-200 response: ${res.status} ${res.statusText} — ${url}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn('[weather] fetch error:', (err as Error).message)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Current conditions for a location. Cached for 10 min. Returns null if API key missing or fetch fails. */
export async function getCurrentWeather(args: {
  latitude: number
  longitude: number
}): Promise<WeatherSnapshot | null> {
  const key = process.env['OPENWEATHER_API_KEY']
  if (!key) return null

  const cKey = cacheKey('current', args.latitude, args.longitude)
  const cached = await redis.get(cKey)
  if (cached) return JSON.parse(cached) as WeatherSnapshot

  const url = `${BASE_URL}?lat=${args.latitude}&lon=${args.longitude}&exclude=minutely,hourly,daily,alerts&units=metric&lang=de&appid=${key}`
  const data = await fetchOW(url)
  if (!data) return null

  const d = data as { current: OWCurrentData }
  const snapshot = parseSnapshot(d.current)
  await redis.set(cKey, JSON.stringify(snapshot), 'EX', 600)
  return snapshot
}

/** Forecast for the next N days (1–8). Cached for 6 h. Returns [] if API key missing or fetch fails. */
export async function getForecast(args: {
  latitude: number
  longitude: number
  days: number
}): Promise<WeatherSnapshot[]> {
  const key = getApiKey()
  if (!key) return []

  const days = Math.max(1, Math.min(8, args.days))
  const cKey = cacheKey('forecast', args.latitude, args.longitude, days)
  const cached = await redis.get(cKey)
  if (cached) return JSON.parse(cached) as WeatherSnapshot[]

  const url = `${BASE_URL}?lat=${args.latitude}&lon=${args.longitude}&exclude=current,minutely,hourly,alerts&units=metric&lang=de&appid=${key}`
  const data = await fetchOW(url)
  if (!data) return []

  interface OWDailyItem {
    dt: number
    sunrise: number
    sunset: number
    temp: { day: number }
    feels_like: { day: number }
    humidity: number
    wind_speed: number
    wind_deg: number
    rain?: number
    snow?: number
    weather: Array<{ main: string }>
  }

  const d = data as { daily: OWDailyItem[] }
  const snapshots: WeatherSnapshot[] = d.daily.slice(0, days).map((day) => ({
    date: unixToDate(day.dt),
    tempC: day.temp.day,
    feelsC: day.feels_like.day,
    humidityPct: day.humidity,
    windKmh: Math.round(day.wind_speed * 3.6 * 10) / 10,
    windDir: day.wind_deg,
    precipMm: day.rain ?? day.snow ?? 0,
    conditions: mapCondition(day.weather[0]?.main ?? ''),
    sunriseTime: unixToIso(day.sunrise),
    sunsetTime: unixToIso(day.sunset),
  }))

  await redis.set(cKey, JSON.stringify(snapshots), 'EX', 21600)
  return snapshots
}

/** Historical weather for a specific unix timestamp. Cached permanently. Returns null if API key missing or fetch fails. */
export async function getHistoricalWeather(args: {
  latitude: number
  longitude: number
  timestamp: number
}): Promise<WeatherSnapshot | null> {
  const key = getApiKey()
  if (!key) return null

  const cKey = cacheKey('hist', args.latitude, args.longitude, args.timestamp)
  const cached = await redis.get(cKey)
  if (cached) return JSON.parse(cached) as WeatherSnapshot

  const url = `${BASE_URL}/timemachine?lat=${args.latitude}&lon=${args.longitude}&dt=${args.timestamp}&units=metric&lang=de&appid=${key}`
  const data = await fetchOW(url)
  if (!data) return null

  const d = data as { data: OWCurrentData[] }
  const current = d.data[0]
  if (!current) return null

  const snapshot = parseSnapshot(current)
  await redis.set(cKey, JSON.stringify(snapshot))
  return snapshot
}

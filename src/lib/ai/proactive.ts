/**
 * NO QUIT AI — proactive daily brief.
 *
 * Design rules:
 * - No external dependencies.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Never throws: buildDailyBrief is pure/defensive, getWeather and
 *   proactiveBrief always resolve with a safe value on any failure.
 * - Uses free Open-Meteo endpoints; no API key required.
 */

export interface PendingTask {
  label: string;
  done?: boolean;
}

export interface WeatherInfo {
  city: string;
  summary: string;
  tempC?: number;
  source: 'open-meteo' | 'unavailable';
}

export interface DailyBrief {
  greeting: string;
  name?: string;
  dateISO: string;
  datePretty: string;
  hijriNote?: string;
  city: string;
  pendingTasks: string[];
  weather: WeatherInfo;
  suggestions: string[];
}

export interface BuildBriefInput {
  profile: { name?: string; city?: string; work?: string };
  pendingTasks?: PendingTask[];
  weather?: WeatherInfo;
  now?: Date;
}

export type ProactiveBriefInput = BuildBriefInput;

export const DEFAULT_CITY = 'Abu Dhabi';
const WEATHER_TIMEOUT_MS = 8000;
const MAX_PENDING_TASKS = 8;
const MAX_SUGGESTIONS = 3;
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
] as const;

const WMO_DESCRIPTIONS: Readonly<Record<number, string>> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

/** Maps a WMO weather code to a short English description. */
export function describeWeatherCode(code: number | undefined): string {
  if (typeof code !== 'number' || !Number.isFinite(code)) return 'Unknown conditions';
  return WMO_DESCRIPTIONS[Math.trunc(code)] ?? 'Unknown conditions';
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Returns the local calendar date as 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  try {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) return todayISO(new Date(0));
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  } catch {
    return '1970-01-01';
  }
}

/** Returns a pretty date like 'Monday, 23 November 2026'. */
export function prettyDate(now: Date = new Date()): string {
  try {
    const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date(0);
    const weekday = WEEKDAYS[date.getDay()] ?? 'Sunday';
    const month = MONTHS[date.getMonth()] ?? 'January';
    return `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`;
  } catch {
    return 'Sunday, 1 January 1970';
  }
}

function timeOfDay(now: Date): 'morning' | 'afternoon' | 'evening' {
  let hour = 12;
  try {
    hour = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getHours() : 12;
  } catch {
    hour = 12;
  }
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

export function greetingForNow(name: string | undefined, now: Date): string {
  const part = timeOfDay(now);
  const base = part === 'morning' ? 'Good morning' : part === 'afternoon' ? 'Good afternoon' : 'Good evening';
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.length > 0 ? `${base}, ${trimmed}` : base;
}

export function weatherUnavailable(city: string): WeatherInfo {
  return { city, summary: 'Weather unavailable', source: 'unavailable' };
}

function sanitizeCity(city: string | undefined): string {
  const trimmed = typeof city === 'string' ? city.trim() : '';
  return trimmed.length > 0 ? trimmed : DEFAULT_CITY;
}

function buildSignal(parent: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!parent) return timeout;
  if (typeof AbortSignal.any === 'function') {
    try {
      return AbortSignal.any([parent, timeout]);
    } catch {
      return timeout;
    }
  }
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  if (parent.aborted) controller.abort();
  else parent.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

type GeoHit = { latitude?: unknown; longitude?: unknown };

async function geocodeCity(city: string, signal: AbortSignal): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = new URL(GEOCODE_URL);
    url.searchParams.set('name', city);
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');
    const res = await fetch(url.toString(), { signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: GeoHit[] };
    const first = data?.results?.[0];
    if (!first) return null;
    const lat = typeof first.latitude === 'number' ? first.latitude : Number(first.latitude);
    const lon = typeof first.longitude === 'number' ? first.longitude : Number(first.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

/**
 * Fetches current weather for a city from Open-Meteo (free, no API key).
 * Always resolves; on any error returns a valid WeatherInfo with source 'unavailable'.
 */
export async function getWeather(city?: string, signal?: AbortSignal): Promise<WeatherInfo> {
  const safeCity = sanitizeCity(city);
  try {
    const combined = buildSignal(signal, WEATHER_TIMEOUT_MS);
    if (combined.aborted) return weatherUnavailable(safeCity);

    const coords = await geocodeCity(safeCity, combined);
    if (!coords) return weatherUnavailable(safeCity);

    const url = new URL(FORECAST_URL);
    url.searchParams.set('latitude', String(coords.lat));
    url.searchParams.set('longitude', String(coords.lon));
    url.searchParams.set('current_weather', 'true');
    url.searchParams.set('temperature_unit', 'celsius');

    const res = await fetch(url.toString(), { signal: combined, headers: { accept: 'application/json' } });
    if (!res.ok) return weatherUnavailable(safeCity);
    const data = (await res.json()) as {
      current_weather?: { temperature?: unknown; weathercode?: unknown };
    };
    const current = data?.current_weather;
    if (!current) return weatherUnavailable(safeCity);

    const rawTemp = typeof current.temperature === 'number' ? current.temperature : Number(current.temperature);
    const code = typeof current.weathercode === 'number' ? current.weathercode : Number(current.weathercode);
    const summary = describeWeatherCode(Number.isFinite(code) ? code : undefined);

    const result: WeatherInfo = { city: safeCity, summary, source: 'open-meteo' };
    if (Number.isFinite(rawTemp)) result.tempC = Math.round(rawTemp * 10) / 10;
    return result;
  } catch {
    return weatherUnavailable(safeCity);
  }
}

function buildSuggestions(city: string, work: string | undefined): string[] {
  const out: string[] = [];
  const safeCity = city.trim().length > 0 ? city.trim() : DEFAULT_CITY;
  out.push(`Take a short walk around ${safeCity} to reset and refocus.`);

  const w = typeof work === 'string' ? work.trim() : '';
  if (w.length > 0) {
    out.push(`Block 30 focused minutes for ${w} — one clear next step only.`);
  } else {
    out.push('Block 30 focused minutes on one important task — start before your mind resists.');
  }

  out.push('Review your pending tasks and finish the smallest one first — momentum beats motivation.');
  return out.slice(0, MAX_SUGGESTIONS);
}

function hijriApproxNote(now: Date): string | undefined {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return undefined;
    const formatted = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
    return formatted.length > 0 ? formatted : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Builds a DailyBrief from profile, tasks and (optional) weather. Pure and defensive.
 */
export function buildDailyBrief(input: BuildBriefInput): DailyBrief {
  const safeInput: BuildBriefInput =
    input !== null && typeof input === 'object'
      ? input
      : { profile: {} };
  const now = safeInput.now instanceof Date && !Number.isNaN(safeInput.now.getTime()) ? safeInput.now : new Date();

  const rawName = safeInput.profile && typeof safeInput.profile.name === 'string' ? safeInput.profile.name.trim() : '';
  const name = rawName.length > 0 ? rawName : undefined;

  const rawCity = safeInput.profile && typeof safeInput.profile.city === 'string' ? safeInput.profile.city.trim() : '';
  const city = rawCity.length > 0 ? rawCity : DEFAULT_CITY;

  const pendingTasks: string[] = [];
  const tasks = Array.isArray(safeInput.pendingTasks) ? safeInput.pendingTasks : [];
  for (const task of tasks) {
    if (pendingTasks.length >= MAX_PENDING_TASKS) break;
    if (!task || typeof task !== 'object') continue;
    if (task.done === true) continue;
    const label = typeof task.label === 'string' ? task.label.trim() : '';
    if (label.length > 0) pendingTasks.push(label);
  }

  const weather: WeatherInfo =
    safeInput.weather && typeof safeInput.weather === 'object'
      ? safeInput.weather
      : weatherUnavailable(city);

  const brief: DailyBrief = {
    greeting: greetingForNow(name, now),
    dateISO: todayISO(now),
    datePretty: prettyDate(now),
    city,
    pendingTasks,
    weather,
    suggestions: buildSuggestions(city, safeInput.profile?.work),
  };
  if (name !== undefined) brief.name = name;
  const hijri = hijriApproxNote(now);
  if (hijri !== undefined) brief.hijriNote = hijri;
  return brief;
}

/**
 * Fetches weather then builds the daily brief. Always resolves — never throws.
 */
export async function proactiveBrief(input: ProactiveBriefInput): Promise<DailyBrief> {
  try {
    const safeInput: ProactiveBriefInput =
      input !== null && typeof input === 'object' ? input : { profile: {} };
    const rawCity = safeInput.profile && typeof safeInput.profile.city === 'string' ? safeInput.profile.city.trim() : '';
    const city = rawCity.length > 0 ? rawCity : DEFAULT_CITY;

    let weather = weatherUnavailable(city);
    try {
      weather = await getWeather(city);
    } catch {
      weather = weatherUnavailable(city);
    }

    return buildDailyBrief({ ...safeInput, weather });
  } catch {
    return buildDailyBrief({ profile: {} });
  }
}

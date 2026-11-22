/**
 * NO QUIT AI — small, dependency-free personal memory store.
 *
 * Design rules:
 * - No external dependencies.
 * - No module-scope mutable globals: the default store lives inside createMemoryStore().
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 */

export interface PersonalProfile {
  name?: string;
  city?: string;
  country?: string;
  work?: string;
  languages?: string[];
  preferences?: string[];
  notes?: string[];
  updatedAt?: string;
}

export interface MemoryStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

const PROFILE_KEY = "nqai.personalProfile";

const DEFAULT_CITY = "Abu Dhabi";
const DEFAULT_COUNTRY = "United Arab Emirates";
const DEFAULT_LANGUAGES: readonly string[] = ["ur", "en"];

/** Fresh default profile — always returns a new object so callers cannot mutate shared state. */
export function defaultProfile(): PersonalProfile {
  return {
    city: DEFAULT_CITY,
    country: DEFAULT_COUNTRY,
    languages: [...DEFAULT_LANGUAGES],
    preferences: [],
    notes: [],
  };
}

function cloneProfile(profile: PersonalProfile): PersonalProfile {
  const next: PersonalProfile = {};
  if (profile.name !== undefined) next.name = profile.name;
  if (profile.city !== undefined) next.city = profile.city;
  if (profile.country !== undefined) next.country = profile.country;
  if (profile.work !== undefined) next.work = profile.work;
  if (profile.languages !== undefined) next.languages = [...profile.languages];
  if (profile.preferences !== undefined) next.preferences = [...profile.preferences];
  if (profile.notes !== undefined) next.notes = [...profile.notes];
  if (profile.updatedAt !== undefined) next.updatedAt = profile.updatedAt;
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(source: Record<string, unknown>, key: string): string[] | undefined {
  const value = source[key];
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items;
}

function parseStoredProfile(raw: string): PersonalProfile | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const profile: PersonalProfile = {};
  const name = readString(parsed, "name");
  if (name !== undefined) profile.name = name;
  const city = readString(parsed, "city");
  if (city !== undefined) profile.city = city;
  const country = readString(parsed, "country");
  if (country !== undefined) profile.country = country;
  const work = readString(parsed, "work");
  if (work !== undefined) profile.work = work;
  const languages = readStringArray(parsed, "languages");
  if (languages !== undefined) profile.languages = languages;
  const preferences = readStringArray(parsed, "preferences");
  if (preferences !== undefined) profile.preferences = preferences;
  const notes = readStringArray(parsed, "notes");
  if (notes !== undefined) profile.notes = notes;
  const updatedAt = readString(parsed, "updatedAt");
  if (updatedAt !== undefined) profile.updatedAt = updatedAt;
  return profile;
}

/**
 * Default in-memory store. Created per call so there is no shared mutable global.
 * A Map instance per store keeps each caller isolated.
 */
export function createMemoryStore(): MemoryStore {
  const data = new Map<string, string>();
  return {
    async get(key: string): Promise<string | null> {
      const value = data.get(key);
      return value === undefined ? null : value;
    },
    async set(key: string, value: string): Promise<void> {
      data.set(key, value);
    },
  };
}

// Per-call default store so loadProfile()/saveProfile() without an explicit
// store still round-trip, while no module-scope map is exported to clients.
let fallbackStore: MemoryStore | null = null;
function storeOrDefault(store?: MemoryStore): MemoryStore {
  if (store) return store;
  if (fallbackStore === null) fallbackStore = createMemoryStore();
  return fallbackStore;
}

/** Load a profile from a store, merging with defaults for missing fields. */
export async function loadProfile(store?: MemoryStore): Promise<PersonalProfile> {
  const active = storeOrDefault(store);
  const raw = await active.get(PROFILE_KEY);
  const defaults = defaultProfile();
  if (raw === null) return defaults;
  const parsed = parseStoredProfile(raw);
  if (parsed === null) return defaults;
  return mergeProfile(defaults, parsed);
}

/** Persist a profile (normalized + updatedAt stamped) and return the saved copy. */
export async function saveProfile(profile: PersonalProfile, store?: MemoryStore): Promise<PersonalProfile> {
  const active = storeOrDefault(store);
  const normalized = normalizeProfile(profile);
  const saved: PersonalProfile = { ...normalized, updatedAt: new Date().toISOString() };
  await active.set(PROFILE_KEY, JSON.stringify(saved));
  return cloneProfile(saved);
}

/** Append or update a fact as "key: value" in notes (deduped, keyed by key). */
export async function rememberFact(key: string, value: string, store?: MemoryStore): Promise<PersonalProfile> {
  const cleanKey = key.trim();
  const cleanValue = value.trim();
  const active = storeOrDefault(store);
  const current = await loadProfile(active);
  if (cleanKey.length === 0 || cleanValue.length === 0) return current;
  const entry = `${cleanKey}: ${cleanValue}`;
  const existing = current.notes ?? [];
  const keyPrefix = `${cleanKey}:`;
  const withoutKey = existing.filter((note) => !note.startsWith(keyPrefix));
  const notes = [...withoutKey, entry];
  const next: PersonalProfile = { ...current, notes };
  return saveProfile(next, active);
}

/** Build a system prompt that injects known user facts and forbids re-asking them. */
export function buildMemorySystemPrompt(profile: PersonalProfile): string {
  const lines: string[] = [
    "You are NO QUIT AI with access to the user's personal memory below.",
    "Use these facts in every reply. NEVER re-ask for information that is already known here.",
  ];

  const known: string[] = [];
  if (profile.name) known.push(`Name: ${profile.name}`);
  if (profile.city) known.push(`City: ${profile.city}`);
  if (profile.country) known.push(`Country: ${profile.country}`);
  if (profile.work) known.push(`Work: ${profile.work}`);
  if (profile.languages && profile.languages.length > 0) {
    known.push(`Languages: ${profile.languages.join(", ")}`);
  }
  if (profile.preferences && profile.preferences.length > 0) {
    known.push(`Preferences: ${profile.preferences.join("; ")}`);
  }
  if (profile.notes && profile.notes.length > 0) {
    known.push(`Other remembered facts: ${profile.notes.join("; ")}`);
  }

  if (known.length > 0) {
    lines.push("", "KNOWN USER FACTS:");
    for (const item of known) lines.push(`- ${item}`);
  } else {
    lines.push("", "KNOWN USER FACTS: (none yet — you may ask once, then save the answer).");
  }

  lines.push(
    "",
    "RULES:",
    "- Address the user by name when known.",
    "- Do not ask again for name, city, work, languages, or preferences already listed above.",
    "- If a genuinely new durable fact appears, remember it instead of re-asking later.",
    "- Keep replies concise and helpful.",
  );

  return lines.join("\n");
}

function mergeProfile(base: PersonalProfile, overlay: PersonalProfile): PersonalProfile {
  const merged: PersonalProfile = { ...base };
  if (overlay.name !== undefined) merged.name = overlay.name;
  if (overlay.city !== undefined) merged.city = overlay.city;
  if (overlay.country !== undefined) merged.country = overlay.country;
  if (overlay.work !== undefined) merged.work = overlay.work;
  if (overlay.languages !== undefined) merged.languages = [...overlay.languages];
  if (overlay.preferences !== undefined) merged.preferences = [...overlay.preferences];
  if (overlay.notes !== undefined) merged.notes = [...overlay.notes];
  if (overlay.updatedAt !== undefined) merged.updatedAt = overlay.updatedAt;
  return merged;
}

function normalizeProfile(profile: PersonalProfile): PersonalProfile {
  const next: PersonalProfile = {};
  const name = profile.name?.trim();
  if (name) next.name = name;
  const city = profile.city?.trim();
  if (city) next.city = city;
  const country = profile.country?.trim();
  if (country) next.country = country;
  const work = profile.work?.trim();
  if (work) next.work = work;
  if (profile.languages) next.languages = dedupe(profile.languages);
  if (profile.preferences) next.preferences = dedupe(profile.preferences);
  if (profile.notes) next.notes = dedupe(profile.notes);
  return next;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

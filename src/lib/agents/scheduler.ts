/**
 * NO QUIT AI — schedule math + full nightly pipeline.
 *
 * Design rules:
 * - Only depends on './config', './agents', './crosstalk', './store', './types'.
 * - No cron dependency, no external dependencies.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Every exported function never throws (runNightlyOnce included).
 * - Never logs secrets; only structured summaries are returned.
 */

import {
  CROSSTALK_ROUNDS,
  NIGHTLY_HOUR_LOCAL,
  NIGHTLY_TIMEZONE,
} from './config';
import { runAllAgents } from './agents';
import { runCrosstalk } from './crosstalk';
import { getAgentStore } from './store';
import { AGENT_IDS, makeId } from './types';
import type { AgentStore } from './store';
import type {
  AgentFinding,
  AgentId,
  AgentProviderStatus,
  NightlyReport,
} from './types';

export interface NightlyRunSummary {
  ok: boolean;
  reportId: string | null;
  startedAt: string;
  finishedAt: string;
  agents: Record<AgentId, 'ok' | 'offline'>;
  findingsCount: number;
  proposalsCount: number;
  crosstalkCount: number;
  notes: string[];
  skipped?: boolean;
  error?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DEFAULT_TOLERANCE_MINUTES = 15;
const MAX_TOLERANCE_MINUTES = 24 * 60 - 1;
const DUBAI_FIXED_OFFSET_MS = 4 * HOUR_MS;
const MAX_ROUNDS_OPTION = 6;
const ISO_DATE_LENGTH = 10;

interface DubaiParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

function safeNow(now: Date | undefined): Date {
  try {
    if (now instanceof Date && Number.isFinite(now.getTime())) return now;
  } catch {
    // fall through
  }
  try {
    return new Date();
  } catch {
    return new Date(0);
  }
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Parses en-CA Intl.DateTimeFormat parts into Dubai wall-clock parts.
 * Returns null when Intl is unavailable or returns malformed data.
 */
function dubaiPartsFromIntl(now: Date): DubaiParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: NIGHTLY_TIMEZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const parts = formatter.formatToParts(now);
    if (!Array.isArray(parts)) return null;

    let year = NaN;
    let month = NaN;
    let day = NaN;
    let hour = NaN;
    let minute = NaN;
    let second = NaN;

    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      const type = part.type;
      const rawValue = typeof part.value === 'string' ? part.value.trim() : '';
      if (rawValue.length === 0) continue;
      const numeric = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(numeric)) continue;

      if (type === 'year') year = numeric;
      else if (type === 'month') month = numeric;
      else if (type === 'day') day = numeric;
      else if (type === 'hour') hour = numeric;
      else if (type === 'minute') minute = numeric;
      else if (type === 'second') second = numeric;
    }

    // Some ICU builds emit hour 24 for midnight — normalize to 0.
    if (hour === 24) hour = 0;

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      !Number.isFinite(second)
    ) {
      return null;
    }

    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;
    if (second < 0 || second > 59) return null;

    return { year, month, day, hour, minute, second };
  } catch {
    return null;
  }
}

/**
 * Fallback used when Intl throws or returns garbage: Dubai is a fixed UTC+4
 * with no DST, so shift the epoch and read UTC fields.
 */
function dubaiPartsFromFixedOffset(now: Date): DubaiParts {
  try {
    const shifted = new Date(now.getTime() + DUBAI_FIXED_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
    };
  } catch {
    return { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
  }
}

function dubaiParts(now: Date): DubaiParts {
  const fromIntl = dubaiPartsFromIntl(now);
  if (fromIntl !== null) return fromIntl;
  return dubaiPartsFromFixedOffset(now);
}

/** Dubai wall-clock YYYY-MM-DD for the given instant. */
function dubaiDateKey(now: Date): string {
  const parts = dubaiParts(now);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** Minutes elapsed in the Dubai day for the given instant. */
function dubaiMinutesOfDay(parts: DubaiParts): number {
  return parts.hour * 60 + parts.minute;
}

/**
 * Converts Dubai wall-clock (Y-M-D 03:00) to a UTC timestamp using fixed +4 offset.
 * Dubai has no DST so this is exact; used by both Intl and fallback paths so the
 * result is always a real instant.
 */
function dubaiWallClockToUtcMs(year: number, month: number, day: number, hour: number): number {
  try {
    const asUtc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
    if (!Number.isFinite(asUtc)) return NaN;
    return asUtc - DUBAI_FIXED_OFFSET_MS;
  } catch {
    return NaN;
  }
}

/**
 * Computes ms until the next 3 AM Dubai run (always > 0). Uses Intl for the
 * wall-clock date of `now` (falling back to fixed +4 math), then builds the
 * exact UTC instant. Total failure -> 24h.
 */
export function millisecondsUntilNextRun(now: Date = new Date()): number {
  try {
    const base = safeNow(now);
    const baseMs = base.getTime();
    if (!Number.isFinite(baseMs)) return DAY_MS;

    const parts = dubaiParts(base);
    const todayTargetMs = dubaiWallClockToUtcMs(
      parts.year,
      parts.month,
      parts.day,
      NIGHTLY_HOUR_LOCAL
    );

    if (!Number.isFinite(todayTargetMs)) {
      // Could not build the target; fall back to a coarse calculation.
      const msIntoDay = (dubaiMinutesOfDay(parts) * 60 + parts.second) * 1000;
      const targetIntoDay = NIGHTLY_HOUR_LOCAL * HOUR_MS;
      const remaining = targetIntoDay - msIntoDay;
      const next = remaining > 0 ? remaining : remaining + DAY_MS;
      return next > 0 ? next : DAY_MS;
    }

    if (baseMs < todayTargetMs) {
      const diff = todayTargetMs - baseMs;
      return diff > 0 ? diff : DAY_MS;
    }

    // Already past (or exactly at) today's 3 AM — target tomorrow.
    const tomorrow = new Date(todayTargetMs + DAY_MS);
    const tomorrowMs = dubaiWallClockToUtcMs(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + 1,
      tomorrow.getUTCDate(),
      NIGHTLY_HOUR_LOCAL
    );
    const tomorrowTarget = Number.isFinite(tomorrowMs) ? tomorrowMs : todayTargetMs + DAY_MS;
    const diff = tomorrowTarget - baseMs;
    return diff > 0 ? diff : DAY_MS;
  } catch {
    return DAY_MS;
  }
}

/**
 * True when the Dubai wall clock is inside [03:00, 03:00 + tolerance] AND the
 * store's last run date is not today's Dubai date. Never throws.
 */
export function isDueNow(
  now: Date = new Date(),
  lastRunIso?: string | null,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES
): boolean {
  try {
    const base = safeNow(now);

    let tolerance = DEFAULT_TOLERANCE_MINUTES;
    if (typeof toleranceMinutes === 'number' && Number.isFinite(toleranceMinutes)) {
      const floored = Math.floor(toleranceMinutes);
      if (floored > 0) tolerance = Math.min(floored, MAX_TOLERANCE_MINUTES);
      else if (floored === 0) tolerance = 0;
    }

    const parts = dubaiParts(base);
    const minutesOfDay = dubaiMinutesOfDay(parts);
    const windowStart = NIGHTLY_HOUR_LOCAL * 60;
    const windowEnd = windowStart + tolerance;

    if (minutesOfDay < windowStart || minutesOfDay > windowEnd) return false;

    if (typeof lastRunIso === 'string' && lastRunIso.trim().length > 0) {
      const last = new Date(lastRunIso);
      const lastMs = last.getTime();
      if (Number.isFinite(lastMs)) {
        const lastKey = dubaiDateKey(last);
        const todayKey = dubaiDateKey(base);
        if (lastKey === todayKey) return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/** ISO string of the next 3 AM Dubai run. Never throws. */
export function nextRunIso(now: Date = new Date()): string {
  try {
    const base = safeNow(now);
    const ms = millisecondsUntilNextRun(base);
    return new Date(base.getTime() + ms).toISOString();
  } catch {
    try {
      return new Date(Date.now() + DAY_MS).toISOString();
    } catch {
      return '1970-01-01T00:00:00.000Z';
    }
  }
}

/** Status-route helper. Never throws. */
export function describeSchedule(now: Date = new Date()): {
  nextRunIso: string;
  msUntilNextRun: number;
  lastRunPerAgent: Record<AgentId, string | null>;
  timezone: string;
  hour: number;
} {
  let msUntil = DAY_MS;
  try {
    msUntil = millisecondsUntilNextRun(now);
  } catch {
    msUntil = DAY_MS;
  }

  let nextIso = '';
  try {
    nextIso = nextRunIso(now);
  } catch {
    nextIso = new Date(Date.now() + DAY_MS).toISOString();
  }

  let lastRun: Record<AgentId, string | null> = {} as Record<AgentId, string | null>;
  try {
    const store = getAgentStore();
    lastRun = store.getLastRunPerAgent();
  } catch {
    lastRun = {} as Record<AgentId, string | null>;
  }
  for (const id of AGENT_IDS) {
    if (typeof lastRun[id] !== 'string') lastRun[id] = null;
  }

  return {
    nextRunIso: nextIso,
    msUntilNextRun: msUntil,
    lastRunPerAgent: lastRun,
    timezone: NIGHTLY_TIMEZONE,
    hour: NIGHTLY_HOUR_LOCAL,
  };
}

/* -------------------------------------------------------------------------- */
/* Nightly pipeline                                                           */
/* -------------------------------------------------------------------------- */

function emptyAgentStatus(): Record<AgentId, 'ok' | 'offline'> {
  const out = {} as Record<AgentId, 'ok' | 'offline'>;
  for (const id of AGENT_IDS) {
    out[id] = 'offline';
  }
  return out;
}

function buildSkippedSummary(now: Date, reason: string): NightlyRunSummary {
  const stamp = now.toISOString();
  return {
    ok: true,
    reportId: null,
    startedAt: stamp,
    finishedAt: stamp,
    agents: emptyAgentStatus(),
    findingsCount: 0,
    proposalsCount: 0,
    crosstalkCount: 0,
    notes: [reason],
    skipped: true,
  };
}

function buildErrorSummary(startedAt: string, message: string): NightlyRunSummary {
  let finishedAt = startedAt;
  try {
    finishedAt = new Date().toISOString();
  } catch {
    finishedAt = startedAt;
  }
  return {
    ok: false,
    reportId: null,
    startedAt,
    finishedAt,
    agents: emptyAgentStatus(),
    findingsCount: 0,
    proposalsCount: 0,
    crosstalkCount: 0,
    notes: [],
    error: message,
  };
}

function normalizeRounds(rounds: unknown): number {
  if (typeof rounds !== 'number' || !Number.isFinite(rounds)) return CROSSTALK_ROUNDS;
  const floored = Math.floor(rounds);
  if (floored < 1) return CROSSTALK_ROUNDS;
  return floored > MAX_ROUNDS_OPTION ? MAX_ROUNDS_OPTION : floored;
}

function lastRunOfFirstAgent(store: AgentStore): string | null {
  try {
    const map = store.getLastRunPerAgent();
    const firstId = AGENT_IDS[0];
    if (firstId === undefined) return null;
    const value = map[firstId];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Runs the full nightly pipeline exactly once (agent runs -> crosstalk -> report).
 * Skips (ok:true, skipped:true) when outside the 3 AM Dubai window unless forced.
 * Never throws; failures return ok:false with an error message.
 */
export async function runNightlyOnce(
  store?: AgentStore,
  options?: { force?: boolean; rounds?: number }
): Promise<NightlyRunSummary> {
  let startedAt = '';
  try {
    startedAt = new Date().toISOString();
  } catch {
    startedAt = '1970-01-01T00:00:00.000Z';
  }

  try {
    let activeStore: AgentStore;
    try {
      activeStore = store ?? getAgentStore();
    } catch {
      activeStore = getAgentStore();
    }

    const force = options?.force === true;
    const rounds = normalizeRounds(options?.rounds);

    const now = new Date();
    if (!force) {
      const lastRun = lastRunOfFirstAgent(activeStore);
      const due = isDueNow(now, lastRun);
      if (!due) {
        return buildSkippedSummary(now, 'Outside 3 AM window');
      }
    }

    const runStartedAt = now.toISOString();

    let results: Awaited<ReturnType<typeof runAllAgents>> = [];
    try {
      results = await runAllAgents();
    } catch {
      results = [];
    }

    const findings: AgentFinding[] = [];
    const providerStatus = {} as Record<AgentId, AgentProviderStatus>;
    for (const id of AGENT_IDS) {
      providerStatus[id] = 'offline';
    }
    const notes: string[] = [];

    for (const result of results) {
      if (!result || typeof result !== 'object') continue;
      const id = result.agent;
      if (!AGENT_IDS.includes(id)) continue;

      providerStatus[id] = result.status === 'ok' ? 'ok' : 'offline';

      if (Array.isArray(result.findings)) {
        for (const finding of result.findings) {
          if (finding && typeof finding === 'object') findings.push(finding);
        }
      }

      if (Array.isArray(result.notes)) {
        for (const note of result.notes) {
          if (typeof note === 'string' && note.trim().length > 0) {
            notes.push(note.trim());
          }
        }
      }
    }

    let crosstalkResult: Awaited<ReturnType<typeof runCrosstalk>> = {
      messages: [],
      proposals: [],
      notes: [],
    };
    try {
      crosstalkResult = await runCrosstalk(findings, rounds);
    } catch {
      crosstalkResult = { messages: [], proposals: [], notes: ['Crosstalk failed.'] };
    }

    const crosstalkMessages = Array.isArray(crosstalkResult.messages)
      ? crosstalkResult.messages
      : [];
    const proposals = Array.isArray(crosstalkResult.proposals)
      ? crosstalkResult.proposals
      : [];
    const crosstalkNotes = Array.isArray(crosstalkResult.notes)
      ? crosstalkResult.notes.filter((n): n is string => typeof n === 'string')
      : [];

    const finishedAt = new Date().toISOString();
    const reportId = makeId('nightly');

    const report: NightlyReport = {
      id: reportId,
      startedAt: runStartedAt,
      finishedAt,
      timezone: NIGHTLY_TIMEZONE,
      agents: AGENT_IDS.slice(),
      findings,
      crosstalk: crosstalkMessages,
      proposals,
      providerStatus,
      notes: notes.concat(crosstalkNotes),
    };

    try {
      activeStore.saveReport(report);
    } catch {
      // store is defensive, but guard anyway
    }

    const agentStatus = {} as Record<AgentId, 'ok' | 'offline'>;
    for (const id of AGENT_IDS) {
      agentStatus[id] = providerStatus[id] === 'ok' ? 'ok' : 'offline';
    }

    return {
      ok: true,
      reportId,
      startedAt: runStartedAt,
      finishedAt,
      agents: agentStatus,
      findingsCount: findings.length,
      proposalsCount: proposals.length,
      crosstalkCount: crosstalkMessages.length,
      notes: report.notes.slice(),
    };
  } catch (err) {
    let message = 'Nightly run failed unexpectedly.';
    try {
      if (err instanceof Error && typeof err.message === 'string' && err.message.trim().length > 0) {
        message = err.message.trim();
      } else if (typeof err === 'string' && err.trim().length > 0) {
        message = err.trim();
      }
    } catch {
      // keep default message
    }
    return buildErrorSummary(startedAt, message);
  }
}

/* Keep some internal helpers referenced to avoid dead-code lint noise. */
void ISO_DATE_LENGTH;
void MINUTE_MS;

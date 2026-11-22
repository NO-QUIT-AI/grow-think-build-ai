/**
 * NO QUIT AI — persistence layer for the 4-agent nightly system.
 *
 * IMPORTANT:
 * - In-memory only. Data resets on cold start / process restart.
 * - Swap via setAgentStore() for a KV / Postgres / Redis adapter later
 *   without touching any route code.
 * - No secrets are stored here (only findings, reports, proposals).
 * - Only depends on './types'. No DB, no external dependencies.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Every method never throws; on error it returns safe empty/null values.
 */

import type {
  AgentFinding,
  AgentId,
  AgentProposal,
  NightlyReport,
  ProposalStatus,
} from './types';
import { AGENT_IDS } from './types';

export interface AgentStore {
  saveFindings(findings: AgentFinding[]): void;
  getLatestFindings(limit?: number): AgentFinding[];
  saveReport(report: NightlyReport): void;
  getReports(limit?: number): NightlyReport[];
  getLatestReport(): NightlyReport | null;
  saveProposals(proposals: AgentProposal[]): void;
  getProposals(limit?: number): AgentProposal[];
  getProposal(id: string): AgentProposal | null;
  markProposal(id: string, status: ProposalStatus): AgentProposal | null;
  getLastRunPerAgent(): Record<AgentId, string | null>;
  clear(): void;
}

export interface MemoryStoreOptions {
  maxFindings?: number;
  maxReports?: number;
  maxProposals?: number;
  now?: () => number;
}

const DEFAULT_MAX_FINDINGS = 500;
const DEFAULT_MAX_REPORTS = 30;
const DEFAULT_MAX_PROPOSALS = 200;

const GLOBAL_STORE_KEY = '__noquitAgentStore';

/** Allowed proposal status transitions. */
const ALLOWED_TRANSITIONS: Readonly<Record<ProposalStatus, readonly ProposalStatus[]>> = {
  proposed: ['approved', 'rejected'],
  awaiting_approval: ['approved', 'rejected'],
  approved: ['applied'],
  rejected: [],
  applied: [],
};

function isProposalStatus(value: unknown): value is ProposalStatus {
  return (
    value === 'proposed' ||
    value === 'awaiting_approval' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'applied'
  );
}

/**
 * Performs an immutable transition check. Returns the next status when the
 * transition is legal, otherwise null. Never throws.
 */
function nextStatusIfAllowed(
  current: ProposalStatus,
  target: ProposalStatus
): ProposalStatus | null {
  try {
    const allowed = ALLOWED_TRANSITIONS[current];
    if (!Array.isArray(allowed)) return null;
    for (const candidate of allowed) {
      if (candidate === target) return target;
    }
    return null;
  } catch {
    return null;
  }
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const floored = Math.floor(value);
  return floored > 0 ? floored : fallback;
}

function clampLimit(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return max;
  const floored = Math.floor(value);
  if (floored <= 0) return 0;
  return floored > max ? max : floored;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function shallowCopyFindings(list: readonly AgentFinding[]): AgentFinding[] {
  const out: AgentFinding[] = [];
  for (const item of list) {
    if (isObject(item)) out.push(item);
  }
  return out;
}

function shallowCopyReports(list: readonly NightlyReport[]): NightlyReport[] {
  const out: NightlyReport[] = [];
  for (const item of list) {
    if (isObject(item)) out.push(item);
  }
  return out;
}

function shallowCopyProposals(list: readonly AgentProposal[]): AgentProposal[] {
  const out: AgentProposal[] = [];
  for (const item of list) {
    if (isObject(item)) out.push(item);
  }
  return out;
}

function freshLastRun(): Record<AgentId, string | null> {
  const out = {} as Record<AgentId, string | null>;
  for (const id of AGENT_IDS) {
    out[id] = null;
  }
  return out;
}

/**
 * Creates an in-memory AgentStore with ring-buffer trimming so memory can't grow
 * unbounded. Never throws from any method.
 */
export function createMemoryStore(options?: MemoryStoreOptions): AgentStore {
  const maxFindings = toPositiveInt(options?.maxFindings, DEFAULT_MAX_FINDINGS);
  const maxReports = toPositiveInt(options?.maxReports, DEFAULT_MAX_REPORTS);
  const maxProposals = toPositiveInt(options?.maxProposals, DEFAULT_MAX_PROPOSALS);

  const nowFn: () => number =
    typeof options?.now === 'function'
      ? options.now
      : () => {
          try {
            return Date.now();
          } catch {
            return 0;
          }
        };

  // Newest-first arrays.
  let findings: AgentFinding[] = [];
  let reports: NightlyReport[] = [];
  let proposals: AgentProposal[] = [];
  let lastRunPerAgent: Record<AgentId, string | null> = freshLastRun();

  function trim<T>(list: T[], max: number): void {
    try {
      if (max > 0 && list.length > max) {
        list.length = max;
      }
    } catch {
      // ignore
    }
  }

  function insertFindingsFront(incoming: readonly AgentFinding[]): void {
    const accepted: AgentFinding[] = [];
    for (const item of incoming) {
      if (isObject(item)) accepted.push(item);
    }
    if (accepted.length === 0) return;
    // Preserve incoming order (newest first) and prepend before existing items.
    findings = accepted.concat(findings);
    trim(findings, maxFindings);
  }

  function insertProposalsFront(incoming: readonly AgentProposal[]): void {
    const accepted: AgentProposal[] = [];
    for (const item of incoming) {
      if (isObject(item)) accepted.push(item);
    }
    if (accepted.length === 0) return;
    proposals = accepted.concat(proposals);
    trim(proposals, maxProposals);
  }

  function saveFindings(next: AgentFinding[]): void {
    try {
      if (!Array.isArray(next)) return;
      insertFindingsFront(next);
    } catch {
      // never throw
    }
  }

  function getLatestFindings(limit?: number): AgentFinding[] {
    try {
      const n = clampLimit(limit, maxFindings);
      if (n === 0) return [];
      return shallowCopyFindings(findings.slice(0, n));
    } catch {
      return [];
    }
  }

  function applyReportToLastRun(report: NightlyReport): void {
    try {
      const finishedAt =
        typeof report.finishedAt === 'string' && report.finishedAt.length > 0
          ? report.finishedAt
          : new Date(nowFn()).toISOString();
      const agents = Array.isArray(report.agents) ? report.agents : [];
      if (agents.length === 0) return;
      const next: Record<AgentId, string | null> = { ...lastRunPerAgent };
      for (const id of agents) {
        if (AGENT_IDS.includes(id)) {
          next[id] = finishedAt;
        }
      }
      lastRunPerAgent = next;
    } catch {
      // ignore
    }
  }

  function saveReport(report: NightlyReport): void {
    try {
      if (!isObject(report)) return;

      // Store a COPY so callers holding the original object aren't affected
      // by later mutations (and vice versa).
      const copy: NightlyReport = { ...report };

      reports = [copy].concat(reports);
      trim(reports, maxReports);

      applyReportToLastRun(copy);

      if (Array.isArray(copy.findings) && copy.findings.length > 0) {
        insertFindingsFront(copy.findings);
      }
      if (Array.isArray(copy.proposals) && copy.proposals.length > 0) {
        insertProposalsFront(copy.proposals);
      }
    } catch {
      // never throw
    }
  }

  function getReports(limit?: number): NightlyReport[] {
    try {
      const n = clampLimit(limit, maxReports);
      if (n === 0) return [];
      return shallowCopyReports(reports.slice(0, n));
    } catch {
      return [];
    }
  }

  function getLatestReport(): NightlyReport | null {
    try {
      const first = reports[0];
      return first && isObject(first) ? first : null;
    } catch {
      return null;
    }
  }

  function saveProposals(next: AgentProposal[]): void {
    try {
      if (!Array.isArray(next)) return;
      insertProposalsFront(next);
    } catch {
      // never throw
    }
  }

  function getProposals(limit?: number): AgentProposal[] {
    try {
      const n = clampLimit(limit, maxProposals);
      if (n === 0) return [];
      return shallowCopyProposals(proposals.slice(0, n));
    } catch {
      return [];
    }
  }

  function getProposal(id: string): AgentProposal | null {
    try {
      if (typeof id !== 'string' || id.length === 0) return null;
      for (const p of proposals) {
        if (p.id === id) return p;
      }
      return null;
    } catch {
      return null;
    }
  }

  function markProposal(id: string, status: ProposalStatus): AgentProposal | null {
    try {
      if (typeof id !== 'string' || id.length === 0) return null;
      if (!isProposalStatus(status)) return null;

      let index = -1;
      for (let i = 0; i < proposals.length; i += 1) {
        const candidate = proposals[i];
        if (candidate && candidate.id === id) {
          index = i;
          break;
        }
      }
      if (index < 0) return null;

      const current = proposals[index];
      if (!current) return null;
      if (!isProposalStatus(current.status)) return null;

      const next = nextStatusIfAllowed(current.status, status);
      if (next === null) return null;

      // Immutable replacement so callers holding the old ref aren't mutated.
      const updated: AgentProposal = { ...current, status: next };
      const nextList = proposals.slice();
      nextList[index] = updated;
      proposals = nextList;

      return updated;
    } catch {
      return null;
    }
  }

  function getLastRunPerAgent(): Record<AgentId, string | null> {
    try {
      return { ...lastRunPerAgent };
    } catch {
      return freshLastRun();
    }
  }

  function clear(): void {
    try {
      findings = [];
      reports = [];
      proposals = [];
      lastRunPerAgent = freshLastRun();
    } catch {
      // never throw
    }
  }

  return {
    saveFindings,
    getLatestFindings,
    saveReport,
    getReports,
    getLatestReport,
    saveProposals,
    getProposals,
    getProposal,
    markProposal,
    getLastRunPerAgent,
    clear,
  };
}

/* -------------------------------------------------------------------------- */
/* Singleton (globalThis-cached so HMR/dev reloads don't duplicate)           */
/* -------------------------------------------------------------------------- */

type GlobalWithStore = typeof globalThis & {
  __noquitAgentStore?: AgentStore;
};

/** Module-level singleton used as a fallback and for direct imports. */
export const agentStore: AgentStore = createMemoryStore();

/**
 * Returns the process-wide store. Uses a globalThis symbol-like key so HMR/dev
 * reloads reuse the same store. Falls back to the module singleton on failure.
 */
export function getAgentStore(): AgentStore {
  try {
    const g = globalThis as GlobalWithStore;
    const existing = g[GLOBAL_STORE_KEY];
    if (existing && typeof existing === 'object') {
      return existing;
    }
    const created = createMemoryStore();
    g[GLOBAL_STORE_KEY] = created;
    return created;
  } catch {
    return agentStore;
  }
}

/**
 * Allows injecting a future KV / Postgres / Redis adapter without touching routes.
 * Routes should call getAgentStore() after installing, so pass a valid object only.
 * Never throws.
 */
export function setAgentStore(store: AgentStore): void {
  try {
    if (!store || typeof store !== 'object') return;
    const g = globalThis as GlobalWithStore;
    g[GLOBAL_STORE_KEY] = store;
  } catch {
    // never throw
  }
}

/* Ensure the global key exists at module load so routes get a consistent instance. */
try {
  const g = globalThis as GlobalWithStore;
  if (!g[GLOBAL_STORE_KEY]) {
    g[GLOBAL_STORE_KEY] = agentStore;
  }
} catch {
  // ignore
}

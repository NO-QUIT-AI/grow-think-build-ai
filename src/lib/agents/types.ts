/**
 * NO QUIT AI — shared types for the 4-agent nightly system.
 *
 * Design rules:
 * - No external dependencies, no imports.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Functions never throw; makeId always returns a non-empty string.
 */

export type AgentId = 'world_tech' | 'market_pulse' | 'smart_app' | 'world_news';

export interface AgentFinding {
  id: string;
  agent: AgentId;
  createdAt: string;
  title: string;
  summary: string;
  whyItMatters: string;
  confidence: number;
  tags: string[];
  sources: string[];
}

export type AgentEffort = 'small' | 'medium' | 'large';
export type AgentRisk = 'low' | 'medium' | 'high';
export type ProposalStatus = 'proposed' | 'awaiting_approval' | 'approved' | 'rejected' | 'applied';

export interface AgentProposal {
  id: string;
  createdAt: string;
  agents: AgentId[];
  title: string;
  what: string;
  why: string;
  effort: AgentEffort;
  risk: AgentRisk;
  impact: number;
  status: ProposalStatus;
  filesHint: string[];
}

export interface CrosstalkMessage {
  id: string;
  round: number;
  from: AgentId;
  to: AgentId | 'all';
  createdAt: string;
  message: string;
}

export type AgentProviderStatus = 'ok' | 'offline';

export interface NightlyReport {
  id: string;
  startedAt: string;
  finishedAt: string;
  timezone: string;
  agents: AgentId[];
  findings: AgentFinding[];
  crosstalk: CrosstalkMessage[];
  proposals: AgentProposal[];
  providerStatus: Record<AgentId, AgentProviderStatus>;
  notes: string[];
}

export const AGENT_IDS: readonly AgentId[] = [
  'world_tech',
  'market_pulse',
  'smart_app',
  'world_news',
];

const AGENT_ID_SET: ReadonlySet<string> = new Set<string>(AGENT_IDS);

/** Type guard: returns true only for one of the four canonical agent ids. Never throws. */
export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && AGENT_ID_SET.has(value);
}

const MAX_PREFIX_LENGTH = 24;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

type CryptoLike = { randomUUID?: () => string };

function getCrypto(): CryptoLike | null {
  try {
    const maybe = (globalThis as unknown as { crypto?: CryptoLike }).crypto;
    return maybe && typeof maybe === 'object' ? maybe : null;
  } catch {
    return null;
  }
}

function randomChars(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * ALPHABET.length);
    out += ALPHABET[Math.max(0, Math.min(ALPHABET.length - 1, idx))] ?? 'x';
  }
  return out;
}

function randomPart(): string {
  try {
    const c = getCrypto();
    if (c && typeof c.randomUUID === 'function') {
      const uuid = c.randomUUID();
      if (typeof uuid === 'string' && uuid.length > 0) {
        return uuid.replace(/-/g, '').slice(0, 12) || randomChars(12);
      }
    }
  } catch {
    // fall through to Math.random
  }
  try {
    return randomChars(12);
  } catch {
    return 'fallbackid';
  }
}

function sanitizePrefix(prefix: string): string {
  try {
    if (typeof prefix !== 'string') return 'id';
    const cleaned = prefix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, MAX_PREFIX_LENGTH);
    return cleaned.length > 0 ? cleaned : 'id';
  } catch {
    return 'id';
  }
}

/**
 * Short random id with a prefix, e.g. `finding_ab12cd34ef56`.
 * Uses crypto.randomUUID when available; falls back to Math.random.
 * Never throws and always returns a non-empty string.
 */
export function makeId(prefix: string): string {
  try {
    return `${sanitizePrefix(prefix)}_${randomPart()}`;
  } catch {
    return 'id_000000000000';
  }
}

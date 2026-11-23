/**
 * NO QUIT AI — nightly crosstalk between the 4 agents + proposal synthesizer.
 *
 * Design rules:
 * - Only depends on './config', './agents', './digest', './types'.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Every exported function never throws.
 */

import { CROSSTALK_ROUNDS, MAX_PROPOSALS, agentConfig } from './config';
import { callModelChain } from './agents';
import { extractJsonObject } from './digest';
import { AGENT_IDS, isAgentId, makeId } from './types';
import type { ProviderMessages } from './agents';
import type {
  AgentEffort,
  AgentFinding,
  AgentId,
  AgentProposal,
  AgentRisk,
  CrosstalkMessage,
} from './types';

export interface CrosstalkResult {
  messages: CrosstalkMessage[];
  proposals: AgentProposal[];
  notes: string[];
}

const DEFAULT_ROUNDS = CROSSTALK_ROUNDS;
const MAX_ROUNDS = 6;
const MAX_MESSAGE_LENGTH = 700;
const MAX_TRANSCRIPT_MESSAGE = 300;
const CROSSTALK_TEMPERATURE = 0.6;
const CROSSTALK_MAX_TOKENS = 400;
const SYNTH_TEMPERATURE = 0.3;
const SYNTH_MAX_TOKENS = 1500;
const OWN_FINDINGS_LIMIT = 3;
const OTHER_AGENT_LIMIT = 2;
const OFFLINE_PROPOSAL_LIMIT = 3;
const FALLBACK_FILES_HINT = ['src/lib/agents/'];
const ALLOWED_EFFORT: readonly AgentEffort[] = ['small', 'medium', 'large'];
const ALLOWED_RISK: readonly AgentRisk[] = ['low', 'medium', 'high'];

type FindingsByAgent = Record<AgentId, AgentFinding[]>;

function emptyFindingsMap(): FindingsByAgent {
  const out = {} as FindingsByAgent;
  for (const id of AGENT_IDS) {
    out[id] = [];
  }
  return out;
}

function groupFindings(findings: AgentFinding[]): FindingsByAgent {
  const grouped = emptyFindingsMap();
  try {
    if (!Array.isArray(findings)) return grouped;
    for (const finding of findings) {
      if (!finding || typeof finding !== 'object') continue;
      const id = finding.agent;
      if (!isAgentId(id)) continue;
      grouped[id].push(finding);
    }
  } catch {
    return emptyFindingsMap();
  }
  return grouped;
}

/** Top-N findings sorted by confidence (deterministic tiebreak by createdAt, then id). */
function topFindings(list: AgentFinding[], limit: number): AgentFinding[] {
  try {
    if (!Array.isArray(list) || limit <= 0) return [];
    const copy = list.slice();
    copy.sort((a, b) => {
      const ca = typeof a.confidence === 'number' && Number.isFinite(a.confidence) ? a.confidence : 0;
      const cb = typeof b.confidence === 'number' && Number.isFinite(b.confidence) ? b.confidence : 0;
      if (cb !== ca) return cb - ca;
      const ta = typeof a.createdAt === 'string' ? a.createdAt : '';
      const tb = typeof b.createdAt === 'string' ? b.createdAt : '';
      if (ta !== tb) return ta < tb ? -1 : 1;
      const ia = typeof a.id === 'string' ? a.id : '';
      const ib = typeof b.id === 'string' ? b.id : '';
      if (ia === ib) return 0;
      return ia < ib ? -1 : 1;
    });
    return copy.slice(0, limit);
  } catch {
    return [];
  }
}

function findingLine(finding: AgentFinding): string {
  const title = typeof finding.title === 'string' ? finding.title.trim() : '';
  const summary = typeof finding.summary === 'string' ? finding.summary.trim() : '';
  const cappedSummary = summary.length > 200 ? `${summary.slice(0, 200)}…` : summary;
  return `- ${title}: ${cappedSummary}`;
}

function normalizeTag(tag: unknown): string | null {
  if (typeof tag !== 'string') return null;
  const trimmed = tag.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function tagSet(finding: AgentFinding): Set<string> {
  const out = new Set<string>();
  try {
    if (!Array.isArray(finding.tags)) return out;
    for (const tag of finding.tags) {
      const normalized = normalizeTag(tag);
      if (normalized !== null) out.add(normalized);
    }
  } catch {
    return new Set<string>();
  }
  return out;
}

/**
 * Deterministically picks the most relevant other agent based on tag overlap.
 * Ties are broken by AGENT_IDS order. Returns null if no overlap at all.
 */
function pickRecipient(from: AgentId, grouped: FindingsByAgent): AgentId | null {
  try {
    const ownTags = new Set<string>();
    for (const finding of grouped[from]) {
      for (const tag of tagSet(finding)) ownTags.add(tag);
    }
    if (ownTags.size === 0) return null;

    let bestId: AgentId | null = null;
    let bestScore = -1;
    for (const candidate of AGENT_IDS) {
      if (candidate === from) continue;
      const candidateFindings = grouped[candidate];
      if (candidateFindings.length === 0) continue;
      let score = 0;
      for (const finding of candidateFindings) {
        for (const tag of tagSet(finding)) {
          if (ownTags.has(tag)) score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestId = candidate;
      }
    }

    if (bestId === null || bestScore <= 0) return null;
    return bestId;
  } catch {
    return null;
  }
}

function buildSystemPrompt(name: string, round: number, rounds: number): string {
  return `You are the "${name}" agent in NO QUIT AI nightly crosstalk. Round ${round} of ${rounds}. Keep it to max 3 short sentences, Roman Urdu/English mix. Reference other agents by name. Do not repeat your own findings only — react and add.`;
}

function buildCrosstalkUserPrompt(
  from: AgentId,
  to: AgentId | 'all',
  grouped: FindingsByAgent
): string {
  const lines: string[] = [];
  try {
    const own = topFindings(grouped[from], OWN_FINDINGS_LIMIT);
    lines.push('Your own findings:');
    if (own.length === 0) {
      lines.push('- (none)');
    } else {
      for (const finding of own) lines.push(findingLine(finding));
    }

    lines.push('');
    lines.push(`Address your message to: ${to === 'all' ? 'all agents' : agentConfig(to).name}.`);
    lines.push('');
    lines.push('Other agents digest (top findings):');

    let wroteAny = false;
    for (const otherId of AGENT_IDS) {
      if (otherId === from) continue;
      const others = topFindings(grouped[otherId], OTHER_AGENT_LIMIT);
      if (others.length === 0) continue;
      wroteAny = true;
      lines.push(`${agentConfig(otherId).name}:`);
      for (const finding of others) lines.push(findingLine(finding));
    }
    if (!wroteAny) {
      lines.push('- (no other agents reported findings this round)');
    }

    lines.push('');
    lines.push('Reply with max 3 short sentences, Roman Urdu/English mix, no JSON, no markdown.');
  } catch {
    return 'Reply with max 3 short sentences reacting to the other agents, Roman Urdu/English mix.';
  }
  return lines.join('\n');
}

function offlineMessage(name: string): string {
  return `${name}: provider offline, main is round me chup hoon.`;
}

function trimMessage(text: string): string {
  try {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed.length === 0) return '';
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return `${trimmed.slice(0, MAX_MESSAGE_LENGTH)}…`;
    }
    return trimmed;
  } catch {
    return '';
  }
}

/**
 * Runs crosstalk between the agents that have findings, then synthesizes proposals.
 * Never throws.
 */
export async function runCrosstalk(
  findings: AgentFinding[],
  rounds?: number
): Promise<CrosstalkResult> {
  const messages: CrosstalkMessage[] = [];
  const notes: string[] = [];

  try {
    const grouped = groupFindings(findings);

    let totalRounds = DEFAULT_ROUNDS;
    if (typeof rounds === 'number' && Number.isFinite(rounds)) {
      const clamped = Math.floor(rounds);
      if (clamped >= 1 && clamped <= MAX_ROUNDS) totalRounds = clamped;
      else if (clamped >= 1) totalRounds = MAX_ROUNDS;
    }

    const activeAgents: AgentId[] = [];
    for (const id of AGENT_IDS) {
      if (grouped[id].length > 0) activeAgents.push(id);
    }

    if (activeAgents.length === 0) {
      notes.push('No findings available — crosstalk skipped.');
      return { messages, proposals: [], notes };
    }

    for (let round = 1; round <= totalRounds; round += 1) {
      for (const from of AGENT_IDS) {
        if (grouped[from].length === 0) continue;

        let name: string = from;
        try {
          name = agentConfig(from).name;
        } catch {
          name = from;
        }

        const recipient = pickRecipient(from, grouped);
        const to: AgentId | 'all' = recipient === null ? 'all' : recipient;

        let replyText = '';
        try {
          const systemPrompt = buildSystemPrompt(name, round, totalRounds);
          const userPrompt = buildCrosstalkUserPrompt(from, to, grouped);
          const providerMessages: ProviderMessages[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ];
          const reply = await callModelChain(providerMessages, {
            temperature: CROSSTALK_TEMPERATURE,
            maxTokens: CROSSTALK_MAX_TOKENS,
          });
          if (reply !== null && typeof reply.text === 'string') {
            replyText = trimMessage(reply.text);
          }
        } catch {
          replyText = '';
        }

        if (replyText.length === 0) {
          replyText = trimMessage(offlineMessage(name));
        }

        try {
          messages.push({
            id: makeId('talk'),
            round,
            from,
            to,
            createdAt: new Date().toISOString(),
            message: replyText,
          });
        } catch {
          // skip this message if construction fails
        }
      }
    }

    let proposals: AgentProposal[] = [];
    try {
      proposals = await synthesizeProposals(messages, findings);
    } catch {
      proposals = [];
    }

    return { messages, proposals, notes };
  } catch {
    notes.push('Crosstalk failed unexpectedly.');
    return { messages, proposals: [], notes };
  }
}

function buildTranscript(messages: CrosstalkMessage[]): string {
  const lines: string[] = [];
  try {
    if (!Array.isArray(messages)) return '';
    for (const m of messages) {
      const raw = typeof m.message === 'string' ? m.message.trim() : '';
      if (raw.length === 0) continue;
      const capped = raw.length > MAX_TRANSCRIPT_MESSAGE ? `${raw.slice(0, MAX_TRANSCRIPT_MESSAGE)}…` : raw;
      const from = isAgentId(m.from) ? m.from : 'world_tech';
      const round = typeof m.round === 'number' && Number.isFinite(m.round) ? Math.floor(m.round) : 0;
      lines.push(`[R${round}] ${from}: ${capped}`);
    }
  } catch {
    return '';
  }
  return lines.join('\n');
}

function buildSynthesisUserPrompt(messages: CrosstalkMessage[], findings: AgentFinding[]): string {
  const lines: string[] = [];
  try {
    lines.push('Crosstalk transcript (truncated):');
    const transcript = buildTranscript(messages);
    lines.push(transcript.length > 0 ? transcript : '(no messages)');
    lines.push('');
    lines.push('Top findings titles:');
    const top = topFindings(Array.isArray(findings) ? findings : [], 8);
    if (top.length === 0) {
      lines.push('- (none)');
    } else {
      for (const finding of top) {
        const title = typeof finding.title === 'string' ? finding.title.trim() : '';
        if (title.length > 0) lines.push(`- ${title}`);
      }
    }
  } catch {
    return 'Produce STRICT JSON proposals from the crosstalk.';
  }
  return lines.join('\n');
}

const SYNTH_SYSTEM_PROMPT =
  'You are the synthesizer for NO QUIT AI. Merge the agents' +
  "'" +
  ' crosstalk into concrete system-improvement proposals. Reply STRICT JSON only: ' +
  '{"proposals":[{"title","what","why","effort":"small|medium|large","risk":"low|medium|high","impact":number 1-10,"agents":["world_tech",...],"filesHint":["src/..."]}]}';

function clampImpact(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 5;
  const rounded = Math.round(n);
  if (rounded < 1) return 1;
  if (rounded > 10) return 10;
  return rounded;
}

function coerceEffort(value: unknown): AgentEffort {
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    for (const allowed of ALLOWED_EFFORT) {
      if (allowed === lowered) return allowed;
    }
  }
  return 'medium';
}

function coerceRisk(value: unknown): AgentRisk {
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    for (const allowed of ALLOWED_RISK) {
      if (allowed === lowered) return allowed;
    }
  }
  return 'medium';
}

function coerceStringArray(value: unknown): string[] {
  try {
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (trimmed.length > 0) out.push(trimmed);
    }
    return out;
  } catch {
    return [];
  }
}

function coerceAgentArray(value: unknown, fallback: AgentId[]): AgentId[] {
  const out: AgentId[] = [];
  try {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isAgentId(item) && !out.includes(item)) out.push(item);
      }
    }
  } catch {
    // fall through
  }
  if (out.length > 0) return out;
  return fallback.slice();
}

function agentsSeenInMessages(messages: CrosstalkMessage[]): AgentId[] {
  const out: AgentId[] = [];
  try {
    if (!Array.isArray(messages)) return out;
    for (const m of messages) {
      if (isAgentId(m.from) && !out.includes(m.from)) out.push(m.from);
    }
  } catch {
    return out;
  }
  return out;
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function candidatesFrom(json: unknown): unknown[] {
  try {
    if (Array.isArray(json)) return json;
    if (json && typeof json === 'object') {
      const proposals = (json as { proposals?: unknown }).proposals;
      if (Array.isArray(proposals)) return proposals;
    }
  } catch {
    return [];
  }
  return [];
}

function parseProposals(
  json: unknown,
  messages: CrosstalkMessage[],
  limit: number
): AgentProposal[] {
  const out: AgentProposal[] = [];
  try {
    const raw = candidatesFrom(json);
    if (raw.length === 0) return out;

    const fallbackAgents = agentsSeenInMessages(messages);
    const effectiveFallback: AgentId[] = fallbackAgents.length > 0 ? fallbackAgents : AGENT_IDS.slice(0, 1);
    const now = new Date().toISOString();
    const max = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
    if (max === 0) return out;

    for (const item of raw) {
      if (out.length >= max) break;
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const title = asTrimmedString(rec['title']);
      if (title.length === 0) continue;

      const what = asTrimmedString(rec['what']);
      const why = asTrimmedString(rec['why']);
      const effort = coerceEffort(rec['effort']);
      const risk = coerceRisk(rec['risk']);
      const impact = clampImpact(rec['impact']);
      const agents = coerceAgentArray(rec['agents'], effectiveFallback);
      const filesHint = coerceStringArray(rec['filesHint']);

      out.push({
        id: makeId('proposal'),
        createdAt: now,
        agents,
        title,
        what,
        why,
        effort,
        risk,
        impact,
        status: 'proposed',
        filesHint,
      });
    }
  } catch {
    return out;
  }
  return out;
}

function localFallbackProposals(findings: AgentFinding[], limit: number): AgentProposal[] {
  const out: AgentProposal[] = [];
  try {
    const list = Array.isArray(findings) ? findings : [];
    const top = topFindings(list, limit);
    const now = new Date().toISOString();
    for (const finding of top) {
      const confidence =
        typeof finding.confidence === 'number' && Number.isFinite(finding.confidence)
          ? finding.confidence
          : 0;
      const impact = clampImpact(confidence * 10);
      const agent = isAgentId(finding.agent) ? finding.agent : AGENT_IDS[0]!;
      const title = asTrimmedString(finding.title);
      if (title.length === 0) continue;
      out.push({
        id: makeId('proposal'),
        createdAt: now,
        agents: [agent],
        title: `Act on: ${title}`,
        what: asTrimmedString(finding.summary),
        why: asTrimmedString(finding.whyItMatters),
        effort: 'small',
        risk: 'low',
        impact,
        status: 'proposed',
        filesHint: FALLBACK_FILES_HINT.slice(),
      });
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * Synthesizes proposals from the crosstalk transcript. On model failure falls back
 * to deterministic local proposals derived from high-confidence findings.
 * Never throws.
 */
export async function synthesizeProposals(
  messages: CrosstalkMessage[],
  findings: AgentFinding[]
): Promise<AgentProposal[]> {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeFindings = Array.isArray(findings) ? findings : [];
  const limit =
    typeof MAX_PROPOSALS === 'number' && Number.isFinite(MAX_PROPOSALS) && MAX_PROPOSALS > 0
      ? Math.floor(MAX_PROPOSALS)
      : 8;

  try {
    const userPrompt = buildSynthesisUserPrompt(safeMessages, safeFindings);
    const providerMessages: ProviderMessages[] = [
      { role: 'system', content: SYNTH_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    let replyText = '';
    try {
      const reply = await callModelChain(providerMessages, {
        temperature: SYNTH_TEMPERATURE,
        maxTokens: SYNTH_MAX_TOKENS,
      });
      if (reply !== null && typeof reply.text === 'string') {
        replyText = reply.text.trim();
      }
    } catch {
      replyText = '';
    }

    if (replyText.length === 0) {
      return localFallbackProposals(safeFindings, OFFLINE_PROPOSAL_LIMIT);
    }

    const json = extractJsonObject(replyText);
    if (json === null) {
      return localFallbackProposals(safeFindings, OFFLINE_PROPOSAL_LIMIT);
    }

    const parsed = parseProposals(json, safeMessages, limit);
    if (parsed.length === 0) {
      return localFallbackProposals(safeFindings, OFFLINE_PROPOSAL_LIMIT);
    }
    return parsed;
  } catch {
    try {
      return localFallbackProposals(safeFindings, OFFLINE_PROPOSAL_LIMIT);
    } catch {
      return [];
    }
  }
}

/** One-line human summary for the status UI. Never throws. */
export function describeProposal(p: AgentProposal): string {
  try {
    const title = typeof p.title === 'string' && p.title.trim().length > 0 ? p.title.trim() : 'Untitled proposal';
    const agents = Array.isArray(p.agents)
      ? p.agents.filter((a): a is AgentId => isAgentId(a)).join(', ')
      : '';
    const effort = typeof p.effort === 'string' ? p.effort : 'medium';
    const risk = typeof p.risk === 'string' ? p.risk : 'medium';
    const impact =
      typeof p.impact === 'number' && Number.isFinite(p.impact) ? Math.round(p.impact) : 0;
    const who = agents.length > 0 ? agents : 'no agents';
    return `${title} — ${who} | effort: ${effort} | risk: ${risk} | impact: ${impact}/10`;
  } catch {
    return 'Proposal (details unavailable)';
  }
}

/**
 * NO QUIT AI — autopatch: turns an AgentProposal into review-ready branch request text.
 *
 * Design rules:
 * - NEVER pushes, merges or deploys. It only produces text for the owner to review
 *   and approve through the existing GitHub branch-push flow.
 * - Only depends on './types', './crosstalk' (describeProposal), './config' (allowAutoApply).
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Every exported function never throws.
 * - Never returns autoApplyAllowed:true.
 */

import { describeProposal } from './crosstalk';
import { agentConfig } from './config';
import type { AgentId, AgentProposal } from './types';
import { isAgentId } from './types';

export interface BranchRequestText {
  proposalId: string;
  title: string;
  branchNameHint: string;
  request: string;
  safetyNotes: string[];
  autoApplyAllowed: boolean;
}

export interface BranchRequestContext {
  latestReportId?: string | null;
  filesHint?: string[];
}

const BRANCH_PREFIX = 'noquit-agents/';
const BRANCH_SLUG_MAX = 48;
const REQUEST_MAX = 5500;
const TRUNCATION_SUFFIX = '…[truncated]';
const FALLBACK_FILES_HINT = 'src/lib/agents/';
const REDACTED = '[redacted]';

const GUARDRAILS =
  '* Only touch the files listed above. * No dependency upgrades. * No changes to auth, secrets, env handling or CI. * No auto-merge, no deploy — prepare Before/After only. * TypeScript strict-safe and never-throw. * Tests must be added or updated when logic changes.';

/* -------------------------------------------------------------------------- */
/* Safe string helpers                                                         */
/* -------------------------------------------------------------------------- */

function safeString(value: unknown): string {
  try {
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

function safeTrim(value: unknown): string {
  try {
    return safeString(value).trim();
  } catch {
    return '';
  }
}

function safeArray(value: unknown): unknown[] {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function cleanStringList(value: unknown): string[] {
  const out: string[] = [];
  try {
    for (const item of safeArray(value)) {
      const trimmed = safeTrim(item);
      if (trimmed.length > 0) out.push(trimmed);
    }
  } catch {
    return [];
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Redaction                                                                   */
/* -------------------------------------------------------------------------- */

const REDACTION_PATTERNS: readonly RegExp[] = [
  /Bearer\s+[A-Za-z0-9._\-+/=]{4,}/gi,
  /sk-[A-Za-z0-9]{8,}/g,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /[A-Fa-f0-9]{40,}/g,
  /[A-Za-z0-9+/_-]{40,}={0,2}/g,
];

/** Scrubs secret-looking substrings. Never throws. */
function redact(value: unknown): string {
  let text = '';
  try {
    text = safeString(value);
  } catch {
    return '';
  }
  for (const pattern of REDACTION_PATTERNS) {
    try {
      pattern.lastIndex = 0;
      text = text.replace(pattern, REDACTED);
    } catch {
      // skip this pattern
    }
  }
  return text;
}

/* -------------------------------------------------------------------------- */
/* Branch name hint                                                            */
/* -------------------------------------------------------------------------- */

function shortId(p: AgentProposal): string {
  try {
    const raw = safeTrim(p.id).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (raw.length > 0) return raw.slice(0, 12);
  } catch {
    // fall through
  }
  return 'unknown';
}

/** Lowercase, ascii-safe branch name hint. Never throws. */
export function branchNameHintFromProposal(p: AgentProposal): string {
  try {
    const title = redact(safeTrim(p.title))
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, BRANCH_SLUG_MAX)
      .replace(/-+$/g, '');
    if (title.length > 0) return `${BRANCH_PREFIX}${title}`;
    return `${BRANCH_PREFIX}proposal-${shortId(p)}`;
  } catch {
    return `${BRANCH_PREFIX}proposal-unknown`;
  }
}

/* -------------------------------------------------------------------------- */
/* Config                                                                      */
/* -------------------------------------------------------------------------- */

function readAllowAutoApply(): boolean {
  try {
    const probe: AgentId = 'world_tech';
    const cfg = agentConfig(probe);
    const flag = (cfg as { allowAutoApply?: unknown }).allowAutoApply;
    // Must always be false today; never return true.
    return flag === true ? false : false;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Request text                                                                */
/* -------------------------------------------------------------------------- */

function resolveFilesHint(p: AgentProposal, ctx: BranchRequestContext | undefined): string[] {
  try {
    const fromProposal = cleanStringList(p.filesHint);
    if (fromProposal.length > 0) return fromProposal;
    if (ctx && typeof ctx === 'object') {
      const fromContext = cleanStringList(ctx.filesHint);
      if (fromContext.length > 0) return fromContext;
    }
  } catch {
    // fall through to default
  }
  return [FALLBACK_FILES_HINT];
}

function describeAgents(agents: unknown): string {
  try {
    const names: string[] = [];
    for (const id of safeArray(agents)) {
      if (!isAgentId(id)) continue;
      let name: string = id;
      try {
        name = agentConfig(id).name;
      } catch {
        name = id;
      }
      const label = safeTrim(name).length > 0 ? safeTrim(name) : id;
      if (!names.includes(label)) names.push(label);
    }
    return names.length > 0 ? names.join(', ') : 'none';
  } catch {
    return 'none';
  }
}

function clampImpact(value: unknown): string {
  try {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
    if (n < 1) return 'n/a';
    if (n > 10) return '10/10';
    return `${n}/10`;
  } catch {
    return 'n/a';
  }
}

function buildRequest(
  p: AgentProposal,
  filesHint: string[],
  ctx: BranchRequestContext | undefined
): string {
  const title = redact(safeTrim(p.title)) || 'Untitled proposal';
  const what = redact(safeTrim(p.what)) || '(not provided)';
  const why = redact(safeTrim(p.why)) || '(not provided)';
  const effort = redact(safeTrim(p.effort)) || 'medium';
  const risk = redact(safeTrim(p.risk)) || 'medium';
  const impact = clampImpact(p.impact);
  const agents = describeAgents(p.agents);

  let summary = '';
  try {
    summary = redact(describeProposal(p));
  } catch {
    summary = title;
  }

  let latestReport = '';
  try {
    const raw = ctx && typeof ctx === 'object' ? ctx.latestReportId : null;
    latestReport = safeTrim(raw);
  } catch {
    latestReport = '';
  }

  const filesList = filesHint.map((f) => `- ${redact(f)}`).join('\n');

  const lines: string[] = [
    'Branch request (owner review only — NO auto-merge, NO deploy)',
    '',
    `Title: ${title}`,
    '',
    `What: ${what}`,
    '',
    `Why: ${why}`,
    '',
    `Effort: ${effort} | Risk: ${risk} | Impact: ${impact}`,
    `Contributing agents: ${agents}`,
  ];
  if (latestReport.length > 0) {
    lines.push(`Latest report: ${redact(latestReport)}`);
  }
  lines.push('', 'Files to touch:', filesList, '');
  lines.push('Guardrails (mandatory):', GUARDRAILS, '');
  lines.push(`Summary: ${summary}`);

  return redact(lines.join('\n'));
}

function truncateRequest(text: string): string {
  try {
    if (text.length <= REQUEST_MAX) return text;
    const keep = Math.max(0, REQUEST_MAX - TRUNCATION_SUFFIX.length);
    return `${text.slice(0, keep)}${TRUNCATION_SUFFIX}`;
  } catch {
    return TRUNCATION_SUFFIX;
  }
}

function buildSafetyNotes(p: AgentProposal): string[] {
  const notes: string[] = [
    'Owner approval required before any push',
    'No direct push to main',
    'No secrets or env values included in the request text',
  ];
  try {
    if (p.risk === 'high') notes.push('Risk is high — extra review needed');
    if (p.effort === 'large') notes.push('Large effort — split into smaller parts');
  } catch {
    // ignore
  }
  return notes.map((n) => redact(n));
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

function minimalSafeRequest(
  p: AgentProposal | null | undefined,
  note?: string
): BranchRequestText {
  let proposalId = '';
  let title = '';
  try {
    if (p && typeof p === 'object') {
      proposalId = safeTrim(p.id);
      title = redact(safeTrim(p.title));
    }
  } catch {
    proposalId = '';
    title = '';
  }
  return {
    proposalId,
    title: title.length > 0 ? title : 'Untitled proposal',
    branchNameHint: `${BRANCH_PREFIX}proposal-manual`,
    request:
      'Manual follow-up needed. Build the branch request yourself in the GitHub branch-push flow. ' +
      'No auto-merge, no deploy.',
    safetyNotes: note !== undefined ? [note] : ['Autopatch formatting failed — build the request manually.'],
    autoApplyAllowed: false,
  };
}

/**
 * Builds a plain-English, copy-pasteable branch request for the owner.
 * Never pushes/merges/deploys and never throws.
 */
export function toBranchRequest(
  p: AgentProposal,
  context?: { latestReportId?: string | null; filesHint?: string[] }
): BranchRequestText {
  try {
    if (!p || typeof p !== 'object') {
      return minimalSafeRequest(null);
    }

    const filesHint = resolveFilesHint(p, context);
    const request = truncateRequest(buildRequest(p, filesHint, context));
    const notes = buildSafetyNotes(p);

    return {
      proposalId: safeTrim(p.id),
      title: redact(safeTrim(p.title)) || 'Untitled proposal',
      branchNameHint: branchNameHintFromProposal(p),
      request,
      safetyNotes: notes,
      autoApplyAllowed: readAllowAutoApply(),
    };
  } catch {
    return minimalSafeRequest(p);
  }
}

/** One-line summary for the status UI. Never throws. */
export function describeBranchRequest(r: BranchRequestText): string {
  try {
    if (!r || typeof r !== 'object') return 'Branch request (unavailable)';
    const title = redact(safeTrim(r.title)) || 'Untitled proposal';
    const branch = redact(safeTrim(r.branchNameHint)) || `${BRANCH_PREFIX}proposal-manual`;
    const autoApply = r.autoApplyAllowed === true ? 'auto-apply ON' : 'auto-apply OFF';
    const notesCount = safeArray(r.safetyNotes).length;
    return `${title} — branch: ${branch} | ${autoApply} | safety notes: ${notesCount}`;
  } catch {
    return 'Branch request (unavailable)';
  }
}

/**
 * NO QUIT AI — agentic action tools (poster, summary, list, checklist).
 *
 * Design rules:
 * - No external dependencies; fully synchronous and pure.
 * - No fetch, no env keys, no side effects.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - runTool never throws: bad args yield { ok: false, error }.
 */

export type ToolName = 'make_poster' | 'make_summary' | 'make_list' | 'make_checklist';

export interface PosterResult {
  title: string;
  subtitle?: string;
  bullets: string[];
  palette: { background: string; accent: string; text: string };
  aspect: '1080x1350' | '1080x1080' | '1920x1080';
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
}

export interface ListResult {
  title: string;
  items: string[];
}

export interface ChecklistResult {
  title: string;
  tasks: Array<{ label: string; done: boolean }>;
}

export interface AgenticResult {
  tool: ToolName;
  ok: boolean;
  data?: PosterResult | SummaryResult | ListResult | ChecklistResult;
  error?: string;
}

export interface ToolArgs {
  brief?: string;
  text?: string;
  title?: string;
  raw?: string;
}

export const DEFAULT_PALETTE: { background: string; accent: string; text: string } = {
  background: '#05070a',
  accent: '#00EEFF',
  text: '#e8fbff',
};

const VALID_ASPECTS: readonly PosterResult['aspect'][] = ['1080x1350', '1080x1080', '1920x1080'];
const DEFAULT_ASPECT: PosterResult['aspect'] = '1080x1350';
const DEFAULT_SUMMARY_POINTS = 3;
const DEFAULT_POSTER_TITLE = 'NO QUIT AI';
const DEFAULT_LIST_TITLE = 'List';
const DEFAULT_CHECKLIST_TITLE = 'Checklist';

function normalizeAspect(value: string | undefined): PosterResult['aspect'] {
  if (typeof value !== 'string') return DEFAULT_ASPECT;
  const trimmed = value.trim() as PosterResult['aspect'];
  return VALID_ASPECTS.includes(trimmed) ? trimmed : DEFAULT_ASPECT;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .match(/[^.!?۔]+[.!?۔]?/g)
    ?.map((s) => s.trim())
    .filter((s) => s.length > 0) ?? [];
}

function splitBulletSource(brief: string): string[] {
  return brief
    .split(/[\n;]+|(?<=[.!?۔])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function clampPositive(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function dedupeTrim(values: string[]): string[] {
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

/** Keyword-based tool detection for Roman Urdu + English requests. */
export function detectTool(input: string): ToolName | null {
  if (typeof input !== 'string') return null;
  const text = input.toLowerCase();
  if (text.trim().length === 0) return null;

  if (/\b(checklist|check-list|steps|tasks?|todo|to-do|kaam ki list|kaam ke steps)\b/.test(text)) {
    return 'make_checklist';
  }
  if (/\b(poster|banner|design|flyer|graphic|thumbnail)\b/.test(text)) {
    return 'make_poster';
  }
  if (/\b(summary|summarize|summarise|summarization|khulasa|khulaasa|nichod|tldr|tl;dr)\b/.test(text)) {
    return 'make_summary';
  }
  if (/\b(list|fehrist|fehrist|list banao|items)\b/.test(text)) {
    return 'make_list';
  }
  return null;
}

/** Deterministic local poster builder — splits a brief into title/subtitle/bullets. */
export function makePoster(brief: string, options?: { aspect?: string }): PosterResult {
  const clean = typeof brief === 'string' ? brief.trim() : '';
  const segments = splitBulletSource(clean);

  let title = DEFAULT_POSTER_TITLE;
  let subtitle: string | undefined;
  const bullets: string[] = [];

  const first = segments[0];
  if (first !== undefined) {
    const firstWords = first.split(' ').filter((w) => w.length > 0);
    if (firstWords.length <= 6) {
      title = first;
      const second = segments[1];
      if (second !== undefined) subtitle = second;
      bullets.push(...segments.slice(2));
    } else {
      const words = first.split(/\s+/);
      title = words.slice(0, 5).join(' ');
      subtitle = words.slice(5).join(' ');
      bullets.push(...segments.slice(1));
    }
  }

  if (bullets.length === 0 && subtitle === undefined && clean.length > 0) {
    bullets.push(clean);
  }

  const result: PosterResult = {
    title: title.length > 0 ? title : DEFAULT_POSTER_TITLE,
    bullets: dedupeTrim(bullets).slice(0, 6),
    palette: { ...DEFAULT_PALETTE },
    aspect: normalizeAspect(options?.aspect),
  };
  if (subtitle !== undefined && subtitle.length > 0) result.subtitle = subtitle;
  return result;
}

/** Naive extractive summary — sentence split, first N sentences kept. No API. */
export function makeSummary(text: string, maxPoints?: number): SummaryResult {
  const clean = typeof text === 'string' ? text.trim() : '';
  const limit = clampPositive(maxPoints, DEFAULT_SUMMARY_POINTS);
  const sentences = splitSentences(clean);
  if (sentences.length === 0) {
    return { summary: '', keyPoints: [] };
  }
  const summary = sentences.slice(0, limit).join(' ').trim();
  return {
    summary,
    keyPoints: sentences.slice(0, limit),
  };
}

/** Splits raw input on newlines/commas/semicolons, trims and dedupes. */
export function makeList(title: string, raw: string): ListResult {
  const safeTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : DEFAULT_LIST_TITLE;
  const source = typeof raw === 'string' ? raw : '';
  const pieces = source.split(/[\n,;]+/);
  const items = dedupeTrim(pieces);
  return { title: safeTitle, items };
}

/** Splits raw into tasks — everything starts not done. */
export function makeChecklist(title: string, raw: string): ChecklistResult {
  const base = makeList(title, raw);
  const safeTitle = base.title === DEFAULT_LIST_TITLE && base.items.length === 0
    ? DEFAULT_CHECKLIST_TITLE
    : base.title;
  return {
    title: safeTitle,
    tasks: base.items.map((label) => ({ label, done: false })),
  };
}

/**
 * Runs a tool from raw args. Never throws: on bad/missing args returns
 * { ok: false, error } with the requested tool name preserved.
 */
export function runTool(tool: ToolName, args: ToolArgs): AgenticResult {
  try {
    const safeArgs: ToolArgs = args !== null && typeof args === 'object' ? args : {};
    switch (tool) {
      case 'make_poster': {
        const brief = safeArgs.brief ?? safeArgs.text ?? '';
        if (brief.trim().length === 0) {
          return { tool, ok: false, error: 'make_poster requires a non-empty brief.' };
        }
        return { tool, ok: true, data: makePoster(brief) };
      }
      case 'make_summary': {
        const text = safeArgs.text ?? safeArgs.raw ?? '';
        if (text.trim().length === 0) {
          return { tool, ok: false, error: 'make_summary requires non-empty text.' };
        }
        return { tool, ok: true, data: makeSummary(text) };
      }
      case 'make_list': {
        const raw = safeArgs.raw ?? safeArgs.text ?? '';
        if (raw.trim().length === 0) {
          return { tool, ok: false, error: 'make_list requires non-empty raw items.' };
        }
        return { tool, ok: true, data: makeList(safeArgs.title ?? DEFAULT_LIST_TITLE, raw) };
      }
      case 'make_checklist': {
        const raw = safeArgs.raw ?? safeArgs.text ?? '';
        if (raw.trim().length === 0) {
          return { tool, ok: false, error: 'make_checklist requires non-empty raw items.' };
        }
        return { tool, ok: true, data: makeChecklist(safeArgs.title ?? DEFAULT_CHECKLIST_TITLE, raw) };
      }
      default:
        return { tool, ok: false, error: 'Unknown tool.' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected tool failure.';
    return { tool, ok: false, error: message };
  }
}

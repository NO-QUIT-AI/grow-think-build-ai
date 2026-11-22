// @ts-nocheck -- Bun test runner for agentic tools.
import { expect, test } from 'bun:test';
import {
  detectTool,
  makePoster,
  makeSummary,
  makeList,
  makeChecklist,
  runTool,
  DEFAULT_PALETTE,
} from './tools';

test('detectTool matches English keywords', () => {
  expect(detectTool('make a poster for launch')).toBe('make_poster');
  expect(detectTool('summarize this article')).toBe('make_summary');
  expect(detectTool('give me a list of ideas')).toBe('make_list');
  expect(detectTool('make a checklist of steps')).toBe('make_checklist');
});

test('detectTool matches Roman Urdu keywords', () => {
  expect(detectTool('khulasa de do')).toBe('make_summary');
  expect(detectTool('fehrist banao')).toBe('make_list');
  expect(detectTool('tasks ke steps likho')).toBe('make_checklist');
});

test('detectTool returns null for empty or unrelated input', () => {
  expect(detectTool('')).toBeNull();
  expect(detectTool('hello there')).toBeNull();
});

test('makePoster uses default NO QUIT AI palette and aspect', () => {
  const poster = makePoster('Launch');
  expect(poster.palette).toEqual(DEFAULT_PALETTE);
  expect(poster.aspect).toBe('1080x1350');
});

test('makePoster honors valid aspect and rejects invalid', () => {
  expect(makePoster('X', { aspect: '1920x1080' }).aspect).toBe('1920x1080');
  expect(makePoster('X', { aspect: 'bad' }).aspect).toBe('1080x1350');
});

test('makePoster splits brief into title, subtitle, bullets', () => {
  const poster = makePoster('NO QUIT AI\nStay unstoppable\nShip daily\nBuild momentum');
  expect(poster.title).toBe('NO QUIT AI');
  expect(poster.subtitle).toBe('Stay unstoppable');
  expect(poster.bullets).toEqual(['Ship daily', 'Build momentum']);
});

test('makePoster is deterministic', () => {
  expect(makePoster('same brief')).toEqual(makePoster('same brief'));
});

test('makeSummary extracts first sentences', () => {
  const result = makeSummary('One. Two. Three. Four.', 2);
  expect(result.summary).toBe('One. Two.');
  expect(result.keyPoints).toEqual(['One.', 'Two.']);
});

test('makeSummary handles empty text', () => {
  expect(makeSummary('')).toEqual({ summary: '', keyPoints: [] });
});

test('makeList splits, trims and dedupes', () => {
  const list = makeList('Ideas', 'a, b; a\nc');
  expect(list.title).toBe('Ideas');
  expect(list.items).toEqual(['a', 'b', 'c']);
});

test('makeChecklist marks tasks as not done', () => {
  const checklist = makeChecklist('Todo', 'write test, run lint');
  expect(checklist.tasks).toEqual([
    { label: 'write test', done: false },
    { label: 'run lint', done: false },
  ]);
});

test('runTool returns ok result for each tool', () => {
  expect(runTool('make_poster', { brief: 'Hello' }).ok).toBe(true);
  expect(runTool('make_summary', { text: 'A. B.' }).ok).toBe(true);
  expect(runTool('make_list', { raw: 'x, y', title: 'L' }).ok).toBe(true);
  expect(runTool('make_checklist', { raw: 'one; two' }).ok).toBe(true);
});

test('runTool returns ok:false on missing args without throwing', () => {
  const poster = runTool('make_poster', {});
  expect(poster.ok).toBe(false);
  expect(poster.tool).toBe('make_poster');
  expect(typeof poster.error).toBe('string');

  const summary = runTool('make_summary', { text: '   ' });
  expect(summary.ok).toBe(false);
});

test('runTool never throws on malformed args object', () => {
  // @ts-expect-error intentionally malformed
  const result = runTool('make_list', null);
  expect(result.ok).toBe(false);
});

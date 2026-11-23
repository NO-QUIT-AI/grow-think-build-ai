import { describe, it } from "node:test";
import { expect } from "../../test-expect";

import {
  describeSchedule,
  isDueNow,
  millisecondsUntilNextRun,
  nextRunIso,
  runNightlyOnce,
} from '../scheduler';
import { createMemoryStore } from '../store';
import { AGENT_IDS } from '../types';
import type { AgentId, NightlyReport } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeReport(id: string): NightlyReport {
  const providerStatus = {} as Record<AgentId, 'ok' | 'offline'>;
  for (const agentId of AGENT_IDS) {
    providerStatus[agentId] = 'offline';
  }

  return {
    id,
    startedAt: '2026-11-22T23:00:00.000Z',
    finishedAt: '2026-11-22T23:00:05.000Z',
    timezone: 'Asia/Dubai',
    agents: [...AGENT_IDS],
    findings: [],
    crosstalk: [],
    proposals: [],
    providerStatus,
    notes: [],
  };
}

describe('millisecondsUntilNextRun', () => {
  it('is positive and at most one day for sample instants', () => {
    const samples: Date[] = [
      new Date('2026-11-22T21:33:23Z'),
      new Date('2026-11-22T00:00:00Z'),
      new Date('2026-11-22T23:00:00Z'),
    ];
    for (const sample of samples) {
      const ms = millisecondsUntilNextRun(sample);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(DAY_MS);
    }
  });
});

describe('nextRunIso', () => {
  it('points to 2026-11-23T23:00:00.000Z at 23:00Z on 2026-11-22', () => {
    expect(nextRunIso(new Date('2026-11-22T23:00:00Z'))).toBe(
      '2026-11-23T23:00:00.000Z'
    );
  });

  it('is a valid future ISO timestamp', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    const iso = nextRunIso(now);
    const parsed = new Date(iso);
    expect(Number.isFinite(parsed.getTime())).toBe(true);
    expect(parsed.toISOString()).toBe(iso);
    expect(parsed.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('isDueNow', () => {
  it('is true inside the 03:00 Dubai window with no last run', () => {
    expect(isDueNow(new Date('2026-11-22T23:05:00Z'), null)).toBe(true);
  });

  it('is false when the last run was today in Dubai', () => {
    expect(
      isDueNow(new Date('2026-11-22T23:05:00Z'), '2026-11-22T23:00:00.000Z')
    ).toBe(false);
  });

  it('is false at 04:00 Dubai', () => {
    expect(isDueNow(new Date('2026-11-23T00:00:00Z'), null)).toBe(false);
  });
});

describe('describeSchedule', () => {
  it('reports Dubai schedule details and all agent last-run keys', () => {
    const schedule = describeSchedule(new Date('2026-11-22T12:00:00Z'));
    expect(schedule.timezone).toBe('Asia/Dubai');
    expect(schedule.hour).toBe(3);
    for (const agentId of AGENT_IDS) {
      expect(Object.prototype.hasOwnProperty.call(schedule.lastRunPerAgent, agentId)).toBe(
        true
      );
    }
  });
});

describe('runNightlyOnce', () => {
  it('skips outside the window without persisting a report', async () => {
    const store = createMemoryStore();
    const summary = await runNightlyOnce(store, { force: false });

    expect(summary.ok).toBe(true);
    expect(summary.skipped).toBe(true);
    expect(store.getReports()).toHaveLength(0);
  });
});

import { describe, it } from "node:test";
import { expect } from "../../test-expect";

import { createMemoryStore } from '../store';
import { AGENT_IDS } from '../types';
import type {
  AgentFinding,
  AgentId,
  AgentProposal,
  NightlyReport,
  ProposalStatus,
} from '../types';

function makeFinding(n: number): AgentFinding {
  return {
    id: `finding-${n}`,
    agent: 'world_tech',
    createdAt: `2026-11-22T23:00:0${n % 10}.000Z`,
    title: `Finding ${n}`,
    summary: `Summary ${n}`,
    whyItMatters: `Why ${n}`,
    confidence: 0.5,
    tags: ['t'],
    sources: ['https://example.com'],
  };
}

function makeProposal(n: number, status: ProposalStatus): AgentProposal {
  return {
    id: `proposal-${n}`,
    createdAt: `2026-11-22T23:00:0${n % 10}.000Z`,
    agents: ['world_tech'],
    title: `Proposal ${n}`,
    what: `What ${n}`,
    why: `Why ${n}`,
    effort: 'small',
    risk: 'low',
    impact: 3,
    status,
    filesHint: ['src/x.ts'],
  };
}

function makeReport(partial: Partial<NightlyReport>): NightlyReport {
  const providerStatus = {} as Record<AgentId, 'ok' | 'offline'>;
  for (const agentId of AGENT_IDS) {
    providerStatus[agentId] = 'offline';
  }
  return {
    id: 'report-1',
    startedAt: '2026-11-22T23:00:00.000Z',
    finishedAt: '2026-11-22T23:00:05.000Z',
    timezone: 'Asia/Dubai',
    agents: [...AGENT_IDS],
    findings: [],
    crosstalk: [],
    proposals: [],
    providerStatus,
    notes: [],
    ...partial,
  };
}

describe('createMemoryStore', () => {
  it('caps findings and keeps newest first', () => {
    const store = createMemoryStore({ maxFindings: 3 });
    const items: AgentFinding[] = [];
    for (let i = 1; i <= 5; i += 1) items.push(makeFinding(i));
    store.saveFindings(items);

    const latest = store.getLatestFindings();
    expect(latest).toHaveLength(3);
    expect(latest[0]?.id).toBe('finding-5');
    expect(latest[1]?.id).toBe('finding-4');
    expect(latest[2]?.id).toBe('finding-3');
  });

  it('saveReport auto-saves findings, proposals and lastRun', () => {
    const store = createMemoryStore();
    const report = makeReport({
      findings: [makeFinding(1), makeFinding(2)],
      proposals: [makeProposal(1, 'proposed')],
    });
    store.saveReport(report);

    expect(store.getLatestFindings(10)).toHaveLength(2);
    expect(store.getProposals(10)).toHaveLength(1);
    const firstAgent = AGENT_IDS[0];
    if (firstAgent) {
      expect(store.getLastRunPerAgent()[firstAgent]).toBe(report.finishedAt);
    }
  });

  it('saveReport does not mutate the caller report', () => {
    const store = createMemoryStore();
    const report = makeReport({
      findings: [makeFinding(1), makeFinding(2)],
      proposals: [makeProposal(1, 'proposed')],
    });
    const snapshot = JSON.stringify(report);

    store.saveReport(report);

    expect(report.findings.length).toBe(2);
    expect(JSON.stringify(report)).toBe(snapshot);
  });

  it('markProposal enforces status transitions', () => {
    const store = createMemoryStore();
    store.saveProposals([
      makeProposal(1, 'proposed'),
      makeProposal(2, 'proposed'),
      makeProposal(3, 'rejected'),
    ]);

    const approved = store.markProposal('proposal-1', 'approved');
    expect(approved?.status).toBe('approved');

    const applied = store.markProposal('proposal-1', 'applied');
    expect(applied?.status).toBe('applied');

    expect(store.markProposal('proposal-2', 'applied')).toBeNull();
    expect(store.markProposal('proposal-3', 'approved')).toBeNull();
    expect(store.markProposal('unknown-id', 'approved')).toBeNull();
  });

  it('getters return copies', () => {
    const store = createMemoryStore();
    store.saveFindings([makeFinding(1), makeFinding(2)]);

    const first = store.getLatestFindings(10);
    first.push(makeFinding(99));

    expect(store.getLatestFindings(10)).toHaveLength(2);
  });

  it('getProposal returns the proposal or null', () => {
    const store = createMemoryStore();
    store.saveProposals([makeProposal(1, 'proposed')]);

    expect(store.getProposal('proposal-1')?.id).toBe('proposal-1');
    expect(store.getProposal('missing')).toBeNull();
  });
});

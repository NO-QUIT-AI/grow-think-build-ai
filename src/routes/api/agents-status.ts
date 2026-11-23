/**
 * NO QUIT AI — read-only status/health route for the nightly agent system.
 *
 * Endpoint (file-based route: /api/agents-status):
 *   GET — status + health + schedule + counts + top proposals + last report.
 *         No auth (read-only). No secrets are ever returned.
 *
 * Env vars USED (presence only, values never returned):
 *   OPENROUTER_API_KEY  — presence reported in health.providersConfigured.openrouter
 *   DEEPSEEK_API_KEY    — presence reported in health.providersConfigured.deepseek
 *   CRON_SECRET         — presence reported in health.providersConfigured.cronSecret
 *
 * Design rules:
 * - Never throws out of a handler; always returns JSON + a status code.
 * - Only logs { route, status }; never logs secrets or payloads.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 */

import { createFileRoute } from "@tanstack/react-router";

import { describeSchedule } from "../../lib/agents/scheduler";
import { getAgentStore } from "../../lib/agents/store";
import { agentConfig } from "../../lib/agents/config";
import { describeProposal } from "../../lib/agents/crosstalk";
import { AGENT_IDS, isAgentId } from "../../lib/agents/types";
import type { AgentStore } from "../../lib/agents/store";
import type {
  AgentFinding,
  AgentId,
  AgentProposal,
  AgentProviderStatus,
  NightlyReport,
  ProposalStatus,
} from "../../lib/agents/types";

const ROUTE = "/api/agents-status";
const STALE_THRESHOLD_HOURS = 36;
const HOUR_MS = 60 * 60 * 1000;
const TOP_PROPOSALS_LIMIT = 5;
const FINDINGS_SCAN_LIMIT = 500;
const PROPOSALS_SCAN_LIMIT = 200;
const REPORTS_SCAN_LIMIT = 30;

/* -------------------------------------------------------------------------- */
/* Small safe helpers                                                          */
/* -------------------------------------------------------------------------- */

function safeLog(status: number): void {
  try {
    console.log({ route: ROUTE, status });
  } catch {
    // never throw from logging
  }
}

function noStoreHeaders(): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
}

function jsonResponse(payload: unknown, status: number): Response {
  try {
    return new Response(JSON.stringify(payload), {
      status,
      headers: noStoreHeaders(),
    });
  } catch {
    try {
      return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
        status: 500,
        headers: noStoreHeaders(),
      });
    } catch {
      return new Response(null, { status: 500 });
    }
  }
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readIsoOrNull(value: unknown): string | null {
  try {
    if (typeof value !== "string" || value.trim().length === 0) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? value : null;
  } catch {
    return null;
  }
}

/** Presence-only env check. Never returns the actual value. */
function isEnvConfigured(name: string): boolean {
  try {
    const raw = process.env[name];
    return typeof raw === "string" && raw.trim().length > 0;
  } catch {
    return false;
  }
}

function readProviderStatus(report: NightlyReport): Record<AgentId, AgentProviderStatus> {
  const out = {} as Record<AgentId, AgentProviderStatus>;
  for (const id of AGENT_IDS) {
    out[id] = "offline";
  }
  try {
    const raw = report.providerStatus;
    if (!raw || typeof raw !== "object") return out;
    for (const id of AGENT_IDS) {
      const value = (raw as Record<string, unknown>)[id];
      out[id] = value === "ok" ? "ok" : "offline";
    }
  } catch {
    // keep defaults
  }
  return out;
}

function findingsOfReport(report: NightlyReport): AgentFinding[] {
  try {
    return Array.isArray(report.findings)
      ? report.findings.filter((f): f is AgentFinding => !!f && typeof f === "object" && isAgentId((f as AgentFinding).agent))
      : [];
  } catch {
    return [];
  }
}

function countFindingsPerAgent(findings: AgentFinding[]): Record<AgentId, number> {
  const out = {} as Record<AgentId, number>;
  for (const id of AGENT_IDS) {
    out[id] = 0;
  }
  try {
    for (const finding of findings) {
      const id = finding.agent;
      if (isAgentId(id)) out[id] += 1;
    }
  } catch {
    // keep partial counts
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Schedule                                                                   */
/* -------------------------------------------------------------------------- */

type ScheduleShape = ReturnType<typeof describeSchedule>;

function safeSchedule(): ScheduleShape {
  try {
    return describeSchedule();
  } catch {
    const lastRunPerAgent = {} as Record<AgentId, string | null>;
    for (const id of AGENT_IDS) {
      lastRunPerAgent[id] = null;
    }
    return {
      nextRunIso: "1970-01-01T00:00:00.000Z",
      msUntilNextRun: 0,
      lastRunPerAgent,
      timezone: "Asia/Dubai",
      hour: 3,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

type HealthStatus = "healthy" | "degraded" | "idle";

type LastRunStatus = "ok" | "offline" | null;

type Health = {
  status: HealthStatus;
  providersConfigured: {
    openrouter: boolean;
    deepseek: boolean;
    cronSecret: boolean;
  };
  lastRunStatus: LastRunStatus;
  staleHours: number | null;
};

function computeLastRunStatus(providerStatus: Record<AgentId, AgentProviderStatus>): LastRunStatus {
  try {
    for (const id of AGENT_IDS) {
      if (providerStatus[id] === "ok") return "ok";
    }
    return "offline";
  } catch {
    return "offline";
  }
}

function computeStaleHours(finishedAt: string | null, nowMs: number): number | null {
  try {
    if (finishedAt === null) return null;
    const finishedMs = new Date(finishedAt).getTime();
    if (!Number.isFinite(finishedMs)) return null;
    const diff = nowMs - finishedMs;
    if (!Number.isFinite(diff)) return null;
    return Math.max(0, Math.round((diff / HOUR_MS) * 100) / 100);
  } catch {
    return null;
  }
}

function computeHealth(
  latestReport: NightlyReport | null,
  providerStatus: Record<AgentId, AgentProviderStatus>,
  nowMs: number
): Health {
  const openrouter = isEnvConfigured("OPENROUTER_API_KEY");
  const deepseek = isEnvConfigured("DEEPSEEK_API_KEY");
  const cronSecret = isEnvConfigured("CRON_SECRET");

  let lastRunStatus: LastRunStatus = null;
  let staleHours: number | null = null;

  if (latestReport !== null) {
    lastRunStatus = computeLastRunStatus(providerStatus);
    staleHours = computeStaleHours(readIsoOrNull(latestReport.finishedAt), nowMs);
  }

  let status: HealthStatus;
  if (latestReport === null) {
    status = "idle";
  } else if (
    lastRunStatus === "offline" ||
    (staleHours !== null && staleHours > STALE_THRESHOLD_HOURS) ||
    (!openrouter && !deepseek)
  ) {
    status = "degraded";
  } else {
    status = "healthy";
  }

  return {
    status,
    providersConfigured: { openrouter, deepseek, cronSecret },
    lastRunStatus,
    staleHours,
  };
}

/* -------------------------------------------------------------------------- */
/* Agents                                                                     */
/* -------------------------------------------------------------------------- */

function emptyLastRunPerAgent(): Record<AgentId, string | null> {
  const out = {} as Record<AgentId, string | null>;
  for (const id of AGENT_IDS) {
    out[id] = null;
  }
  return out;
}

function safeMission(id: AgentId): string {
  try {
    return agentConfig(id).mission;
  } catch {
    return "";
  }
}

function safeName(id: AgentId): string {
  try {
    return agentConfig(id).name;
  } catch {
    return id;
  }
}

function sumFindings(findings: readonly AgentFinding[]): number {
  return Array.isArray(findings) ? findings.length : 0;
}

type AgentStatus = "ok" | "offline" | "never";

type AgentStatusEntry = {
  id: AgentId;
  name: string;
  mission: string;
  lastRun: string | null;
  status: AgentStatus;
  findingsLastRun: number;
  provider: string | null;
};

function computeAgents(
  latestReport: NightlyReport | null,
  providerStatus: Record<AgentId, AgentProviderStatus>,
  schedule: ScheduleShape
): AgentStatusEntry[] {
  const findingsCounts = latestReport
    ? countFindingsPerAgent(findingsOfReport(latestReport))
    : countFindingsPerAgent([]);

  const lastRunPerAgent = latestReport ? schedule.lastRunPerAgent : emptyLastRunPerAgent();

  const out: AgentStatusEntry[] = [];
  for (const id of AGENT_IDS) {
    const lastRun = readIsoOrNull(lastRunPerAgent[id]) ?? null;
    const providerOk = providerStatus[id] === "ok";

    // Per-agent provider: 'configured' when this agent succeeded in the latest
    // report, otherwise null. Provider name is not tracked per-agent upstream.
    const provider = providerOk ? "configured" : null;

    let status: AgentStatus;
    if (lastRun === null) {
      status = "never";
    } else if (providerOk) {
      status = "ok";
    } else {
      status = "offline";
    }

    out.push({
      id,
      name: safeName(id),
      mission: safeMission(id),
      lastRun,
      status,
      findingsLastRun: findingsCounts[id] ?? 0,
      provider,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Counts                                                                     */
/* -------------------------------------------------------------------------- */

type Counts = {
  findings: number;
  proposals: number;
  reports: number;
  crosstalkMessages: number;
};

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function computeCounts(store: AgentStore, latestReport: NightlyReport | null): Counts {
  let findings = 0;
  let proposals = 0;
  let reports = 0;

  try {
    findings = sumFindings(store.getLatestFindings(FINDINGS_SCAN_LIMIT));
  } catch {
    findings = 0;
  }

  try {
    proposals = safeArray(store.getProposals(PROPOSALS_SCAN_LIMIT)).length;
  } catch {
    proposals = 0;
  }

  try {
    reports = safeArray(store.getReports(REPORTS_SCAN_LIMIT)).length;
  } catch {
    reports = 0;
  }

  let crosstalkMessages = 0;
  try {
    crosstalkMessages = latestReport ? safeArray(latestReport.crosstalk).length : 0;
  } catch {
    crosstalkMessages = 0;
  }

  return { findings, proposals, reports, crosstalkMessages };
}

/* -------------------------------------------------------------------------- */
/* Top proposals                                                              */
/* -------------------------------------------------------------------------- */

const TOP_PROPOSAL_STATUSES: ReadonlySet<ProposalStatus> = new Set<ProposalStatus>([
  "proposed",
  "awaiting_approval",
]);

type TopProposal = {
  id: string;
  title: string;
  oneLiner: string;
  impact: number;
  effort: string;
  risk: string;
  status: ProposalStatus;
  agents: AgentId[];
  createdAt: string;
};

function safeProposals(store: AgentStore): AgentProposal[] {
  try {
    const list = store.getProposals(PROPOSALS_SCAN_LIMIT);
    if (!Array.isArray(list)) return [];
    return list.filter((p): p is AgentProposal => !!p && typeof p === "object");
  } catch {
    return [];
  }
}

function impactOf(p: AgentProposal): number {
  return typeof p.impact === "number" && Number.isFinite(p.impact) ? p.impact : 0;
}

function createdAtOf(p: AgentProposal): string {
  return readOptionalString(p.createdAt) ?? "";
}

function compareProposals(a: AgentProposal, b: AgentProposal): number {
  const impactDiff = impactOf(b) - impactOf(a);
  if (impactDiff !== 0) return impactDiff;
  const ta = createdAtOf(a);
  const tb = createdAtOf(b);
  if (ta === tb) return 0;
  return ta < tb ? 1 : -1;
}

function computeTopProposals(store: AgentStore): TopProposal[] {
  try {
    const candidates = safeProposals(store).filter((p) => TOP_PROPOSAL_STATUSES.has(p.status));
    candidates.sort(compareProposals);

    const top = candidates.slice(0, TOP_PROPOSALS_LIMIT);
    return top.map((p) => {
      let oneLiner = "";
      try {
        oneLiner = describeProposal(p);
      } catch {
        oneLiner = "";
      }

      const agents: AgentId[] = Array.isArray(p.agents)
        ? p.agents.filter((a): a is AgentId => isAgentId(a))
        : [];

      return {
        id: readOptionalString(p.id) ?? "",
        title: readOptionalString(p.title) ?? "",
        oneLiner,
        impact: impactOf(p),
        effort: typeof p.effort === "string" ? p.effort : "medium",
        risk: typeof p.risk === "string" ? p.risk : "medium",
        status: p.status,
        agents,
        createdAt: createdAtOf(p),
      };
    });
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Last report summary                                                        */
/* -------------------------------------------------------------------------- */

type LastReportSummary = {
  id: string;
  startedAt: string;
  finishedAt: string;
  timezone: string;
  findingsCount: number;
  proposalsCount: number;
  crosstalkCount: number;
  providerStatus: Record<AgentId, AgentProviderStatus>;
};

function summarizeLastReport(report: NightlyReport | null): LastReportSummary | null {
  if (report === null) return null;
  try {
    return {
      id: readOptionalString(report.id) ?? "",
      startedAt: readOptionalString(report.startedAt) ?? "",
      finishedAt: readOptionalString(report.finishedAt) ?? "",
      timezone: readOptionalString(report.timezone) ?? "",
      findingsCount: findingsOfReport(report).length,
      proposalsCount: safeArray(report.proposals).length,
      crosstalkCount: safeArray(report.crosstalk).length,
      providerStatus: readProviderStatus(report),
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

export const Route = createFileRoute("/api/agents-status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const nowMs = Date.now();
          const generatedAt = new Date(nowMs).toISOString();

          const store = getAgentStore();

          let latestReport: NightlyReport | null = null;
          try {
            const r = store.getLatestReport();
            latestReport = r && typeof r === "object" ? r : null;
          } catch {
            latestReport = null;
          }

          const providerStatus = latestReport ? readProviderStatus(latestReport) : readProviderStatus({} as NightlyReport);
          const schedule = safeSchedule();
          const health = computeHealth(latestReport, providerStatus, nowMs);
          const agents = computeAgents(latestReport, providerStatus, schedule);
          const counts = computeCounts(store, latestReport);
          const topProposals = computeTopProposals(store);
          const lastReport = summarizeLastReport(latestReport);

          safeLog(200);
          return jsonResponse(
            {
              ok: true,
              generatedAt,
              schedule,
              health,
              agents,
              counts,
              topProposals,
              lastReport,
            },
            200
          );
        } catch {
          safeLog(500);
          return jsonResponse({ ok: false, error: "Failed to read agent status" }, 500);
        }
      },
    },
  },
});

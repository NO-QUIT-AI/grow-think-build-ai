/**
 * NO QUIT AI — nightly agent system API route.
 *
 * Endpoints (file-based route: /api/agents-nightly):
 *   GET  — read-only schedule + latest/recent reports + counts (no auth).
 *   POST — triggers a nightly run. Protected by CRON_SECRET.
 *
 * Env vars:
 *   OPENROUTER_API_KEY  — used by the agent pipeline (downstream).
 *   DEEPSEEK_API_KEY    — used by the agent pipeline (downstream).
 *   CRON_SECRET         — REQUIRED for POST; if unset, POST returns 503.
 *
 * Design rules:
 * - Never throws out of a handler; always returns JSON + a status code.
 * - Never logs secrets; only { route, status, reportId } is logged.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 */

import { createFileRoute } from "@tanstack/react-router";

import { describeSchedule, runNightlyOnce } from "../lib/agents/scheduler";
import { getAgentStore } from "../lib/agents/store";
import type { NightlyReport } from "../lib/agents/types";

const ROUTE = "/api/agents-nightly";
const MAX_ROUNDS_OPTION = 6;

function safeLog(status: number, reportId: string | null): void {
  try {
    console.log({ route: ROUTE, status, reportId });
  } catch {
    // never throw from logging
  }
}

function jsonResponse(payload: unknown, status: number): Response {
  try {
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    try {
      return new Response('{"ok":false,"error":"Internal error"}', {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch {
      // Last resort — should be unreachable.
      return new Response(null, { status: 500 });
    }
  }
}

function readCronSecret(): string | null {
  try {
    const raw = process.env["CRON_SECRET"];
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Constant-time-ish string comparison. Lengths are normalised by comparing
 * digests of equal length, and the loop never short-circuits on mismatch.
 */
function timingSafeEqual(a: string, b: string): boolean {
  try {
    const maxLen = Math.max(a.length, b.length, 1);
    let diff = a.length ^ b.length;
    for (let i = 0; i < maxLen; i += 1) {
      const ca = i < a.length ? a.charCodeAt(i) : 0;
      const cb = i < b.length ? b.charCodeAt(i) : 0;
      diff |= ca ^ cb;
    }
    return diff === 0;
  } catch {
    return false;
  }
}

function extractProvidedSecret(request: Request): string | null {
  try {
    const headerSecret = request.headers.get("x-cron-secret");
    if (typeof headerSecret === "string" && headerSecret.trim().length > 0) {
      return headerSecret.trim();
    }
    const auth = request.headers.get("authorization");
    if (typeof auth === "string") {
      const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
      const token = match?.[1];
      if (typeof token === "string" && token.trim().length > 0) {
        return token.trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

function parseForceFlag(value: unknown): boolean {
  try {
    if (value === true) return true;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      return v === "true" || v === "1" || v === "yes";
    }
    return false;
  } catch {
    return false;
  }
}

function parseRounds(value: unknown): number | undefined {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim().length > 0
          ? Number(value)
          : NaN;
    if (!Number.isFinite(numeric)) return undefined;
    const floored = Math.floor(numeric);
    if (floored < 1) return undefined;
    return floored > MAX_ROUNDS_OPTION ? MAX_ROUNDS_OPTION : floored;
  } catch {
    return undefined;
  }
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summarizeReport(report: NightlyReport): {
  id: string;
  startedAt: string;
  finishedAt: string;
  timezone: string;
  agentCount: number;
  findingsCount: number;
  crosstalkCount: number;
  proposalsCount: number;
  providerStatus: NightlyReport["providerStatus"];
  notes: string[];
} {
  return {
    id: readOptionalString(report.id) ?? "",
    startedAt: readOptionalString(report.startedAt) ?? "",
    finishedAt: readOptionalString(report.finishedAt) ?? "",
    timezone: readOptionalString(report.timezone) ?? "",
    agentCount: Array.isArray(report.agents) ? report.agents.length : 0,
    findingsCount: Array.isArray(report.findings) ? report.findings.length : 0,
    crosstalkCount: Array.isArray(report.crosstalk) ? report.crosstalk.length : 0,
    proposalsCount: Array.isArray(report.proposals) ? report.proposals.length : 0,
    providerStatus: report.providerStatus ?? {},
    notes: Array.isArray(report.notes)
      ? report.notes.filter((n): n is string => typeof n === "string")
      : [],
  };
}

export const Route = createFileRoute("/api/agents-nightly")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const store = getAgentStore();

          let schedule: ReturnType<typeof describeSchedule>;
          try {
            schedule = describeSchedule();
          } catch {
            schedule = describeSchedule(new Date(0));
          }

          let latestReport: ReturnType<typeof summarizeReport> | null = null;
          try {
            const report = store.getLatestReport();
            latestReport = report && typeof report === "object" ? summarizeReport(report) : null;
          } catch {
            latestReport = null;
          }

          let recentReports: ReturnType<typeof summarizeReport>[] = [];
          try {
            const reports = store.getReports(5);
            recentReports = Array.isArray(reports)
              ? reports
                  .filter((r): r is NightlyReport => !!r && typeof r === "object")
                  .map((r) => summarizeReport(r))
              : [];
          } catch {
            recentReports = [];
          }

          let findingsCount = 0;
          try {
            const findings = store.getLatestFindings(500);
            findingsCount = Array.isArray(findings) ? findings.length : 0;
          } catch {
            findingsCount = 0;
          }

          let proposalsCount = 0;
          try {
            const proposals = store.getProposals(200);
            proposalsCount = Array.isArray(proposals) ? proposals.length : 0;
          } catch {
            proposalsCount = 0;
          }

          safeLog(200, latestReport?.id ?? null);
          return jsonResponse(
            {
              ok: true,
              schedule,
              latestReport,
              recentReports,
              counts: { findings: findingsCount, proposals: proposalsCount },
            },
            200
          );
        } catch {
          safeLog(500, null);
          return jsonResponse({ ok: false, error: "Failed to read agent store" }, 500);
        }
      },

      POST: async ({ request }) => {
        try {
          const secret = readCronSecret();
          if (secret === null) {
            safeLog(503, null);
            return jsonResponse({ ok: false, error: "CRON_SECRET not configured" }, 503);
          }

          const provided = extractProvidedSecret(request);
          if (provided === null || !timingSafeEqual(provided, secret)) {
            safeLog(401, null);
            return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
          }

          // Query/body option parsing: force + rounds.
          let force = false;
          let rounds: number | undefined;
          try {
            const url = new URL(request.url);
            force = parseForceFlag(url.searchParams.get("force"));
            rounds = parseRounds(url.searchParams.get("rounds"));
          } catch {
            force = false;
            rounds = undefined;
          }

          try {
            const body = (await request.json()) as unknown;
            if (body && typeof body === "object") {
              const rec = body as Record<string, unknown>;
              if (parseForceFlag(rec["force"])) force = true;
              const bodyRounds = parseRounds(rec["rounds"]);
              if (bodyRounds !== undefined) rounds = bodyRounds;
            }
          } catch {
            // No/invalid body — query params (or defaults) win.
          }

          const store = getAgentStore();
          const summary = await runNightlyOnce(
            store,
            rounds === undefined ? { force } : { force, rounds }
          );

          const status = summary.ok ? 200 : 500;
          safeLog(status, summary.reportId);
          return jsonResponse(summary, status);
        } catch {
          safeLog(500, null);
          return jsonResponse({ ok: false, error: "Nightly run failed unexpectedly." }, 500);
        }
      },
    },
  },
});

// Keep helper referenced to avoid unused-code lint noise where applicable.
void readNumber;

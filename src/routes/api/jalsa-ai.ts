import { createFileRoute } from '@tanstack/react-router';

import {
  loadProfile,
  rememberFact,
  buildMemorySystemPrompt,
  type PersonalProfile,
} from '../../lib/ai/memory';
import {
  routeChat,
  stripReplyPrefix,
  type ChatMessage,
} from '../../lib/ai/router';
import {
  detectTool,
  runTool,
  type AgenticResult,
} from '../../lib/ai/tools';
import {
  proactiveBrief,
  buildDailyBrief,
  type DailyBrief,
  type PendingTask,
} from '../../lib/ai/proactive';

type Provider = 'ollama' | 'deepseek' | 'local' | 'offline';

type Body = {
  messages?: unknown;
  userName?: unknown;
  userCity?: unknown;
  userWork?: unknown;
  pendingTasks?: unknown;
  brief?: unknown;
};

const MAX_MESSAGES = 20;
const PROACTIVE_PATTERN = /\b(aaj|today|brief|kya hai|status|pending)\b/i;

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v['role'] === 'user' || v['role'] === 'assistant' || v['role'] === 'system') &&
    typeof v['content'] === 'string'
  );
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readPendingTasks(value: unknown): PendingTask[] {
  if (!Array.isArray(value)) return [];
  const out: PendingTask[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    const label = typeof v['label'] === 'string' ? v['label'].trim() : '';
    if (label.length === 0) continue;
    const task: PendingTask = { label };
    if (v['done'] === true) task.done = true;
    out.push(task);
  }
  return out;
}

function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.role === 'user') return m.content;
  }
  return '';
}

function formatWeatherLine(brief: DailyBrief): string {
  const w = brief.weather;
  const temp = typeof w.tempC === 'number' ? ` (${w.tempC}°C)` : '';
  if (w.source === 'unavailable') {
    return `Mausam: ${w.summary} — ${brief.city}`;
  }
  return `Mausam: ${w.summary}${temp} — ${brief.city}`;
}

/** Formats the daily brief as short readable lines. */
export function formatBrief(brief: DailyBrief): string {
  const lines: string[] = [];
  lines.push(brief.greeting);
  lines.push(`${brief.datePretty}${brief.hijriNote ? ` · ${brief.hijriNote}` : ''}`);
  lines.push(formatWeatherLine(brief));

  const tasks = brief.pendingTasks.slice(0, 5);
  if (tasks.length === 0) {
    lines.push('Pending: koi pending task nahi — aaj clear hai.');
  } else {
    lines.push('Pending tasks:');
    for (let i = 0; i < tasks.length; i += 1) {
      const label = tasks[i];
      if (label !== undefined) lines.push(`${i + 1}. ${label}`);
    }
  }

  if (brief.suggestions.length > 0) {
    lines.push('Suggestions:');
    for (const s of brief.suggestions.slice(0, 3)) lines.push(`- ${s}`);
  }
  return lines.join('\n');
}

/**
 * Builds a compact, client-renderable block describing the tool output.
 * Returns undefined when there is nothing useful to attach.
 */
function compactToolResult(result: AgenticResult): Record<string, unknown> | undefined {
  if (!result.ok || !result.data) {
    return undefined;
  }
  const data = result.data;
  switch (result.tool) {
    case 'make_poster': {
      const d = data as { title: string; subtitle?: string; bullets: string[]; palette: unknown; aspect: string };
      return {
        tool: result.tool,
        poster: {
          title: d.title,
          subtitle: d.subtitle ?? '',
          bullets: d.bullets,
          palette: d.palette,
          aspect: d.aspect,
        },
      };
    }
    case 'make_summary': {
      const d = data as { summary: string; keyPoints: string[] };
      return {
        tool: result.tool,
        summary: { text: d.summary, keyPoints: d.keyPoints },
      };
    }
    case 'make_list': {
      const d = data as { title: string; items: string[] };
      return {
        tool: result.tool,
        list: { title: d.title, items: d.items },
      };
    }
    case 'make_checklist': {
      const d = data as { title: string; tasks: Array<{ label: string; done: boolean }> };
      return {
        tool: result.tool,
        checklist: { title: d.title, tasks: d.tasks },
      };
    }
    default:
      return undefined;
  }
}

/** Deterministic offline reply that references the tool output. */
function offlineToolReply(result: AgenticResult): string {
  switch (result.tool) {
    case 'make_poster':
      return 'Poster ready — title aur bullets tool card mein upar hain. Batayein aspect change karun? (offline reply)'.replace(
        'Aspect ready',
        'Aspect ready',
      );
    case 'make_summary':
      return 'Summary aur key points tool card mein hain — chahiye to aur detail add kar dun. (offline reply)';
    case 'make_list':
      return 'List ready hai — tool card mein items dekhein. Aur kuch add karun? (offline reply)';
    case 'make_checklist':
      return 'Checklist taiyar hai — tool card se tick karein. Kuch item add ya hata dun? (offline reply)';
    default:
      return 'Tool chal gaya — result card mein hai. (offline reply)';
  }
}

/** Deterministic offline brief reply text. */
function offlineBriefReply(brief: DailyBrief): string {
  return `${formatBrief(brief)}\n\n(Offline brief — providers down hain, but aapka brief local se ready hai.)`;
}

export const Route = createFileRoute('/api/jalsa-ai')({
  server: {
    handlers: {
      POST: async ({ request }): Promise<Response> => {
        try {
          const raw = (await request.json()) as Body | null;
          const body: Body = raw !== null && typeof raw === 'object' ? raw : {};

          const incoming = Array.isArray(body.messages)
            ? body.messages.filter(isChatMessage)
            : [];
          const messages = incoming.slice(-MAX_MESSAGES);

          // ---- Profile & memory merge ----
          const storedProfile = await loadProfile();
          const hints: PersonalProfile = {};
          const name = readTrimmedString(body.userName);
          const city = readTrimmedString(body.userCity);
          const work = readTrimmedString(body.userWork);

          let profile: PersonalProfile = { ...storedProfile };
          if (name !== undefined) {
            profile.name = name;
            await rememberFact('name', name);
          }
          if (city !== undefined) {
            profile.city = city;
            await rememberFact('city', city);
          }
          if (work !== undefined) {
            profile.work = work;
            await rememberFact('work', work);
          }
          // include hints so future merges stay consistent (hints used only after set)
          void hints;

          const pendingTasks = readPendingTasks(body.pendingTasks);
          const lastUser = lastUserMessage(messages);

          const wantsBrief =
            body.brief === true ||
            lastUser.trim().length === 0 ||
            PROACTIVE_PATTERN.test(lastUser);

          // ---- Proactive daily brief ----
          if (wantsBrief) {
            let brief: DailyBrief;
            try {
              brief = await proactiveBrief({ profile, pendingTasks });
            } catch {
              brief = buildDailyBrief({ profile, pendingTasks });
            }
            return Response.json({
              reply: formatBrief(brief),
              provider: 'local' as Provider,
              proactive: true,
              brief,
            });
          }

          // ---- Agentic tool path ----
          const systemPrompt = buildMemorySystemPrompt(profile);
          const routerMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...messages.filter((m) => m.role !== 'system'),
          ];

          let tool: Record<string, unknown> | undefined;
          const detected = detectTool(lastUser);
          if (detected !== null) {
            const toolResult = runTool(detected, {
              brief: lastUser,
              text: lastUser,
              raw: lastUser,
            });
            tool = compactToolResult(toolResult);

            if (tool !== undefined) {
              // Ask router for a short human reply that references the tool output,
              // but never let the tool path fail if the router is down.
              const toolHint: ChatMessage = {
                role: 'system',
                content:
                  'A tool already ran for the user request. Reply in 1-2 short Roman Urdu sentences referencing the tool output (poster/summary/list/checklist). Do not repeat the whole tool payload.',
              };
              const routed = await routeChat({
                messages: [routerMessages[0]!, ...messages, toolHint],
              });

              if (routed !== null) {
                return Response.json({
                  reply: stripReplyPrefix(routed.reply),
                  provider: routed.provider satisfies Provider,
                  tool,
                });
              }

              return Response.json({
                reply: offlineToolReply(toolResult),
                provider: 'offline' as Provider,
                tool,
              });
            }
          }

          // ---- Plain chat ----
          const routed = await routeChat({ messages: routerMessages });
          if (routed !== null) {
            return Response.json({
              reply: stripReplyPrefix(routed.reply),
              provider: routed.provider satisfies Provider,
            });
          }

          // Both providers down.
          let fallbackBriefText = '';
          try {
            const fallbackBrief = await proactiveBrief({ profile, pendingTasks });
            fallbackBriefText = `\n\nLocal brief:\n${formatBrief(fallbackBrief)}`;
          } catch {
            fallbackBriefText = '';
          }

          return Response.json({
            reply:
              'NO QUIT AI: dono providers abhi down hain (Ollama + DeepSeek). Lekin main yahan hoon — yahan aapka local summary hai.' +
              fallbackBriefText,
            provider: 'offline' as Provider,
          });
        } catch {
          // Never 503 for a valid request shape — return offline guidance with 200.
          return Response.json({
            reply:
              'NO QUIT AI: request parse nahi ho saka. Dobara bhejein — main offline bhi kaam karta hoon.',
            provider: 'offline' as Provider,
          });
        }
      },
    },
  },
});

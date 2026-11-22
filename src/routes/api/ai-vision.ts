import { createFileRoute } from '@tanstack/react-router';

import { routeChat, type ChatMessage } from '../../lib/ai/router';

type Body = {
  imageBase64?: unknown;
  mimeType?: unknown;
  audioBase64?: unknown;
  audioMimeType?: unknown;
  userName?: unknown;
  language?: unknown;
};

const MAX_DECODED_BYTES = 8 * 1024 * 1024;
const VISION_TIMEOUT_MS = 25000;
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_AUDIO_URL = 'https://api.deepseek.com/audio/transcriptions';
const DEEPSEEK_VISION_MODEL = 'deepseek-chat';
const AUDIO_MODEL = 'whisper-1';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
]);

const IMAGE_PROMPT =
  'Photo ko ghor se dekho. (1) Photo mein jo visible text hai usay OCR karo, (2) key details describe karo, aur (3) phir user ke sawaal ka jawab do. Roman Urdu mein jawab do, Urdu-friendly English terms use kar sakte ho. Maximum 6 chhoti lines. Bina zaroorat lambi tafseel na do.';

const OFFLINE_VISION_REPLY =
  'Photo padhne ke liye vision provider available nahi hai. Filhal DeepSeek key ya network issue hai.';

const OFFLINE_AUDIO_REPLY =
  'Voice samajh nahi aayi — transcription provider available nahi hai. Aap type kar ke bhej dein.';

const AUDIO_SYSTEM_PROMPT = 'NO QUIT AI: reply in Roman Urdu, short';

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

function decodedBytes(base64: string): number {
  // Approximate decoded size without allocating the full buffer.
  let padding = 0;
  const len = base64.length;
  if (len === 0) return 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extractDeepSeekText(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = first?.message?.content;
  if (typeof content !== 'string') return undefined;
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractTranscript(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const v = data as { text?: unknown; transcript?: unknown };
  const raw = typeof v.text === 'string' ? v.text : typeof v.transcript === 'string' ? v.transcript : undefined;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function handleImage(imageBase64: string, mimeType: string): Promise<Response> {
  const offline: Response = Response.json({
    ok: false,
    kind: 'image' as const,
    reply: OFFLINE_VISION_REPLY,
    provider: 'offline' as const,
  });

  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return offline;

    const signal = AbortSignal.timeout(VISION_TIMEOUT_MS);
    const res = await fetch(DEEPSEEK_CHAT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: IMAGE_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        stream: false,
      }),
      signal,
    });

    if (!res.ok) return offline;

    const data: unknown = await res.json();
    const reply = extractDeepSeekText(data);
    if (reply === undefined) return offline;

    return Response.json({
      ok: true,
      kind: 'image' as const,
      reply,
      provider: 'deepseek' as const,
    });
  } catch {
    return offline;
  }
}

async function transcribeWithOllama(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ transcript: string; provider: 'ollama' } | null> {
  const url = process.env.OLLAMA_VOICE_URL;
  if (!url) return null;
  try {
    const form = new FormData();
    const blob = new Blob([bytes as BlobPart], { type: mimeType });
    form.append('file', blob, 'audio');
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) return null;
    const data: unknown = await res.json().catch(() => undefined);
    const transcript = extractTranscript(data);
    if (transcript === undefined) return null;
    return { transcript, provider: 'ollama' };
  } catch {
    return null;
  }
}

async function transcribeWithDeepSeek(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ transcript: string; provider: 'deepseek' } | null> {
  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return null;
    const form = new FormData();
    form.append('model', AUDIO_MODEL);
    const blob = new Blob([bytes as BlobPart], { type: mimeType });
    form.append('file', blob, 'audio');
    const res = await fetch(DEEPSEEK_AUDIO_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) return null;
    const data: unknown = await res.json().catch(() => undefined);
    const transcript = extractTranscript(data);
    if (transcript === undefined) return null;
    return { transcript, provider: 'deepseek' };
  } catch {
    return null;
  }
}

async function handleAudio(audioBase64: string, mimeType: string): Promise<Response> {
  const offline: Response = Response.json({
    ok: false,
    kind: 'audio' as const,
    transcript: '',
    reply: OFFLINE_AUDIO_REPLY,
    provider: 'offline' as const,
  });

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(audioBase64);
  } catch {
    return offline;
  }

  const ollama = await transcribeWithOllama(bytes, mimeType);
  const result = ollama ?? (await transcribeWithDeepSeek(bytes, mimeType));
  if (result === null) return offline;

  const messages: ChatMessage[] = [
    { role: 'system', content: AUDIO_SYSTEM_PROMPT },
    { role: 'user', content: result.transcript },
  ];

  const routed = await routeChat({ messages });
  if (routed === null) {
    return Response.json({
      ok: false,
      kind: 'audio' as const,
      transcript: result.transcript,
      reply: OFFLINE_AUDIO_REPLY,
      provider: 'offline' as const,
    });
  }

  return Response.json({
    ok: true,
    kind: 'audio' as const,
    transcript: result.transcript,
    reply: routed.reply,
    provider: routed.provider,
  });
}

export const Route = createFileRoute('/api/ai-vision')({
  server: {
    handlers: {
      POST: async ({ request }): Promise<Response> => {
        let body: Body;
        try {
          const raw: unknown = await request.json();
          body = raw !== null && typeof raw === 'object' ? (raw as Body) : {};
        } catch {
          return badRequest('Invalid JSON body.');
        }

        const imageBase64 = readTrimmedString(body.imageBase64);
        const audioBase64 = readTrimmedString(body.audioBase64);

        if (imageBase64 === undefined && audioBase64 === undefined) {
          return badRequest('Provide either imageBase64 or audioBase64.');
        }

        if (imageBase64 !== undefined && audioBase64 !== undefined) {
          return badRequest('Send only one of imageBase64 or audioBase64 per request.');
        }

        if (imageBase64 !== undefined) {
          const mimeType = readTrimmedString(body.mimeType) ?? 'image/png';
          if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
            return badRequest('Unsupported image type. Allowed: image/png, image/jpeg, image/webp.');
          }
          if (decodedBytes(imageBase64) > MAX_DECODED_BYTES) {
            return badRequest('Image too large. Maximum size is 8 MB.');
          }
          return handleImage(imageBase64, mimeType);
        }

        // audio path
        const audioMimeType = readTrimmedString(body.audioMimeType) ?? 'audio/webm';
        if (!ALLOWED_AUDIO_TYPES.has(audioMimeType)) {
          return badRequest(
            'Unsupported audio type. Allowed: audio/webm, audio/ogg, audio/mp3, audio/mpeg, audio/wav.',
          );
        }
        if (decodedBytes(audioBase64!) > MAX_DECODED_BYTES) {
          return badRequest('Audio too large. Maximum size is 8 MB.');
        }
        return handleAudio(audioBase64!, audioMimeType);
      },
    },
  },
});

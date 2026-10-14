/**
 * getVoiceAudio: ElevenLabs first, Microsoft Edge TTS (free, no key) as fallback.
 * Edge TTS is spoken over its WebSocket protocol directly (npm edge-tts packages are Node-only
 * and break on the Worker runtime).
 */
const DEFAULT_VOICE = "pFZP5JQG7iQjIQuC4Bku";
const EDGE_VOICE = "en-US-GuyNeural";
const MIN_CREDITS = 1000;
const TRUSTED = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

async function elevenCreditsLeft(key: string): Promise<number | null> {
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
    if (!r.ok) return null;
    const j = (await r.json()) as { character_count?: number; character_limit?: number };
    if (typeof j.character_limit !== "number" || typeof j.character_count !== "number") return null;
    return j.character_limit - j.character_count;
  } catch {
    return null;
  }
}

async function elevenLabs(text: string, voiceId: string): Promise<ArrayBuffer> {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("ElevenLabs not configured");
  const left = await elevenCreditsLeft(key);
  if (left !== null && left < MIN_CREDITS) throw new Error(`ElevenLabs credits low (${left})`);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.7, similarity_boost: 0.8, speed: 1.0 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return res.arrayBuffer();
}

async function secMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + 11644473600;
  ticks -= ticks % 300;
  const data = new TextEncoder().encode(`${BigInt(ticks) * 10000000n}${TRUSTED}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");

export async function edgeTts(text: string, voice = EDGE_VOICE): Promise<ArrayBuffer> {
  const id = crypto.randomUUID().replace(/-/g, "");
  const qs = `TrustedClientToken=${TRUSTED}&Sec-MS-GEC=${await secMsGec()}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${id}`;
  const path = `speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${qs}`;
  const headers = {
    Upgrade: "websocket",
    Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  };

  let ws: WebSocket;
  const up = await fetch(`https://${path}`, { headers }).catch(() => null);
  const workerWs = (up as unknown as { webSocket?: WebSocket & { accept(): void } } | null)?.webSocket;
  if (workerWs) {
    workerWs.accept();
    ws = workerWs;
  } else {
    ws = new (WebSocket as unknown as new (u: string, o?: unknown) => WebSocket)(`wss://${path}`, { headers }); // dev fallback
    await new Promise<void>((ok, bad) => {
      ws.addEventListener("open", () => ok());
      ws.addEventListener("error", () => bad(new Error("Edge TTS connect failed")));
    });
  }
  ws.binaryType = "arraybuffer";

  const chunks: Uint8Array[] = [];
  const done = new Promise<void>((ok, bad) => {
    const t = setTimeout(() => bad(new Error("Edge TTS timeout")), 20000);
    ws.addEventListener("message", (e: MessageEvent) => {
      if (typeof e.data === "string") {
        if (e.data.includes("Path:turn.end")) { clearTimeout(t); ok(); }
        return;
      }
      const buf = new Uint8Array(e.data as ArrayBuffer);
      const hlen = (buf[0]! << 8) | buf[1]!;
      const head = new TextDecoder().decode(buf.subarray(2, 2 + hlen));
      if (head.includes("Path:audio")) chunks.push(buf.subarray(2 + hlen));
    });
    ws.addEventListener("close", () => { clearTimeout(t); chunks.length ? ok() : bad(new Error("Edge TTS closed")); });
  });

  const ts = new Date().toString();
  ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
  ws.send(`X-RequestId:${id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${esc(text)}</prosody></voice></speak>`);
  await done;
  try { ws.close(); } catch { /* ignore */ }

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  if (!out.length) throw new Error("Edge TTS returned no audio");
  return out.buffer;
}

export async function getVoiceAudio(text: string, voiceId = DEFAULT_VOICE): Promise<ArrayBuffer> {
  try {
    const audio = await elevenLabs(text, voiceId);
    console.log("Using ElevenLabs");
    return audio;
  } catch (e) {
    console.log("Using Edge TTS Fallback", (e as Error).message);
    return edgeTts(text);
  }
}

import { describe, it, expect, afterEach, mock } from "bun:test";
import { paintingFromSpace, freePaintingSources, PAINTING_SPACE, SPACE_TIMEOUT_MS } from "./free-painting";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
describe("free paintings", () => {
  it("uses public Hugging Face before Pollinations without an API key", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return calls.length === 1
        ? Response.json({ event_id: "job123" })
        : new Response(`event: complete\ndata: [{"url":"${PAINTING_SPACE}/gradio_api/file=painting.webp"},0]\n\n`);
    }) as typeof fetch;
    expect(await paintingFromSpace("mountain painting")).toBe(`${PAINTING_SPACE}/gradio_api/file=painting.webp`);
    expect(calls[0]?.url).toBe(`${PAINTING_SPACE}/gradio_api/call/infer`);
    expect(new Headers(calls[0]?.init?.headers).has("authorization")).toBe(false);
    expect(JSON.parse(String(calls[0]?.init?.body)).data).toEqual(["mountain painting", 0, true, 1024, 1024, 4]);
  });
  it("bounds slow Spaces to 25 seconds", () => {
    expect(SPACE_TIMEOUT_MS).toBe(25000);
  });
  it("reports Space quota errors so the caller can use backup", async () => {
    let count = 0;
    globalThis.fetch = mock(async () => ++count === 1 ? Response.json({ event_id: "job123" }) : new Response('event: error\ndata: "quota"\n\n')) as typeof fetch;
    expect(paintingFromSpace("painting")).rejects.toThrow("Free Space busy or quota exhausted");
  });
  it("provides only anonymous Pollinations Flux and Turbo backups", () => {
    const urls = freePaintingSources("red & blue painting");
    expect(urls.length).toBe(2);
    expect(new URL(urls[0] ?? "").searchParams.get("model")).toBe("flux");
    expect(new URL(urls[1] ?? "").searchParams.get("model")).toBe("turbo");
    expect(urls.every(url => new URL(url).origin === "https://image.pollinations.ai")).toBe(true);
  });
});
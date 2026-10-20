import type { StockClip } from "./auto-video";

type PixabayHit = { pageURL?: string; user?: string; videos?: { large?: { url?: string; thumbnail?: string } } };

export async function fetchPixabayClips(key: string, keyword: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<StockClip[]> {
  const url = new URL("https://pixabay.com/api/videos/");
  url.search = new URLSearchParams({ key, q: keyword.trim().slice(0, 100) || "nature", per_page: "3" }).toString();
  try {
    const response = await fetcher(url, { signal: signal ?? AbortSignal.timeout(15000) });
    if (!response.ok) return [];
    const data = await response.json() as { hits?: PixabayHit[] };
    if (!Array.isArray(data.hits)) return [];
    return data.hits.slice(0, 3).flatMap(hit => {
      const video = hit.videos?.large;
      if (!video?.url?.startsWith("https://")) return [];
      return [{ url: video.url, thumbnail: video.thumbnail ?? "", page: hit.pageURL ?? "https://pixabay.com/videos/", author: hit.user ?? "Pixabay" }];
    });
  } catch {
    if (signal?.aborted) throw new Error("Render cancel ho gaya");
    return [];
  }
}
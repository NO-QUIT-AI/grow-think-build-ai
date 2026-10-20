// @ts-nocheck
import { expect, test } from "bun:test";
import { fetchPixabayClips } from "./pixabay-stock";

test("Pixabay requests three videos and selects the large URL", async () => {
  let requested;
  const clips = await fetchPixabayClips("test-key", "young man", undefined, async url => {
    requested = new URL(url);
    return Response.json({ hits: [{ user: "Creator", pageURL: "https://pixabay.com/videos/example", videos: { large: { url: "https://cdn.pixabay.com/large.mp4", thumbnail: "https://cdn.pixabay.com/thumb.jpg" }, small: { url: "https://cdn.pixabay.com/small.mp4" } } }] });
  });
  expect(requested.origin + requested.pathname).toBe("https://pixabay.com/api/videos/");
  expect(requested.searchParams.get("per_page")).toBe("3");
  expect(requested.searchParams.get("q")).toBe("young man");
  expect(clips[0].url).toBe("https://cdn.pixabay.com/large.mp4");
});
test("failed Pixabay requests leave no clips for offline captions-only export", async () => {
  expect(await fetchPixabayClips("test-key", "story", undefined, async () => new Response("Unavailable", { status: 429 }))).toEqual([]);
  expect(await fetchPixabayClips("test-key", "story", undefined, async () => { throw new Error("offline"); })).toEqual([]);
});
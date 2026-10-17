export type StoryScene = { id: number; text: string; voiceover_text: string; search_keyword: string };
export type StockClip = { url: string; thumbnail: string; page: string; author: string };
export type VideoScene = StoryScene & { clip?: StockClip; localClip?: File; duration?: number };

const KEYWORDS: [RegExp, string][] = [
  [/gareeb|poor|poverty/i, "city street"], [/ameer|rich|success/i, "business success"],
  [/ladka|boy|man/i, "young man"], [/ladki|girl|woman/i, "young woman"],
  [/school|study|parhai/i, "student studying"], [/mehnat|work|kaam/i, "working"],
  [/family|maa|mother/i, "family"], [/travel|safar/i, "travel"],
];

export function searchKeyword(text: string): string {
  return KEYWORDS.find(([pattern]) => pattern.test(text))?.[1] ?? (text.replace(/[^a-zA-Z\s]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ") || "nature");
}

/** Keeps the user's words in order; short stories are spread across five scenes, never invented. */
export function splitStory(story: string): StoryScene[] {
  const clean = story.trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?۔\n]+[.!?۔]?/g)?.map(s => s.trim()).filter(Boolean) ?? [clean];
  const count = sentences.length >= 6 ? 6 : 5;
  const units = sentences.length >= count ? sentences : clean.split(/\s+/);
  return Array.from({ length: count }, (_, index) => {
    const from = Math.floor(index * units.length / count);
    const to = Math.floor((index + 1) * units.length / count);
    const text = units.slice(from, to).join(" ");
    return { id: index + 1, text, voiceover_text: text, search_keyword: searchKeyword(text) };
  });
}

export function captionWordAt(text: string, time: number, duration: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length ? Math.min(words.length - 1, Math.max(0, Math.floor(time / duration * words.length))) : -1;
}
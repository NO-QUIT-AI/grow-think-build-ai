export const MAX_TRANSCRIPT = 200;

/** Merge a new final chunk without duplicating (mobile Chrome re-sends cumulative text). */
export function mergeFinal(prev: string, chunk: string): string {
  const p = prev.trim();
  const c = chunk.trim();
  if (!c) return p;
  if (!p) return c;
  const pl = p.toLowerCase();
  const cl = c.toLowerCase();
  if (cl.startsWith(pl) || cl.includes(pl)) return c;
  if (pl.endsWith(cl) || pl.includes(cl)) return p;
  return `${p} ${c}`;
}

/** Remove back-to-back repeated phrases/words and cap length. */
export function cleanTranscript(text: string): string {
  let words = text.trim().split(/\s+/).filter(Boolean);
  // collapse repeated phrase blocks (longest first)
  for (let size = Math.floor(words.length / 2); size >= 1; size -= 1) {
    let i = 0;
    const out: string[] = [];
    while (i < words.length) {
      const a = words.slice(i, i + size).join(" ").toLowerCase();
      const b = words.slice(i + size, i + size * 2).join(" ").toLowerCase();
      if (size > 0 && a && a === b) {
        i += size; // skip the duplicate copy
        continue;
      }
      out.push(words[i] ?? "");
      i += 1;
    }
    words = out;
  }
  return words.join(" ").slice(0, MAX_TRANSCRIPT).trim();
}

const EN_WORDS = new Set("i you he she it we they me my your is am are was were be have has do does did what how why when where who hello hi hey good great fine thanks thank please the a an and or but to of in on for with this that yes no okay ok bro man doing going today now tell can will would want know like love".split(" "));

const HINDI_ROMAN = new Set("kya hai hain bhai yaar yar mast acha achha accha batao bata suno kahan kaise kaisa haal theek thik nahi nahin haan main mera meri tum tera teri aap kar karo raha rahi hoon ho tha thi aaj kal abhi kuch sab bas chal arre arey dekho matlab samjha".split(" "));

/** "en" jab 60%+ lafz English hon aur koi Roman Hindi lafz na ho, warna "hi". */
export function detectSpeechLang(text: string): "en" | "hi" {
  if (/[\u0900-\u097F\u0600-\u06FF]/.test(text)) return "hi";
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const latin = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (!tokens.length || !latin.length) return "hi";
  const hasHindi = latin.some((w) => HINDI_ROMAN.has(w));
  return latin.length / tokens.length > 0.6 && !hasHindi ? "en" : "hi";
}

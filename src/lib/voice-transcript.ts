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
      out.push(words[i]);
      i += 1;
    }
    words = out;
  }
  return words.join(" ").slice(0, MAX_TRANSCRIPT).trim();
}

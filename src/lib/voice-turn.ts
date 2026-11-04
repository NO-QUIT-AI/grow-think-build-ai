export const SILENCE_MS = 1500;
export const VOICE_THRESHOLD = 0.035;
export const VOICE_AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as const;
export type VoicePhase = "connecting" | "listening" | "thinking" | "speaking";
export function micAllowed(phase: VoicePhase, muted: boolean) { return phase === "listening" && !muted; }
export function silenceElapsed(lastVoice: number, now: number) { return lastVoice > 0 && now - lastVoice >= SILENCE_MS; }
export function filterRepeatedWords(text: string) {
  let previous = "", count = 0;
  return text.trim().split(/\s+/).filter(Boolean).filter(word => {
    const key = word.toLocaleLowerCase().replace(/[.,!?،۔]+$/u, "");
    count = key === previous ? count + 1 : 1;
    previous = key;
    return count <= 3;
  }).join(" ");
}
export function finalTranscript(previous: string, results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>, start: number) {
  let text = previous;
  for (let i = start; i < results.length; i++) {
    const result = results[i];
    if (!result?.isFinal) continue;
    const chunk = filterRepeatedWords(result[0]?.transcript ?? "");
    if (!chunk) continue;
    if (chunk.toLowerCase().startsWith(text.toLowerCase())) text = chunk;
    else if (!text.toLowerCase().endsWith(chunk.toLowerCase())) text = `${text} ${chunk}`.trim();
  }
  return filterRepeatedWords(text);
}
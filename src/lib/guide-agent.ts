// Guide Agent: quick-action buttons pehle ek Genesis guide message chat me
// inject karte hain, phir asal action chalate hain.
export const GUIDE_EVT = "nqai-guide-message";
export const GUIDE_ID_PREFIX = "guide-";
const FEEDBACK_KEY = "nqai_guide_feedback";

export function emitGuideMessage(guideMessage: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GUIDE_EVT, { detail: { guideMessage } }));
}

export function isGuideMessageId(id: string): boolean {
  return id.startsWith(GUIDE_ID_PREFIX);
}

export type GuideFeedback = { id: string; vote: "up" | "down"; message: string; at: string };

export function saveGuideFeedback(id: string, vote: "up" | "down", message: string) {
  if (typeof window === "undefined") return;
  try {
    const list: GuideFeedback[] = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    const next = list.filter((f) => f.id !== id);
    next.push({ id, vote, message: message.slice(0, 500), at: new Date().toISOString() });
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next.slice(-200)));
  } catch {
    /* storage blocked */
  }
}

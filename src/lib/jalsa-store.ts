export const JALSA_EVENT = 'nqai-jalsa-change';
export const MAX_JALSA_TEXT = 1000;
export type JalsaIdentity = { id: string; name: string };
export type JalsaMessage = { id: string; peer_id: string; sender_id: string; text: string; delivery: 'queued' | 'sent' | 'received'; created_at: string };
export type JalsaHistory = { peers: JalsaIdentity[]; messages: JalsaMessage[] };
export function mergeJalsaMessages(local: JalsaMessage[], incoming: JalsaMessage[]): JalsaMessage[] {
  const map = new Map(local.map(m => [m.id, m]));
  for (const m of incoming) {
    const old = map.get(m.id);
    map.set(m.id, old && old.delivery !== 'queued' && m.delivery === 'queued' ? old : m);
  }
  return [...map.values()].sort((a,b) => a.created_at.localeCompare(b.created_at));
}
export function validJalsaText(text: string) { return text.trim().length > 0 && text.length <= MAX_JALSA_TEXT; }
export function setJalsaEnabled(enabled: boolean) {
  localStorage.setItem('nqai_jalsa', enabled ? '1' : '0');
  window.dispatchEvent(new Event(JALSA_EVENT));
}
export function loadJalsaIdentity(): JalsaIdentity {
  try {
    const saved = JSON.parse(localStorage.getItem('nqai_jalsa_identity') ?? 'null');
    if (saved && typeof saved.id === 'string' && typeof saved.name === 'string') return saved;
  } catch { /* New local identity when storage is invalid. */ }
  const identity = { id: crypto.randomUUID(), name: 'Builder' };
  saveJalsaIdentity(identity);
  return identity;
}
export function saveJalsaIdentity(identity: JalsaIdentity) { localStorage.setItem('nqai_jalsa_identity', JSON.stringify(identity)); }
export function loadJalsaHistory(key: string): JalsaHistory {
  try {
    const saved = JSON.parse(localStorage.getItem(`nqai_jalsa_history_${key}`) ?? 'null');
    if (saved && Array.isArray(saved.peers) && Array.isArray(saved.messages)) return saved;
  } catch { /* Keep the chat usable with a fresh local archive. */ }
  return { peers: [], messages: [] };
}
export function saveJalsaHistory(key: string, history: JalsaHistory) {
  localStorage.setItem(`nqai_jalsa_history_${key}`, JSON.stringify(history));
}
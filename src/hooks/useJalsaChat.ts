import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { JalsaPeer } from '@/lib/jalsa-peer';
import { loadJalsaHistory, loadJalsaIdentity, mergeJalsaMessages, saveJalsaHistory, saveJalsaIdentity, validJalsaText, type JalsaHistory, type JalsaIdentity, type JalsaMessage } from '@/lib/jalsa-store';
export function useJalsaChat(ownerId: string | undefined) {
  const [identity, setIdentity] = useState<JalsaIdentity | null>(null);
  const [history, setHistory] = useState<JalsaHistory>({ peers: [], messages: [] });
  const [connected, setConnected] = useState<string[]>([]);
  const [online, setOnline] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [syncState, setSyncState] = useState('Saved on this device');
  const sessions = useRef(new Set<JalsaPeer>());
  const archive = useRef<JalsaHistory>({ peers: [], messages: [] });
  const key = useRef('');
  const syncLock = useRef(false);
  const commit = useCallback((next: JalsaHistory) => {
    // Write before updating UI: a full storage device must not silently lose messages.
    saveJalsaHistory(key.current, next);
    archive.current = next; setHistory(next);
  }, []);
  useEffect(() => {
    try {
      const me = loadJalsaIdentity();
      setIdentity(me);
      key.current = ownerId ?? me.id;
      const saved = loadJalsaHistory(key.current);
      archive.current = saved; setHistory(saved);
    } catch { setStorageError('Local storage unavailable. Enable browser storage before sending.'); }
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); for (const peer of sessions.current) peer.close(); sessions.current.clear(); setConnected([]); };
  }, [ownerId]);
  const sync = useCallback(async () => {
    if (!ownerId || !identity || !navigator.onLine || syncLock.current) return;
    syncLock.current = true;
    try {
      setSyncState('Syncing private archive…');
      const { data, error } = await supabase.from('jalsa_messages').select('id,peer_id,sender_id,text,delivery,created_at').eq('owner_id', ownerId);
      if (error) throw error;
      const merged = mergeJalsaMessages(archive.current.messages, (data ?? []) as JalsaMessage[]);
      commit({ ...archive.current, messages: merged });
      if (merged.length) {
        const { error: writeError } = await supabase.from('jalsa_messages').upsert(merged.map(m => ({ ...m, owner_id: ownerId })), { onConflict: 'owner_id,id' });
        if (writeError) throw writeError;
      }
      setSyncState('Private archive synced');
    } catch { setSyncState('Saved locally • sync will retry'); }
    finally { syncLock.current = false; }
  }, [ownerId, identity, commit]);
  useEffect(() => {
    if (!online) { setSyncState('Saved offline on this device'); return; }
    const delay = setTimeout(() => { void sync(); }, 1000);
    const retry = setInterval(() => { void sync(); }, 30000);
    return () => { clearTimeout(delay); clearInterval(retry); };
  }, [online, history.messages, sync]);
  function newPeer() {
    if (!identity || storageError) throw new Error('Local storage is not ready');
    const me = identity;
    const peer = new JalsaPeer(me, (other, open) => {
      if (!other) return;
      setConnected(previous => open ? [...new Set([...previous, other.id])] : previous.filter(id => id !== other.id));
      if (open) {
        try { commit({ ...archive.current, peers: [...archive.current.peers.filter(p => p.id !== other.id), other] }); }
        catch { setStorageError('Device storage is full. Messages cannot be saved.'); return; }
        for (const message of archive.current.messages) if (message.peer_id === other.id && message.sender_id === me.id && message.delivery === 'queued') peer.send({ type: 'message', message });
      }
    }, (other, packet) => {
      try {
        if (packet.type === 'ack') {
          commit({ ...archive.current, messages: archive.current.messages.map(m => m.id === packet.id && m.peer_id === other.id && m.sender_id === me.id ? { ...m, delivery: 'sent' } : m) });
        } else {
          const incoming: JalsaMessage = { ...packet.message, peer_id: other.id, delivery: 'received' };
          commit({ ...archive.current, messages: mergeJalsaMessages(archive.current.messages, [incoming]) });
          peer.send({ type: 'ack', id: incoming.id });
        }
      } catch { setStorageError('Device storage is full. Message was not acknowledged.'); }
    });
    sessions.current.add(peer);
    return peer;
  }
  function send(peerId: string, text: string) {
    if (!identity || storageError || !validJalsaText(text)) return false;
    const message: JalsaMessage = { id: crypto.randomUUID(), peer_id: peerId, sender_id: identity.id, text: text.trim(), delivery: 'queued', created_at: new Date().toISOString() };
    try { commit({ ...archive.current, messages: mergeJalsaMessages(archive.current.messages, [message]) }); }
    catch { setStorageError('Device storage is full. Message was not sent.'); return false; }
    for (const peer of sessions.current) if (peer.identity?.id === peerId && peer.connected) { peer.send({ type: 'message', message }); break; }
    return true;
  }
  function rename(name: string) {
    if (!identity) return;
    const next = { ...identity, name: name.trim().slice(0,50) || 'Builder' };
    saveJalsaIdentity(next); setIdentity(next);
  }
  return { identity, history, connected, online, storageError, syncState, newPeer, send, rename };
}
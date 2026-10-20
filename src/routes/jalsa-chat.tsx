import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCheck, Copy, Loader2, QrCode, Radio, Send, Unplug, Wifi, WifiOff, X } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { JalsaScanner } from '@/components/JalsaScanner';
import { useAuth } from '@/hooks/useAuth';
import { useJalsaChat } from '@/hooks/useJalsaChat';
import { useJalsaMode } from '@/hooks/useJalsaMode';
import { MAX_JALSA_TEXT } from '@/lib/jalsa-store';
import type { JalsaPeer } from '@/lib/jalsa-peer';
export const Route = createFileRoute('/jalsa-chat')({
  head: () => ({ meta: [
    { title: 'Jalsa Local Chat — NO QUIT AI' },
    { name: 'description', content: 'Private QR-paired local chat on your Wi-Fi or hotspot, with offline message storage.' },
    { property: 'og:title', content: 'Jalsa Local Chat — NO QUIT AI' },
    { property: 'og:description', content: 'Direct local-network chat, separate from NO QUIT AI Community.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: JalsaChat,
});
function JalsaChat() {
  const { user, loading } = useAuth();
  // Local chat remains available without a hosted login, including offline sessions.
  return loading ? <main className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></main> : <LocalChat ownerId={user?.id} />;
}
function LocalChat({ ownerId }: { ownerId: string | undefined }) {
  const mode = useJalsaMode();
  const chat = useJalsaChat(ownerId);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [pairing, setPairing] = useState(false);
  const [stage, setStage] = useState<'choose' | 'offer' | 'join' | 'answer'>('choose');
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [qr, setQr] = useState('');
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<JalsaPeer | null>(null);
  const qrColors = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { if (chat.identity) setName(chat.identity.name); }, [chat.identity]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [chat.history.messages, selected]);
  useEffect(() => {
    if (!code) { setQr(''); return; }
    let active = true;
    const element = qrColors.current;
    const color = element ? getComputedStyle(element) : null;
    const hex = (value: string) => '#' + (value.match(/\d+/g) ?? []).slice(0,3).map(n => Number(n).toString(16).padStart(2,'0')).join('');
    void QRCode.toDataURL(code, { width: 440, margin: 3, errorCorrectionLevel: 'L', ...(color ? { color: { dark: hex(color.color), light: hex(color.backgroundColor) } } : {}) }).then(url => { if (active) setQr(url); }).catch(() => { if (active) setError('QR is too large — copy the code instead.'); });
    return () => { active = false; };
  }, [code]);
  useEffect(() => {
    if (chat.connected.length && pending.current?.connected) {
      setSelected(pending.current.identity?.id ?? null); pending.current = null;
      setPairing(false); setScan(false); toast.success('Jalsa peer connected');
    }
  }, [chat.connected]);
  useEffect(() => {
    if (!mode.enabled) { pending.current?.close(); pending.current = null; chat.disconnect(); setPairing(false); }
  }, [mode.enabled]);
  function openPairing() {
    pending.current?.close(); pending.current = null;
    setStage('choose'); setCode(''); setInput(''); setError(''); setScan(false); setPairing(true);
  }
  function closePairing() { pending.current?.close(); pending.current = null; setPairing(false); setScan(false); }
  async function createOffer() {
    setBusy(true); setError('');
    try { pending.current?.close(); const peer = chat.newPeer(); pending.current = peer; setCode(await peer.offer()); setStage('offer'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Local pairing unavailable'); }
    finally { setBusy(false); }
  }
  async function useCode(value: string) {
    if (busy) return;
    setScan(false); setBusy(true); setError('');
    try {
      if (stage === 'offer') {
        if (!pending.current) throw new Error('Create an invitation first');
        await pending.current.finish(value); setError('Connecting… keep both screens open.');
      } else {
        pending.current?.close(); const peer = chat.newPeer(); pending.current = peer;
        setCode(await peer.accept(value)); setStage('answer');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Pairing failed'); }
    finally { setBusy(false); }
  }
  async function copy() { try { await navigator.clipboard.writeText(code); toast.success('Pairing code copied'); } catch { toast.error('Select and copy the code below'); } }
  const peer = chat.history.peers.find(p => p.id === selected);
  const messages = chat.history.messages.filter(m => m.peer_id === selected);
  function send() { if (selected && mode.enabled && chat.send(selected, draft)) setDraft(''); }
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6">
      <header className="flex flex-wrap items-center gap-3 border-b border-border pb-5">
        <Button asChild variant="ghost" size="icon"><Link to="/" aria-label="Back to NO QUIT AI"><ArrowLeft /></Link></Button>
        <Radio className="h-7 w-7 text-primary" />
        <div className="min-w-0 flex-1"><h1 className="text-xl font-semibold">Jalsa Chat</h1><p className="text-xs text-muted-foreground">NO QUIT AI · Local network</p></div>
        <Switch aria-label="Jalsa Mode" checked={mode.enabled} onCheckedChange={mode.setEnabled} />
      </header>
      <div className="flex flex-wrap items-center gap-3 border-b border-border py-3 text-sm">
        {chat.online ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-primary" />}
        <span>{mode.enabled ? `${chat.online ? 'Internet available' : 'You are offline'} • ${chat.connected.length} connected` : 'Jalsa Mode OFF'}</span>
        <span className="ml-auto text-xs text-muted-foreground">{chat.syncState}</span>
      </div>
      {!ownerId && <p className="py-2 text-xs text-muted-foreground">Local-only session · <Link to="/auth" className="text-primary underline">Sign in</Link> for private online backup.</p>}
      {chat.storageError && <p role="alert" className="py-3 text-sm text-destructive">{chat.storageError}</p>}
      <div className="grid min-h-[65vh] flex-1 md:grid-cols-[260px_1fr]">
        <aside className="border-b border-border py-5 md:border-b-0 md:border-r md:pr-5">
          <label htmlFor="jalsa-name" className="text-xs text-muted-foreground">Your local name</label>
          <Input id="jalsa-name" value={name} maxLength={50} onChange={e => setName(e.target.value)} onBlur={() => { try { chat.rename(name); } catch { toast.error('Name could not be saved'); } }} className="mt-2" />
          <Button onClick={openPairing} disabled={!mode.enabled || !chat.identity || !!chat.storageError} className="mt-4 w-full"><QrCode /> QR connect</Button>
          <h2 className="mb-3 mt-6 text-xs font-semibold text-muted-foreground">PAIRED PEOPLE</h2>
          {chat.history.peers.length === 0 && <p className="text-sm text-muted-foreground">No paired people yet.</p>}
          <div className="space-y-1">{chat.history.peers.map(p => <Button key={p.id} variant={p.id === selected ? 'secondary' : 'ghost'} onClick={() => setSelected(p.id)} className="h-auto w-full justify-start py-3 text-left"><Radio className={chat.connected.includes(p.id) ? 'text-primary' : 'text-muted-foreground'} /><span className="min-w-0"><span className="block truncate">{p.name}</span><span className="block text-[10px] text-muted-foreground">{chat.connected.includes(p.id) ? 'Connected locally' : 'Disconnected • saved chat'}</span></span></Button>)}</div>
        </aside>
        <section className="flex min-w-0 flex-col pt-5 md:pl-6">
          {peer ? <>
            <div className="flex items-center gap-3 border-b border-border pb-3"><Radio className="text-primary" /><div className="min-w-0"><h2 className="truncate font-semibold">{peer.name}</h2><p className="text-xs text-muted-foreground">Offline via local network · encrypted direct connection</p></div>{chat.connected.includes(peer.id) && <Button variant="ghost" size="icon" aria-label="Disconnect peer" onClick={() => { /* Closing only this session leaves saved history intact. */ chat.disconnect(peer.id); }} className="ml-auto"><Unplug /></Button>}</div>
            <div role="log" aria-label="Jalsa messages" className="flex max-h-[55vh] min-h-64 flex-1 flex-col gap-3 overflow-y-auto py-4">
              {!messages.length && <p className="m-auto text-sm text-muted-foreground">No messages yet.</p>}
              {messages.map(m => <div key={m.id} className={`max-w-[85%] rounded-md px-3 py-2 ${m.sender_id === chat.identity?.id ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-secondary text-secondary-foreground'}`}><p className="break-words whitespace-pre-wrap text-sm">{m.text}</p><p className="mt-1 flex items-center gap-1 text-[10px] opacity-80">{m.delivery === 'queued' ? 'Queued • reconnect to send' : 'Sent via local network (Offline)'}{m.delivery === 'sent' && <CheckCheck className="h-3 w-3" />}</p></div>)}
              <div ref={bottom} />
            </div>
            {!chat.connected.includes(peer.id) && <p className="mb-2 text-xs text-muted-foreground">Peer disconnected. New messages stay queued until QR reconnect.</p>}
            <div className="flex items-end gap-2"><Textarea aria-label="Jalsa message" placeholder="Jalsa Mode - No internet needed" value={draft} maxLength={MAX_JALSA_TEXT} disabled={!mode.enabled || !!chat.storageError} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} className="min-h-12 resize-none" /><Button aria-label="Send Jalsa message" size="icon" disabled={!draft.trim() || !mode.enabled || !!chat.storageError} onClick={send}><Send /></Button></div>
          </> : <div className="m-auto flex max-w-sm flex-col items-center gap-4 py-12 text-center"><QrCode className="h-14 w-14 text-primary" /><h2 className="text-lg font-semibold">Pair a nearby device</h2><p className="text-sm text-muted-foreground">Same Wi-Fi or hotspot. Both devices need this page loaded first. Isolated networks may block a direct connection.</p><Button variant="outline" disabled={!mode.enabled || !chat.identity} onClick={openPairing}><QrCode /> QR connect</Button></div>}
        </section>
      </div>
      <Dialog open={pairing} onOpenChange={open => { if (!open) closePairing(); }}><DialogContent className="max-h-[90vh] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Jalsa QR pairing</DialogTitle></DialogHeader>
        <div ref={qrColors} className="absolute h-0 w-0 overflow-hidden bg-foreground text-background" aria-hidden />
        <p className="text-xs text-muted-foreground">Keep both pages open on the same Wi-Fi/hotspot. Pairing codes contain no login credentials.</p>
        {stage === 'choose' ? <div className="grid grid-cols-2 gap-3"><Button disabled={busy} onClick={() => { void createOffer(); }}>{busy ? <Loader2 className="animate-spin" /> : <QrCode />} Create invitation</Button><Button variant="outline" disabled={busy} onClick={() => setStage('join')}>Join a device</Button></div> : <>
          {code && <><p className="text-sm font-medium">{stage === 'offer' ? '1. Other device: scan invitation' : '2. First device: scan this response'}</p>{qr && <img src={qr} alt="Jalsa pairing QR" className="aspect-square w-full rounded-md" />}<Textarea aria-label="Your pairing code" value={code} readOnly rows={2} className="break-all text-[10px]" /><Button variant="outline" onClick={() => { void copy(); }}><Copy /> Copy pairing code</Button></>}
          {stage !== 'answer' && <><p className="text-sm font-medium">{stage === 'offer' ? '3. Scan or paste the other device’s response' : 'Scan or paste the invitation'}</p>{scan ? <><JalsaScanner onCode={value => { void useCode(value); }} /><Button variant="ghost" onClick={() => setScan(false)}><X /> Stop camera</Button></> : <Button variant="outline" disabled={busy} onClick={() => setScan(true)}><QrCode /> Scan QR</Button>}<Textarea aria-label="Other device pairing code" placeholder="JALSA1.…" value={input} onChange={e => setInput(e.target.value)} rows={2} className="break-all text-xs" /><Button disabled={busy || !input.trim()} onClick={() => { void useCode(input); }}>{busy ? <Loader2 className="animate-spin" /> : <Radio />} {stage === 'offer' ? 'Connect' : 'Create response'}</Button></>}
          {stage === 'answer' && <p className="text-xs text-muted-foreground">Waiting for the first device to scan your response…</p>}
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent></Dialog>
    </main>
  );
}
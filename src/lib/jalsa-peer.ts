import { validJalsaText, type JalsaIdentity, type JalsaMessage } from './jalsa-store';
type Signal = { version: 1; identity: JalsaIdentity; description: RTCSessionDescriptionInit };
export type JalsaWire = { type: 'message'; message: JalsaMessage } | { type: 'ack'; id: string };
async function encodeSignal(signal: Signal) {
  const stream = new Blob([JSON.stringify(signal)]).stream().pipeThrough(new CompressionStream('deflate'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return 'JALSA1.' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
}
async function decodeSignal(code: string): Promise<Signal> {
  if (!code.startsWith('JALSA1.') || code.length > 16000) throw new Error('Invalid Jalsa pairing code');
  const bytes = Uint8Array.from(atob(code.slice(7)), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  const value = JSON.parse(await new Response(stream).text());
  if (value.version !== 1 || typeof value.identity?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.identity.id) || typeof value.identity?.name !== 'string' || value.identity.name.length > 50 || !['offer','answer'].includes(value.description?.type) || typeof value.description?.sdp !== 'string') throw new Error('Invalid Jalsa pairing code');
  return value;
}
export class JalsaPeer {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  identity: JalsaIdentity | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  constructor(private me: JalsaIdentity, private onStatus: (peer: JalsaIdentity | null, connected: boolean) => void, private onMessage: (peer: JalsaIdentity, packet: JalsaWire) => void) {
    // No remote STUN/TURN or signaling servers: only local network candidates.
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.ondatachannel = event => this.attach(event.channel);
    this.pc.onconnectionstatechange = () => {
      if (this.closed) return;
      if (['failed','closed','disconnected'].includes(this.pc.connectionState)) this.onStatus(this.identity, false);
    };
  }
  private attach(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => { if (this.closed) return; if (this.timeout) clearTimeout(this.timeout); this.onStatus(this.identity, true); };
    channel.onclose = () => this.onStatus(this.identity, false);
    channel.onmessage = event => {
      if (this.closed || !this.identity || typeof event.data !== 'string' || event.data.length > 8000) return;
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'ack' && typeof packet.id === 'string') this.onMessage(this.identity, packet);
        else if (packet.type === 'message' && typeof packet.message?.id === 'string' && /^[0-9a-f-]{36}$/i.test(packet.message.id) && packet.message.sender_id === this.identity.id && packet.message.peer_id === this.me.id && typeof packet.message.text === 'string' && validJalsaText(packet.message.text) && Number.isFinite(Date.parse(packet.message.created_at))) this.onMessage(this.identity, packet);
      } catch { /* Ignore malformed packets from the other device. */ }
    };
  }
  private async signal() {
    await new Promise<void>((resolve, reject) => {
      if (this.pc.iceGatheringState === 'complete') { resolve(); return; }
      const timer = setTimeout(() => { this.pc.removeEventListener('icegatheringstatechange', check); reject(new Error('Local connection timed out; try again')); }, 10000);
      const check = () => { if (this.pc.iceGatheringState === 'complete') { clearTimeout(timer); this.pc.removeEventListener('icegatheringstatechange', check); resolve(); } };
      this.pc.addEventListener('icegatheringstatechange', check);
      check();
    });
    const description = this.pc.localDescription;
    if (!description) throw new Error('Pairing unavailable');
    return encodeSignal({ version: 1, identity: this.me, description: { type: description.type, sdp: description.sdp } });
  }
  private watchConnection() {
    this.timeout = setTimeout(() => { if (!this.connected) this.onStatus(this.identity, false); }, 30000);
  }
  async offer() {
    this.attach(this.pc.createDataChannel('jalsa', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    return this.signal();
  }
  async accept(code: string) {
    const signal = await decodeSignal(code.trim());
    if (signal.description.type !== 'offer' || signal.identity.id === this.me.id) throw new Error('Scan the other device’s invitation');
    this.identity = signal.identity;
    await this.pc.setRemoteDescription(signal.description);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    this.watchConnection();
    return this.signal();
  }
  async finish(code: string) {
    const signal = await decodeSignal(code.trim());
    if (signal.description.type !== 'answer' || signal.identity.id === this.me.id) throw new Error('Scan the other device’s response');
    this.identity = signal.identity;
    await this.pc.setRemoteDescription(signal.description);
    this.watchConnection();
  }
  get connected() { return this.channel?.readyState === 'open'; }
  send(packet: JalsaWire) {
    if (!this.channel || !this.connected) return false;
    try { this.channel.send(JSON.stringify(packet)); return true; } catch { return false; }
  }
  close() { if (this.closed) return; this.closed = true; if (this.timeout) clearTimeout(this.timeout); this.onStatus(this.identity, false); this.channel?.close(); this.pc.close(); }
}
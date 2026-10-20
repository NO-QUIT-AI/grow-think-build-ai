import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
export function JalsaScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onCode);
  callback.current = onCode;
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let frame = 0;
    const canvas = document.createElement('canvas');
    const scan = () => {
      const element = video.current;
      if (!active || !element) return;
      if (element.videoWidth) {
        canvas.width = Math.min(element.videoWidth, 1280);
        canvas.height = Math.round(element.videoHeight * canvas.width / element.videoWidth);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(image.data, image.width, image.height);
          if (result?.data.startsWith('JALSA1.')) { callback.current(result.data); return; }
        }
      }
      frame = requestAnimationFrame(scan);
    };
    void (async () => {
      try {
        const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!active) { next.getTracks().forEach(t => t.stop()); return; }
        stream = next;
        if (video.current) { video.current.srcObject = next; await video.current.play(); scan(); }
      } catch { if (active) setError('Camera unavailable — paste the pairing code instead.'); }
    })();
    return () => { active = false; cancelAnimationFrame(frame); stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <video ref={video} muted playsInline className="aspect-square w-full rounded-md bg-secondary object-cover" aria-label="Scan Jalsa QR code" />;
}
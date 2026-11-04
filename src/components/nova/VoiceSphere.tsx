// @ts-nocheck -- hot typed-array loop; indexed access is bounds-safe by construction
import { useEffect, useRef } from "react";

/** Three.js sphere: calm breathing glow; mic volume emits particles outward from the center. */
export function VoiceSphere({ aiAmpRef, micAmpRef }: { aiAmpRef: { current: number }; micAmpRef: { current: number } }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;
      const w = host.clientWidth, h = host.clientHeight;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      renderer.setSize(w, h);
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
      camera.position.set(0, 0, 10); // static camera

      // Glow sprite texture
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      if (!g) { renderer.dispose(); renderer.domElement.remove(); return; }
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.3, "rgba(120,240,255,0.8)");
      grad.addColorStop(1, "rgba(0,238,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);

      const glowMat = new THREE.SpriteMaterial({ map: tex, color: 0x00eeff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const glow = new THREE.Sprite(glowMat);
      scene.add(glow);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x00eeff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      scene.add(core);

      const N = 600;
      const pos = new Float32Array(N * 3);
      const vel = new Float32Array(N * 3);
      const life = new Float32Array(N); // 0 = inactive
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pMat = new THREE.PointsMaterial({ map: tex, size: 0.18, color: 0xbff8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      scene.add(new THREE.Points(geo, pMat));

      let vol = 0, spawnAcc = 0, last = performance.now();
      const loop = (t: number) => {
        const dt = Math.min((t - last) / 1000, 0.05);
        last = t;
        const raw = Math.min(1, micAmpRef.current * 6);
        const target = raw > 0.08 ? raw : 0; // voice gate
        vol += (target - vol) * (1 - Math.exp(-(target > vol ? 12 : 3) * dt));
        const ai = aiAmpRef.current * 0.4;

        const breath = 0.5 + 0.5 * Math.sin(t / 1600);
        const bright = 1 + vol * 0.3 + ai * 0.2; // +30% with user voice
        glow.scale.setScalar((3.6 + breath * 0.4 + vol * 1.2) * bright);
        glowMat.opacity = Math.min(1, (0.55 + breath * 0.15) * bright);
        core.scale.setScalar(1 + vol * 0.15);

        spawnAcc += vol * 260 * dt;
        for (let i = 0; i < N && spawnAcc >= 1; i++) {
          if (life[i] > 0) continue;
          spawnAcc -= 1;
          const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
          const dx = r * Math.cos(th), dy = r * Math.sin(th), dz = u;
          const sp = 1.5 + Math.random() * 3 * (0.5 + vol);
          pos.set([dx * 0.2, dy * 0.2, dz * 0.2], i * 3);
          vel.set([dx * sp, dy * sp, dz * sp], i * 3);
          life[i] = 1;
        }
        if (spawnAcc > 5) spawnAcc = 0;
        const pull = vol < 0.05; // silent: particles drift back inside
        for (let i = 0; i < N; i++) {
          const k = i * 3;
          if (life[i] <= 0) { pos[k] = pos[k + 1] = pos[k + 2] = 9999; continue; }
          if (pull) {
            const f = Math.exp(-1.5 * dt);
            vel[k] = vel[k] * f - pos[k] * 1.2 * dt;
            vel[k + 1] = vel[k + 1] * f - pos[k + 1] * 1.2 * dt;
            vel[k + 2] = vel[k + 2] * f - pos[k + 2] * 1.2 * dt;
            if (Math.hypot(pos[k], pos[k + 1], pos[k + 2]) < 0.3) life[i] = 0;
          }
          pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
          life[i] -= dt * 0.25;
        }
        geo.attributes.position.needsUpdate = true;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const onResize = () => {
        const W = host.clientWidth, H = host.clientHeight;
        renderer.setSize(W, H);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);
      cleanup = () => {
        window.removeEventListener("resize", onResize);
        renderer.dispose(); geo.dispose(); tex.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [aiAmpRef, micAmpRef]);

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0" />;
}

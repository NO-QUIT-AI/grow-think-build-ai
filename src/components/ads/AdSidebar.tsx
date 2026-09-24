import { useEffect, useState } from "react";

const ZONES = ["11875406", "285465"];
const FIVE_MIN = 5 * 60 * 1000;
const LS_KEY = "nqai_ad_last_refresh";
const BLOCKED = ["login", "signin", "signup", "register", "auth", "verify"];

const tag = (zone: string) =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;overflow:hidden;background:transparent"><script src="https://quge5.com/88/tag.min.js" data-zone="${zone}" async data-cfasync="false"><\/script></body></html>`;

export function AdSidebar() {
  const [allowed, setAllowed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    if (BLOCKED.some((b) => path.includes(b))) return; // never load on auth pages
    setAllowed(true);
    // Frequency cap: refresh the ad at most once every 5 minutes per user.
    const tick = () => {
      const last = Number(localStorage.getItem(LS_KEY) || 0);
      if (Date.now() - last >= FIVE_MIN) {
        localStorage.setItem(LS_KEY, String(Date.now()));
        setRefreshKey((k) => k + 1);
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!allowed) return null;

  return (
    <aside
      aria-label="Advertisement"
      className="w-full min-w-0 shrink-0 self-center md:sticky md:top-5 md:w-[25%] md:self-start"
    >
      <div className="mx-auto w-full max-w-[300px] rounded-xl border border-border bg-card/40 p-2.5">
        <p className="mb-1.5 text-[11px] text-muted-foreground">Advertisement</p>
        <div id="monetag-ad-box" className="flex w-full flex-col gap-2 overflow-hidden rounded-lg">
          {ZONES.map((zone) => (
            <iframe
              key={`${zone}-${refreshKey}`}
              title={`Advertisement ${zone}`}
              srcDoc={tag(zone)}
              // No allow-popups / allow-top-navigation: ads can't open popunders,
              // go fullscreen over the app, or redirect the page.
              sandbox="allow-scripts"
              scrolling="no"
              className="block h-[250px] w-full border-0"
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

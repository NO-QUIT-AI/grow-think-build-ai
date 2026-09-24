import { useEffect, useState } from "react";

const ZONES = ["11875406", "285465"];
const FIVE_MIN = 5 * 60 * 1000;
const BLOCKED = ["login", "signin", "signup", "register", "auth", "verify"];

const tag = (zone: string) =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;overflow:hidden;background:transparent"><script src="https://quge5.com/88/tag.min.js" data-zone="${zone}" async data-cfasync="false"><\/script></body></html>`;

export function AdSidebar() {
  const [allowed, setAllowed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    if (BLOCKED.some((b) => path.includes(b))) return; // never on auth pages
    // First ad appears only after 5 minutes, then refreshes every 5 minutes.
    const first = window.setTimeout(() => setAllowed(true), FIVE_MIN);
    const id = window.setInterval(() => setRefreshKey((k) => k + 1), FIVE_MIN);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
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
              // allow-same-origin lets Monetag recognise the site so ads fill.
              // Still NO allow-popups / allow-top-navigation: no popunders,
              // no fullscreen overlays, no redirects.
              sandbox="allow-scripts allow-same-origin"
              scrolling="no"
              className="block h-[250px] w-full border-0"
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

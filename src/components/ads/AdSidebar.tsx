import { useEffect, useRef } from "react";

const MONETAG_ZONE_ID = "11875406";
const MONETAG_SCRIPT_ID = `monetag-in-page-${MONETAG_ZONE_ID}`;

export function AdSidebar() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.querySelector(`#${MONETAG_SCRIPT_ID}`)) return;

    const script = document.createElement("script");
    script.id = MONETAG_SCRIPT_ID;
    script.src = "https://quge5.com/88/tag.min.js";
    script.async = true;
    script.dataset.zone = MONETAG_ZONE_ID;
    script.dataset.cfasync = "false";
    container.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <aside
      aria-label="Advertisement"
      className="w-full lg:sticky lg:top-5 lg:w-[300px] lg:self-start"
    >
      <p className="mb-1.5 text-[11px] text-muted-foreground">Advertisement</p>
      <div
        ref={containerRef}
        className="mx-auto min-h-[250px] w-full max-w-[300px] overflow-hidden rounded-lg border border-border bg-card/40 lg:h-[250px]"
      />
    </aside>
  );
}
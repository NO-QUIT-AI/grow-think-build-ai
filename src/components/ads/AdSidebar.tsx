const MONETAG_ZONE_ID = "11875406";
const MONETAG_IN_PAGE_TAG = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;overflow:hidden;background:transparent"><script src="https://quge5.com/88/tag.min.js" data-zone="${MONETAG_ZONE_ID}" async data-cfasync="false"><\/script></body></html>`;

export function AdSidebar() {
  return (
    <aside
      aria-label="Advertisement"
      className="w-full min-w-0 shrink-0 self-center md:sticky md:top-5 md:w-[25%] md:self-start"
    >
      <div className="mx-auto w-full max-w-[300px] rounded-xl border border-border bg-card/40 p-2.5">
        <p className="mb-1.5 text-[11px] text-muted-foreground">Advertisement</p>
        <div
          id="monetag-ad-container"
          className="h-[250px] w-full overflow-hidden rounded-lg"
        >
          <iframe
            title="Monetag in-page advertisement"
            srcDoc={MONETAG_IN_PAGE_TAG}
            sandbox="allow-scripts"
            scrolling="no"
            className="block h-full w-full border-0"
          />
        </div>
      </div>
    </aside>
  );
}
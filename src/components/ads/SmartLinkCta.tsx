import { ExternalLink, Sparkles } from "lucide-react";

// Monetag Direct Link (SmartLink). Official method: a plain <a target="_blank">
// that opens ONLY on an explicit user click. Never opened automatically,
// never in an iframe, never as a popup/redirect.
export const SMARTLINK_URL = "https://omg10.com/4/11883852";

// Hidden for AdSense review — set to true to show the sponsored bar again.
const SHOW_SMARTLINK = false;

export function SmartLinkCta({ className = "" }: { className?: string }) {
  if (!SHOW_SMARTLINK) return null;
  return (
    <a
      href={SMARTLINK_URL}
      target="_blank"
      rel="noopener noreferrer sponsored nofollow"
      className={
        "flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground " +
        className
      }
      aria-label="Open a sponsored offer in a new tab"
    >
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span>Sponsored Offer — Support NO QUIT AI</span>
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}

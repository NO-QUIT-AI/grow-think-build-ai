import { emitGuideMessage } from "@/lib/guide-agent";
import { cn } from "@/lib/utils";

/**
 * Guide Agent button: hover par Roman Urdu tooltip, click par pehle Genesis
 * chat me guideMessage inject hota hai, phir onClickAction chalta hai.
 * Naye button ko guide dena = bas tooltipText + guideMessage pass karo.
 */
export function ButtonWithGuide({
  label,
  tooltipText,
  guideMessage,
  onClickAction,
  className,
}: {
  label: string;
  tooltipText: string;
  guideMessage: string;
  onClickAction: () => void;
  className?: string;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={() => {
          emitGuideMessage(guideMessage);
          onClickAction();
        }}
        className={cn(
          "rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-primary",
          className,
        )}
      >
        {label}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-xl border border-border bg-popover px-3 py-2 text-left text-xs leading-relaxed text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {tooltipText}
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-popover" />
      </span>
    </span>
  );
}

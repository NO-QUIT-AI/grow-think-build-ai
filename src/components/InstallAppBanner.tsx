import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/LanguageContext";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "noquit_install_dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari standalone flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Shows an install banner so visitors who open the app from a shared link can
 * add NO QUIT AI to their phone home screen with one tap (Android/Chrome) or
 * via Share → Add to Home Screen (iPhone/Safari).
 */
export function InstallAppBanner() {
  const t = useT();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios] = useState(isIos);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS has no beforeinstallprompt — show the manual guide instead.
    if (isIos()) setVisible(true);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
      setVisible(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 mx-auto w-full max-w-md px-3">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Smartphone className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
           <p className="text-sm font-semibold leading-tight">{t("installTitle")}</p>
          {ios ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
               <Share className="h-3 w-3" /> {t("installInfo")}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
               {t("installInfo")}
            </p>
          )}
          {!ios && promptEvent && (
            <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => void install()}>
               {t("install")}
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
           aria-label={t("close")}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

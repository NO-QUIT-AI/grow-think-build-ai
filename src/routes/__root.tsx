import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RewardAdHost } from "@/components/ads/RewardAd";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { IncomingCallListener } from "@/components/calls/IncomingCallListener";
import { HelpAssistant } from "@/components/HelpAssistant";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initAdsConfig } from "@/lib/adsense";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { registerAppOfflineScreen } from "@/lib/pwa-registration";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "monetag", content: "a96116c4c2cab550e181eedbdb25cd81" },
      { title: "NO QUIT AI" },
      {
        name: "description",
        content: "Build websites, app blueprints and domain names from a simple chat.",
      },
      { property: "og:title", content: "NO QUIT AI" },
      {
        property: "og:description",
        content: "Build websites, app blueprints and domain names from a simple chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600&family=Noto+Naskh+Arabic:wght@400;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/logo-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/logo-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/logo-192x192.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
    // AdSense is injected after hydration by initAdsConfig. Loading it before
    // React hydrates lets Auto Ads mutate <body> and breaks page hydration.
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: (props) => <ErrorComponent error={props.error as Error} reset={props.reset} />,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const androidPage = router.state.location.pathname === "/android-app";
  useEffect(() => {
    void registerAppOfflineScreen().catch(() => {});
  }, [androidPage]);

  // Load the runtime ad config (publisher ID from env) and inject the
  // AdSense script exactly once per page load — but ONLY on static content
  // pages. Google policy forbids ads on chat/app screens, so the script
  // (and Auto Ads) never loads on the main app, community or messaging routes.
  useEffect(() => {
    const AD_PATHS = ["/about", "/contact", "/privacy", "/terms", "/blog"];
    const path = window.location.pathname;
    if (AD_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
      void initAdsConfig();
    }
  }, []);

  // Error telemetry: client errors owner ko auto-report hote hain (fire-and-forget,
  // sirf sanitized message/stack — koi PII nahi). App ko kabhi block nahi karta.
  useEffect(() => {
    const send = (message: string, stack?: string) => {
      fetch("/api/public/error-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, stack, route: window.location.pathname }),
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) =>
      send(e.message || "window error", e.error instanceof Error ? e.error.stack : undefined);
    const onRejection = (e: PromiseRejectionEvent) =>
      send(
        e.reason instanceof Error ? e.reason.message : String(e.reason),
        e.reason instanceof Error ? e.reason.stack : undefined,
      );
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        {!androidPage && <InstallAppBanner />}
        {!androidPage && <IncomingCallListener />}
        {!androidPage && <HelpAssistant />}
        <Toaster position="top-center" richColors />
        {!androidPage && <RewardAdHost />}
        <SpeedInsights />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

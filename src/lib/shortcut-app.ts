/**
 * Turns a generated single-file website into an installable "shortcut app":
 * PWA manifest (inlined as a data URI), standalone display, theme colour and
 * home-screen icons are injected into the HTML head.
 */

export type ShortcutAppOptions = {
  html: string;
  name: string;
  themeColor?: string;
  backgroundColor?: string;
  iconUrl?: string;
};

const DEFAULT_ICON = "/logo-512x512.png";

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "no-quit-app"
  );
}

function toDataUri(json: unknown): string {
  return `data:application/manifest+json;base64,${btoa(
    // btoa needs latin1 — escape unicode first
    unescape(encodeURIComponent(JSON.stringify(json))),
  )}`;
}

export function buildShortcutAppHtml({
  html,
  name,
  themeColor = "#080b14",
  backgroundColor = "#080b14",
  iconUrl = DEFAULT_ICON,
}: ShortcutAppOptions): string {
  const shortName = name.length > 12 ? `${name.slice(0, 12).trim()}` : name;
  const absoluteIcon =
    typeof window !== "undefined" && iconUrl.startsWith("/")
      ? `${window.location.origin}${iconUrl}`
      : iconUrl;

  const manifest = {
    name,
    short_name: shortName,
    start_url: ".",
    scope: ".",
    display: "standalone",
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      { src: absoluteIcon, sizes: "512x512", type: "image/png" },
      { src: absoluteIcon, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  const head = [
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`,
    `<meta name="theme-color" content="${themeColor}" />`,
    `<meta name="mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
    `<meta name="apple-mobile-web-app-title" content="${escapeAttr(shortName)}" />`,
    `<link rel="apple-touch-icon" href="${absoluteIcon}" />`,
    `<link rel="icon" type="image/png" href="${absoluteIcon}" />`,
    `<link rel="manifest" href="${toDataUri(manifest)}" />`,
    `<!-- Shortcut app packaged by NO QUIT AI -->`,
  ].join("\n    ");

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, (_m, attrs: string) => `<head${attrs}>\n    ${head}`);
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeAttr(name)}</title>
    ${head}
  </head>
  <body>
${html}
  </body>
</html>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function downloadShortcutApp(options: ShortcutAppOptions): string {
  const packaged = buildShortcutAppHtml(options);
  const blobUrl = URL.createObjectURL(new Blob([packaged], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${slugify(options.name)}-shortcut-app.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
  return packaged;
}

export function openShortcutAppPreview(options: ShortcutAppOptions) {
  const packaged = buildShortcutAppHtml(options);
  const blobUrl = URL.createObjectURL(new Blob([packaged], { type: "text/html" }));
  window.open(blobUrl, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
}

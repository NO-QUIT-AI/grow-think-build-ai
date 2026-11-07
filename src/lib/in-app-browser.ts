// Google blocks sign-in inside embedded browsers (WhatsApp, Instagram, Facebook,
// Android WebViews) with "403 disallowed_useragent". Detect them so we can send
// the user to a real browser instead of failing silently.
const IN_APP_PATTERNS = [
  /FBAN|FBAV|FB_IAB|FBIOS/i, // Facebook / Messenger
  /Instagram/i,
  /WhatsApp/i,
  /Line\//i,
  /Snapchat/i,
  /TikTok|musical_ly|BytedanceWebview/i,
  /Twitter/i,
  /LinkedInApp/i,
  /; wv\)/i, // Android WebView (includes our own Android app)
];

export function isInAppBrowser(ua: string): boolean {
  return IN_APP_PATTERNS.some((re) => re.test(ua));
}

export function chromeIntentUrl(url: string): string {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

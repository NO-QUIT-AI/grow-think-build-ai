export type SafetyAnswer = boolean | null;
export function deviceSafetyScore(lock: SafetyAnswer, permissionsReviewed: SafetyAnswer, backedUp: boolean) {
  return (lock === true ? 40 : 0) + (permissionsReviewed === true ? 40 : 0) + (backedUp ? 20 : 0);
}

export function linkWarnings(value: string): string[] {
  let url: URL;
  try { url = new URL(value); } catch { return ["Invalid link — link samajh nahi aa raha."]; }
  if (!["http:", "https:"].includes(url.protocol)) return ["Unsupported link — is link ko mat kholein."];
  const warnings: string[] = [];
  if (url.protocol === "http:") warnings.push("Unencrypted link — connection private nahi hai.");
  if (url.username || url.password) warnings.push("Hidden destination — link mein login text hai.");
  if (url.hostname.includes("xn--")) warnings.push("Look-alike address — website ka naam dhyan se check karein.");
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.startsWith("[")) warnings.push("Number-based address — website ki pehchan verify karein.");
  if (["bit.ly", "tinyurl.com", "t.co", "is.gd", "shorturl.at"].includes(url.hostname)) warnings.push("Shortened link — asli destination chhupi hui hai.");
  return warnings;
}

export const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000;
export function backupDue(last: string | null, now: number) {
  return !last || now - new Date(last).getTime() >= AUTO_BACKUP_INTERVAL;
}
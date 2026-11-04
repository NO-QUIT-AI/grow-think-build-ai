export const ANDROID_PACKAGE = "com.noquitai.app";
export const ANDROID_ORIGIN = "https://noquitai.com";
export const ANDROID_START_PATH = "/android-app";
export const ANDROID_TOOLS = ["build_website", "file_edit", "file_undo", "create_domains"] as const;

export function androidTools<T>(tools: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(tools).filter(([key]) => ANDROID_TOOLS.some((allowed) => allowed === key)));
}

export function refuseAndroidFinancialRequest(text: string) {
  return /\b(crypto(?:currency)?|bitcoin|ethereum|token trading|mining|wallet|staking|investment|financial|referral|coin claim)\b/i.test(text);
}

export const ANDROID_SYSTEM_PROMPT = `You are NO QUIT AI - Build Studio, a website builder and practical tools assistant. Help create and edit safe websites and suggest domain names. Reply in the selected language. Use build_website for complete single-file HTML, file_edit and file_undo for existing builds, create_domains for domain suggestions. Never claim domain availability is verified. Do not provide cryptocurrency, mining, wallet, investment, financial, referral or rewards functionality. Do not mention or link the full website's mining, plans or earning screens. Refuse requests to build financial or cryptocurrency products. Generated HTML must contain no external scripts, trackers, payment forms, or credential collection. Never claim an action succeeded without its tool result.`;
import { Capacitor, registerPlugin } from "@capacitor/core";
interface DeviceSafety {
  check(): Promise<{ screenLock: boolean; accessibilityServices: number; overlay: boolean; unknownSources: boolean }>;
  openSettings(options: { section: "security" | "permissions" | "apps" }): Promise<void>;
}
export const nativeSecurity = registerPlugin<DeviceSafety>("DeviceSafety");
export function hasNativeSafety() { return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("DeviceSafety"); }
import { registerPlugin, Capacitor } from "@capacitor/core";
interface NativeCallPush {
  register(): Promise<{ token: string }>;
  refresh(): Promise<{ token?: string }>;
  fullScreenSettings(): Promise<void>;
  disable(): Promise<void>;
  dismiss(options: { inviteId: string }): Promise<void>;
}
export const nativeCallPush = registerPlugin<NativeCallPush>("CallPush");
export const isAndroidCallPush = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("CallPush");
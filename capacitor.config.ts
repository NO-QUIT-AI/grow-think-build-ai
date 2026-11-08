import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  "appId": "com.noquitai.app",
  "appName": "NO QUIT AI - Build Studio",
  "webDir": "www",
  "server": {
    "url": "https://noquitai.com/",
    "cleartext": false,
    "errorPath": "offline.html"
  },
  "android": {
    "allowMixedContent": false,
    "webContentsDebuggingEnabled": false
  }
};
export default config;

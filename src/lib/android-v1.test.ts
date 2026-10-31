import { describe, expect, it } from "bun:test";
import { ANDROID_PACKAGE, ANDROID_START_PATH, androidTools, refuseAndroidFinancialRequest } from "./android-v1";

describe("Android v1 product boundary", () => {
  it("uses the requested package identity and separate builder entry", () => {
    expect(ANDROID_PACKAGE).toBe("com.noquit.aibuildstudio");
    expect(ANDROID_START_PATH).toBe("/android-app");
  });
  it("only exposes website and nonfinancial domain tools even for owners", () => {
    expect(Object.keys(androidTools({ build_website: {}, file_edit: {}, file_undo: {}, create_domains: {}, db_write: {}, list_users: {}, start_job: {}, generate_video: {} }))).toEqual(["build_website", "file_edit", "file_undo", "create_domains"]);
  });
  it("rejects cryptocurrency and wallet requests", () => {
    expect(refuseAndroidFinancialRequest("Build a bitcoin wallet")).toBe(true);
    expect(refuseAndroidFinancialRequest("Create a crypto mining app")).toBe(true);
    expect(refuseAndroidFinancialRequest("Build a cafe website")).toBe(false);
  });
});
import { it } from "node:test";
import assert from "node:assert/strict";
import { paidVideoLimits, messageCacheKey } from "./paid-video-rules";

it("caps paid generation at 3 per hour, 10 per user day and 50 app-wide per day by default", () => {
  assert.deepEqual(paidVideoLimits({}), { hour: 3, day: 10, globalDay: 50 });
});
it("rejects unlimited or invalid paid-video overrides", () => {
  assert.deepEqual(paidVideoLimits({ PAID_VIDEO_USER_HOURLY_LIMIT: "0", PAID_VIDEO_USER_DAILY_LIMIT: "NaN", PAID_VIDEO_GLOBAL_DAILY_LIMIT: "999999" }), { hour: 3, day: 10, globalDay: 50 });
});
it("isolates cached messages by user even for the same conversation identifier", () => {
  assert.notEqual(messageCacheKey("user-a", "thread"), messageCacheKey("user-b", "thread"));
});
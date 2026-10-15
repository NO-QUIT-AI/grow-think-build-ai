import { createServerFn } from "@tanstack/react-start";

/** Publishable app key (pk_) — safe to send to the browser. */
export const getPollinationsAppKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["POLLINATIONS_PUBLISHABLE_KEY"] ?? "" };
});

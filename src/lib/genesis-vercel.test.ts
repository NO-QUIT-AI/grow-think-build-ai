// @ts-nocheck -- Bun test runner, matching existing project tests.
import { expect, test } from "bun:test";
import { cleanDomain, dnsRecordsFor, withAuditAndGrants } from "./genesis-vercel.server";

const fakeSb = (granted: boolean, logs: unknown[]) => ({
  from: (t: string) => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: granted ? { scope: "deploy" } : null }) }) }) }),
    insert: (row: unknown) => { logs.push({ t, row }); return Promise.resolve({}); },
  }),
});

test("apex gets A record, subdomain gets CNAME", () => {
  expect(dnsRecordsFor("example.com")[0]).toEqual({ type: "A", name: "@", value: "76.76.21.21" });
  expect(dnsRecordsFor("app.example.com")[0]).toEqual({ type: "CNAME", name: "app", value: "cname.vercel-dns.com" });
  expect(cleanDomain("https://Shop.Example.com/x")).toBe("shop.example.com");
});

test("deploy asks without grant, runs with grant, and every call is audited", async () => {
  const logs: unknown[] = [];
  const t = { vercel_deploy: { execute: async () => ({ deployed: true }) } };
  const asked = await withAuditAndGrants(t, fakeSb(false, logs), "u1").vercel_deploy.execute({ project: "a" }, {});
  expect(asked.needsConfirm).toBe(true);
  const ran = await withAuditAndGrants(t, fakeSb(true, logs), "u1").vercel_deploy.execute({ project: "a" }, {});
  expect(ran.deployed).toBe(true);
  await new Promise((r) => setTimeout(r, 0));
  expect(logs.length).toBe(2);
});

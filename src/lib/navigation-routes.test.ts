import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HELP_ENTRIES } from "./help-guide";

const SOURCE_ROOT = join(process.cwd(), "src");
const ROUTES_ROOT = join(SOURCE_ROOT, "routes");

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && entry.name !== "routeTree.gen.ts" ? [path] : [];
  });
}

function normalize(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] ?? "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

const pageRoutes = sourceFiles(ROUTES_ROOT).flatMap((path) => {
  const source = readFileSync(path, "utf8");
  const route = /createFileRoute\(\s*["']([^"']+)["']/.exec(source)?.[1];
  return route && !route.startsWith("/api/") ? [normalize(route.replace(/\/_authenticated(?=\/|$)/, "") || "/")] : [];
});

function isRegisteredPage(target: string): boolean {
  const pathname = normalize(target);
  return pageRoutes.some((route) => {
    const pattern = route
      .split("/")
      .map((segment) => segment.startsWith("$") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("/");
    return new RegExp(`^${pattern}$`).test(pathname);
  });
}

function internalTargets(): Array<{ path: string; target: string }> {
  return sourceFiles(SOURCE_ROOT).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return [...source.matchAll(/(?:\bto\s*:\s*|\bto\s*=\s*|\bhref\s*=\s*|\broute\s*:\s*)["'](\/[^"']*)["']/g)]
      .map((match) => ({ path, target: match[1] ?? "/" }))
      .filter(({ target }) => !target.startsWith("/api/") && !/\.[a-z0-9]+$/i.test(normalize(target)));
  });
}

describe("application navigation", () => {
  it("keeps legacy /login working by permanently redirecting it to /auth", () => {
    const loginRoute = readFileSync(join(ROUTES_ROOT, "login.tsx"), "utf8");
    assert.match(loginRoute, /redirect\(\{\s*to: "\/auth",\s*statusCode: 301,\s*replace: true\s*\}\)/);
    assert.equal(internalTargets().some(({ target }) => normalize(target) === "/login"), false);
  });

  it("has a registered page for every static internal link and navigation target", () => {
    const broken = internalTargets().filter(({ target }) => !isRegisteredPage(target));
    assert.deepEqual(broken, []);
  });

  it("has a registered page for every Help Assistant destination", () => {
    assert.deepEqual(HELP_ENTRIES.filter((entry) => !isRegisteredPage(entry.route)).map((entry) => entry.route), []);
  });
});

import assert from "node:assert/strict";
// Minimal expect() over node:assert so node:test suites typecheck without vitest/bun types.
export function expect(actual: unknown) {
  return {
    toBe: (v: unknown) => assert.strictEqual(actual, v),
    toEqual: (v: unknown) => assert.deepStrictEqual(actual, v),
    toBeGreaterThan: (v: number) => assert.ok((actual as number) > v),
    toBeLessThanOrEqual: (v: number) => assert.ok((actual as number) <= v),
    toHaveLength: (n: number) => assert.strictEqual((actual as { length: number }).length, n),
    toBeNull: () => assert.strictEqual(actual, null),
    toThrow: (re?: RegExp) => (re ? assert.throws(actual as () => unknown, re) : assert.throws(actual as () => unknown)),
  };
}

import { describe, it } from "node:test";
import { expect } from "./test-expect";
import { fixImports } from "./self-update-rules";
const known = new Set(["src/lib/agents/config.ts", "src/lib/utils.ts"]);
describe("fixImports", () => {
  it("repairs mis-depthed ../lib from src/routes/api to @/ alias", () => {
    expect(fixImports("src/routes/api/x.ts", `import { a } from "../lib/agents/config";`, known)).toBe(`import { a } from "@/lib/agents/config";`);
  });
  it("converts valid relative imports to @/", () => {
    expect(fixImports("src/routes/api/x.ts", `import u from '../../lib/utils';`, known)).toBe(`import u from '@/lib/utils';`);
  });
  it("rejects imports of missing files", () => {
    expect(() => fixImports("src/a.ts", `import x from "@/lib/missing";`, known)).toThrow(/Broken import/);
  });
});

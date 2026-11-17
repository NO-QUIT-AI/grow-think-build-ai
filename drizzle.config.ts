import { defineConfig } from "drizzle-kit";

const migrationUrl = process.env.LOVABLE_DB_MIGRATION_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: migrationUrl,
  },
});

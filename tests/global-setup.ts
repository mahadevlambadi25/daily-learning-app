import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Builds a throwaway SQLite database for the test run by applying the real migrations
 * (`prisma migrate deploy`) to a brand-new file. Only ever touches prisma/test.db.
 */
export default function setup() {
  const testDb = join(process.cwd(), "prisma", "test.db");
  for (const f of [testDb, `${testDb}-journal`]) if (existsSync(f)) rmSync(f);
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./test.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}

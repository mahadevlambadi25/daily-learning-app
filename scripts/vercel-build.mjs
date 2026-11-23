// Production build used by Vercel (package.json "vercel-build"), against PostgreSQL.
//  1. check prisma/postgres/schema.prisma matches prisma/schema.prisma
//  2. generate the Prisma client for PostgreSQL
//  3. apply pending migrations (prisma migrate deploy: never resets or drops data)
//  4. seed topics/starter lessons/admin (idempotent; skip with SEED_ON_BUILD=false)
//  5. next build
import { execSync } from "node:child_process";

const env = { ...process.env };
if (!env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set. Add a Postgres database (e.g. Neon) to the Vercel project first.");
  process.exit(1);
}
// Neon's Vercel integration provides a pooled DATABASE_URL plus a direct URL for migrations.
env.DIRECT_URL ||= env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;

const run = (label, cmd) => {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: "inherit", env });
};

const schema = "--schema prisma/postgres/schema.prisma";
run("Check Postgres schema", "node scripts/pg-schema.mjs --check");
run("Generate Prisma client (PostgreSQL)", `npx prisma generate ${schema}`);
run("Apply database migrations", `npx prisma migrate deploy ${schema}`);
if (env.SEED_ON_BUILD !== "false") run("Seed topics, starter lessons and admin", "npx tsx prisma/seed.ts");
run("Build Next.js", "npx next build");

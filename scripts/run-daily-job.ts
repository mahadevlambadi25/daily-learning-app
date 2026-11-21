/**
 * Runs the daily delivery job once, locally (same code as POST /api/jobs/daily-delivery).
 *   npm run job:daily
 */
import { runDailyDelivery } from "../src/server/jobs/daily-delivery";
import { prisma } from "../src/lib/db";

runDailyDelivery()
  .then((summary) => console.log("✓ daily delivery", summary))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

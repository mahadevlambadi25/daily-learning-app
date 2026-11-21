/**
 * Grants the admin role to an existing account (there is no public admin sign-up).
 *   npm run admin:create -- someone@example.com
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error("Usage: npm run admin:create -- <email of an existing account>");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account found for ${email}. Ask them to sign up first.`);
  await prisma.role.upsert({
    where: { userId_role: { userId: user.id, role: "admin" } },
    create: { userId: user.id, role: "admin" },
    update: {},
  });
  console.log(`✓ ${email} is now an admin`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

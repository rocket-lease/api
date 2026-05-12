/**
 * One-shot data fix: copy auth.users.email_confirmed_at into public.users.email_verified_at
 * for users registered before US-05.
 *
 * Run: pnpm exec ts-node scripts/backfill-email-verified.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$executeRawUnsafe(`
      UPDATE public.users u
      SET email_verified_at = a.email_confirmed_at
      FROM auth.users a
      WHERE u.id = a.id::text
        AND a.email_confirmed_at IS NOT NULL
        AND u.email_verified_at IS NULL
    `);
    console.log(`Backfilled email_verified_at for ${result} user(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

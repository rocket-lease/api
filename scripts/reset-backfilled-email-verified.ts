/**
 * Reset email_verified_at to NULL for backfilled users (identified by placeholder dni).
 * Forces them to pass through OTP verification like a fresh registration.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.user.updateMany({
      where: { dni: '00000000', emailVerifiedAt: { not: null } },
      data: { emailVerifiedAt: null },
    });
    console.log(`Reset emailVerifiedAt for ${result.count} backfilled user(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

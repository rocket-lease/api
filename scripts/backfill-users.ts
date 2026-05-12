/**
 * Backfill: for every user in auth.users without a row in public.users,
 * insert a placeholder row with email + name (from metadata) + dni/phone placeholders.
 * Users should edit their profile afterwards to set real dni and phone.
 *
 * Run: pnpm exec ts-node -r tsconfig-paths/register scripts/backfill-users.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const PLACEHOLDER_DNI = '00000000';
const PLACEHOLDER_PHONE = '0000000000';

interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  raw_user_meta_data?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

async function fetchAuthUsers(): Promise<AuthUser[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE env vars');
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=500`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const data = (await res.json()) as { users: AuthUser[] };
  return data.users ?? [];
}

function deriveName(u: AuthUser): string {
  const meta = (u.user_metadata ?? u.raw_user_meta_data ?? {}) as Record<
    string,
    unknown
  >;
  const candidates = [
    meta.full_name,
    meta.fullName,
    meta.name,
    meta.display_name,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return u.email.split('@')[0] || 'Usuario';
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const authUsers = await fetchAuthUsers();
    const existing = await prisma.user.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((u) => u.id));
    const toInsert = authUsers.filter((u) => !existingIds.has(u.id));

    console.log(`Found ${authUsers.length} auth users, ${toInsert.length} missing in public.users`);
    let inserted = 0;
    for (const u of toInsert) {
      const name = deriveName(u);
      try {
        await prisma.user.create({
          data: {
            id: u.id,
            name,
            email: u.email,
            dni: PLACEHOLDER_DNI,
            phone: PLACEHOLDER_PHONE,
            emailVerifiedAt: u.email_confirmed_at
              ? new Date(u.email_confirmed_at)
              : null,
          },
        });
        inserted++;
        console.log(`+ ${u.email}  name="${name}"`);
      } catch (err) {
        console.error(`! failed ${u.email}:`, err instanceof Error ? err.message : err);
      }
    }
    console.log(`Done. Inserted ${inserted}/${toInsert.length}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

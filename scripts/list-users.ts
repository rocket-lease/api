import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env')

  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const data: { users: Array<{ id: string; email: string; created_at: string; email_confirmed_at: string | null }> } = await res.json()

  const publicUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true },
  })
  const publicById = new Map(publicUsers.map((u) => [u.id, u]))

  console.log('id\temail\tin_auth\tin_public\temail_confirmed\tphone_verified\tname')
  const authIds = new Set<string>()
  for (const u of data.users) {
    authIds.add(u.id)
    const pub = publicById.get(u.id)
    console.log([
      u.id,
      u.email,
      'yes',
      pub ? 'yes' : 'NO',
      u.email_confirmed_at ? 'yes' : 'no',
      pub?.phoneVerifiedAt ? 'yes' : 'no',
      pub?.name ?? '-',
    ].join('\t'))
  }
  for (const p of publicUsers) {
    if (!authIds.has(p.id)) {
      console.log([p.id, p.email, 'NO', 'yes', '-', p.phoneVerifiedAt ? 'yes' : 'no', p.name].join('\t'))
    }
  }
  await prisma.$disconnect()
}
main().catch(console.error)

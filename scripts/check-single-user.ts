import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
async function main() {
  const prisma = new PrismaClient()
  const u = await prisma.user.findUnique({ where: { id: '7f92e1e2-13d4-46ed-b850-cd2449dac145' } })
  console.log('public.users row:', u)
  const all = await prisma.user.count()
  console.log('total public.users:', all)
  await prisma.$disconnect()
}
main().catch(console.error)

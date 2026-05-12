import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
async function main() {
  const prisma = new PrismaClient()
  const u = await prisma.user.findUnique({ where: { id: 'd42e4f40-2bca-44bb-ac29-c8e33be16ba8' } })
  console.log('user row:', u)
  await prisma.$disconnect()
}
main().catch(console.error)

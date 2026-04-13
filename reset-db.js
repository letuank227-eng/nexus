const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.otpCode.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.message.deleteMany()
  await prisma.task.deleteMany()
  await prisma.roomMember.deleteMany()
  await prisma.room.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
  console.log('Đã xóa toàn bộ dữ liệu thành công!')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

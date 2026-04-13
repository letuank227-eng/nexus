const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create users
  const password = await bcrypt.hash('password123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@nexus.com' },
    update: {},
    create: { name: 'Admin Nexus', email: 'admin@nexus.com', password, role: 'admin' }
  })

  const user1 = await prisma.user.upsert({
    where: { email: 'user@nexus.com' },
    update: {},
    create: { name: 'Nguyễn Văn An', email: 'user@nexus.com', password }
  })

  const user2 = await prisma.user.upsert({
    where: { email: 'trang@nexus.com' },
    update: {},
    create: { name: 'Trần Thị Trang', email: 'trang@nexus.com', password }
  })

  const user3 = await prisma.user.upsert({
    where: { email: 'minh@nexus.com' },
    update: {},
    create: { name: 'Lê Minh Tuấn', email: 'minh@nexus.com', password }
  })

  // Create rooms
  const general = await prisma.room.upsert({
    where: { id: 'room-general' },
    update: {},
    create: { id: 'room-general', name: 'general', description: 'Kênh thảo luận chung' }
  })

  const dev = await prisma.room.upsert({
    where: { id: 'room-dev' },
    update: {},
    create: { id: 'room-dev', name: 'dev-team', description: 'Thảo luận kỹ thuật' }
  })

  const design = await prisma.room.upsert({
    where: { id: 'room-design' },
    update: {},
    create: { id: 'room-design', name: 'design', description: 'UI/UX và thiết kế' }
  })

  const marketing = await prisma.room.upsert({
    where: { id: 'room-marketing' },
    update: {},
    create: { id: 'room-marketing', name: 'marketing', description: 'Chiến lược marketing' }
  })

  // Add members
  const allRooms = [general, dev, design, marketing]
  const allUsers = [admin, user1, user2, user3]

  for (const room of allRooms) {
    for (const user of allUsers) {
      await prisma.roomMember.upsert({
        where: { userId_roomId: { userId: user.id, roomId: room.id } },
        update: {},
        create: { userId: user.id, roomId: room.id, role: user.id === admin.id ? 'admin' : 'member' }
      })
    }
  }

  // Seed messages
  const msgs = [
    { content: 'Chào mọi người! 👋 Chào mừng đến với Nexus!', senderId: admin.id, roomId: general.id },
    { content: 'Xin chào! Rất vui được làm việc cùng team 🎉', senderId: user1.id, roomId: general.id },
    { content: 'Tính năng mới đã hoàn thành, anh em review giúp nhé!', senderId: user2.id, roomId: dev.id },
    { content: 'OK mình sẽ review trong hôm nay', senderId: admin.id, roomId: dev.id },
    { content: 'Mockup trang landing page đã xong, cần feedback', senderId: user3.id, roomId: design.id },
  ]

  for (const msg of msgs) {
    await prisma.message.create({ data: { ...msg, type: 'text' } })
  }

  // Seed tasks
  const tasks = [
    { title: 'Thiết kế landing page mới', priority: 'high', status: 'doing', assignedTo: user3.id, createdBy: admin.id, description: 'Redesign toàn bộ landing page theo brand mới', deadline: new Date(Date.now() + 3 * 86400000) },
    { title: 'Fix bug đăng nhập mobile', priority: 'urgent', status: 'todo', assignedTo: user1.id, createdBy: admin.id, description: 'Bug crash app khi đăng nhập trên iOS 17' },
    { title: 'Viết unit test cho API', priority: 'medium', status: 'todo', assignedTo: user1.id, createdBy: admin.id, deadline: new Date(Date.now() + 7 * 86400000) },
    { title: 'Cập nhật tài liệu API', priority: 'low', status: 'done', assignedTo: user2.id, createdBy: admin.id },
    { title: 'Triển khai CI/CD pipeline', priority: 'high', status: 'doing', assignedTo: admin.id, createdBy: admin.id, description: 'Setup GitHub Actions cho auto deploy', deadline: new Date(Date.now() + 5 * 86400000) },
    { title: 'Phân tích báo cáo Q1', priority: 'medium', status: 'done', assignedTo: user2.id, createdBy: admin.id },
    { title: 'Tích hợp thanh toán Momo', priority: 'high', status: 'todo', assignedTo: user1.id, createdBy: admin.id, deadline: new Date(Date.now() + 14 * 86400000) },
    { title: 'Tối ưu hiệu suất database', priority: 'medium', status: 'doing', assignedTo: admin.id, createdBy: admin.id },
  ]

  for (const task of tasks) {
    await prisma.task.create({ data: task })
  }

  console.log('✅ Seed completed!')
  console.log('📧 Accounts: admin@nexus.com / user@nexus.com / trang@nexus.com / minh@nexus.com')
  console.log('🔑 Password: password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())

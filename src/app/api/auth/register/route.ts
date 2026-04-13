import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, phone, companyCode } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 400 })
    }

    // Check phone uniqueness
    const normalizedPhone = phone?.trim() || null
    if (normalizedPhone) {
      // Normalize: remove spaces/dashes
      const cleaned = normalizedPhone.replace(/[\s\-]/g, '')
      const existingPhone = await prisma.user.findUnique({ where: { phone: cleaned } })
      if (existingPhone) {
        return NextResponse.json({ error: 'Số điện thoại này đã được đăng ký. Mỗi SĐT chỉ được dùng cho 1 tài khoản.' }, { status: 400 })
      }
    }

    const hashed = await bcrypt.hash(password, 12)
    const normalizedCode = companyCode?.trim().toUpperCase() || null
    const cleanedPhone = normalizedPhone ? normalizedPhone.replace(/[\s\-]/g, '') : null

    const user = await prisma.user.create({
      data: { name, email, password: hashed, phone: cleanedPhone, companyCode: normalizedCode }
    })

    // If user has companyCode, auto-join all non-private rooms of that company
    if (normalizedCode) {
      const companyRooms = await prisma.room.findMany({
        where: { companyCode: normalizedCode, isPrivate: false }
      })

      if (companyRooms.length === 0) {
        // First user of this company — create default rooms
        const general = await prisma.room.create({
          data: { name: 'general', description: 'Kênh chung cho toàn công ty', companyCode: normalizedCode }
        })
        await prisma.roomMember.create({ data: { userId: user.id, roomId: general.id, role: 'admin' } })

        const announcements = await prisma.room.create({
          data: { name: 'announcements', description: 'Thông báo nội bộ', companyCode: normalizedCode }
        })
        await prisma.roomMember.create({ data: { userId: user.id, roomId: announcements.id, role: 'admin' } })
      } else {
        // Add to all existing public rooms of company
        for (const room of companyRooms) {
          await prisma.roomMember.create({ data: { userId: user.id, roomId: room.id } }).catch(() => {})
        }
      }
    } else {
      // No company code — backward compat: join global public rooms
      const publicRooms = await prisma.room.findMany({ where: { isPrivate: false, companyCode: null } })
      if (publicRooms.length === 0) {
        const general = await prisma.room.create({ data: { name: 'general', description: 'Kênh chung' } })
        await prisma.roomMember.create({ data: { userId: user.id, roomId: general.id, role: 'admin' } })
      } else {
        for (const room of publicRooms) {
          await prisma.roomMember.create({ data: { userId: user.id, roomId: room.id } }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

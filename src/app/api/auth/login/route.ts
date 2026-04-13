import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 })
    }

    // Delete old sessions
    await prisma.session.deleteMany({ where: { userId: user.id } })

    // Create new session
    const token = uuidv4()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await prisma.session.create({ data: { userId: user.id, token, expiresAt } })

    // Update user status
    await prisma.user.update({ where: { id: user.id }, data: { status: 'online' } })

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role }
    })
    response.cookies.set('nexus_token', token, {
      httpOnly: true,
      expires: expiresAt,
      sameSite: 'lax',
      path: '/'
    })
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

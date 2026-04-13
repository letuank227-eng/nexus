import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, role: user.role, companyPosition: (user as { companyPosition?: string }).companyPosition || 'member', status: user.status, companyCode: user.companyCode } })
}

export async function POST(request: NextRequest) {
  // Logout
  const token = request.cookies.get('nexus_token')?.value
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
  }
  const response = NextResponse.json({ success: true })
  response.cookies.delete('nexus_token')
  return response
}

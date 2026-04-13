import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

type FullUser = { id: string; name: string; email: string; companyCode?: string | null; companyPosition?: string; role: string }

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request) as FullUser | null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isDirector = user.companyPosition === 'director'

  const rooms = await prisma.room.findMany({
    where: isDirector
      ? (user.companyCode ? { companyCode: user.companyCode } : {})
      : { members: { some: { userId: user.id } } },
    include: {
      members: {
        where: isDirector ? {} : { isHidden: false },
        include: { user: { select: { id: true, name: true, avatar: true, status: true } } }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, name: true } } }
      },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json({ rooms, isDirector })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request) as FullUser | null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, type, memberIds, isPrivate, roomCode } = await request.json()

  if (!name?.trim()) return NextResponse.json({ error: 'Tên nhóm là bắt buộc' }, { status: 400 })
  if (!roomCode?.trim()) return NextResponse.json({ error: 'Mã nhóm là bắt buộc' }, { status: 400 })

  const code = roomCode.trim().toUpperCase()

  const existing = await prisma.room.findFirst({
    where: { roomCode: code, ...(user.companyCode ? { companyCode: user.companyCode } : {}) }
  })
  if (existing) return NextResponse.json({ error: 'Mã nhóm đã được sử dụng. Vui lòng chọn mã khác.' }, { status: 400 })

  const room = await prisma.room.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      type: type || 'channel',
      isPrivate: isPrivate || false,
      companyCode: user.companyCode || null,
      roomCode: code,
      members: {
        create: [
          { userId: user.id, role: 'admin', position: user.companyPosition || 'member' },
          ...(memberIds || []).filter((id: string) => id !== user.id).map((id: string) => ({ userId: id }))
        ]
      }
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatar: true, status: true } } } },
      messages: { take: 0 },
      _count: { select: { messages: true } }
    }
  })

  return NextResponse.json({ room })
}

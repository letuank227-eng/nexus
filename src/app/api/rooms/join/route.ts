import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

type FullUser = { id: string; name: string; companyCode?: string | null; companyPosition?: string }

const ROOM_INCLUDE = {
  members: {
    where: { isHidden: false },
    include: { user: { select: { id: true, name: true, avatar: true, status: true } } }
  },
  messages: { orderBy: { createdAt: 'desc' } as const, take: 1, include: { sender: { select: { id: true, name: true } } } },
  _count: { select: { messages: true } }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request) as FullUser | null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isDirector = user.companyPosition === 'director'
  const body = await request.json()
  const { roomCode, directAccess } = body

  // ── Giám đốc truy cập trực tiếp theo roomId (bypass PIN) ──
  if (isDirector && directAccess) {
    const room = await prisma.room.findFirst({
      where: { id: directAccess, ...(user.companyCode ? { companyCode: user.companyCode } : {}) },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true, status: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, name: true } } } },
        _count: { select: { messages: true } }
      }
    })
    if (!room) return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 })

    const existing = await prisma.roomMember.findFirst({ where: { roomId: room.id, userId: user.id } })
    if (!existing) {
      await prisma.roomMember.create({
        data: { userId: user.id, roomId: room.id, role: 'admin', position: 'director', isHidden: true }
      })
    }
    return NextResponse.json({ room, joined: !existing, alreadyMember: !!existing })
  }

  // ── Tham gia thường qua mã PIN ──
  if (!roomCode?.trim()) return NextResponse.json({ error: 'Vui lòng nhập mã nhóm' }, { status: 400 })

  const code = roomCode.trim().toUpperCase()
  const room = await prisma.room.findFirst({
    where: { roomCode: code, ...(user.companyCode ? { companyCode: user.companyCode } : {}) },
    include: ROOM_INCLUDE
  })

  if (!room) return NextResponse.json({ error: 'Mã nhóm không đúng hoặc không tồn tại trong công ty bạn.' }, { status: 404 })

  const isMember = await prisma.roomMember.findFirst({ where: { roomId: room.id, userId: user.id } })
  if (isMember) return NextResponse.json({ room, alreadyMember: true })

  await prisma.roomMember.create({
    data: { userId: user.id, roomId: room.id, position: user.companyPosition || 'member' }
  })

  // Refetch with new member included
  const updatedRoom = await prisma.room.findUnique({ where: { id: room.id }, include: ROOM_INCLUDE })
  return NextResponse.json({ room: updatedRoom, joined: true })
}

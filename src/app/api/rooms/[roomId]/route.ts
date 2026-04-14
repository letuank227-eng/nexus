import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

// GET /api/rooms/[roomId] - Get room details
export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const room = await prisma.room.findFirst({
    where: { id: roomId, members: { some: { userId: user.id } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatar: true, status: true } } }
      }
    }
  })

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json({ room })
}

// PATCH /api/rooms/[roomId] - Update room settings (admin only)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if user is admin of this room
  const membership = await prisma.roomMember.findFirst({
    where: { roomId, userId: user.id, role: 'admin' }
  })
  if (!membership) return NextResponse.json({ error: 'Chỉ quản lý mới có thể chỉnh sửa nhóm' }, { status: 403 })

  const body = await request.json()
  const { name, description, avatar, themeColor, fontStyle, roomCode } = body

  const updateData: Record<string, string> = {}
  if (name?.trim()) updateData.name = name.trim()
  if (description !== undefined) updateData.description = description?.trim() || ''
  if (avatar !== undefined) updateData.avatar = avatar || ''
  if (themeColor !== undefined) updateData.themeColor = themeColor || ''
  if (fontStyle !== undefined) updateData.fontStyle = fontStyle || ''
  if (roomCode?.trim()) updateData.roomCode = roomCode.trim().toUpperCase().slice(0, 12)


  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Không có thông tin nào để cập nhật' }, { status: 400 })
  }

  try {
    const room = await prisma.room.update({
      where: { id: roomId },
      data: updateData,
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatar: true, status: true } } }
        }
      }
    })
    return NextResponse.json({ room })
  } catch {
    return NextResponse.json({ error: 'Cập nhật thất bại' }, { status: 500 })
  }
}

// DELETE /api/rooms/[roomId] - Delete room (admin only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.roomMember.findFirst({
    where: { roomId, userId: user.id, role: 'admin' }
  })
  if (!membership) return NextResponse.json({ error: 'Chỉ quản lý mới có thể xóa nhóm' }, { status: 403 })

  try {
    await prisma.message.deleteMany({ where: { roomId } })
    await prisma.roomMember.deleteMany({ where: { roomId } })
    await prisma.room.delete({ where: { id: roomId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Xóa thất bại' }, { status: 500 })
  }
}

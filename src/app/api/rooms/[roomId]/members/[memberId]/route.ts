import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

const POSITIONS = ['director', 'manager', 'leader', 'member']

type Params = { params: Promise<{ roomId: string; memberId: string }> }

// PATCH /api/rooms/[roomId]/members/[memberId] — thay đổi role hoặc chức vụ
export async function PATCH(request: NextRequest, { params }: Params) {
  const { roomId, memberId } = await params
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requester = await prisma.roomMember.findFirst({
    where: { roomId, userId: user.id }
  })
  if (!requester || (requester.role !== 'admin' && requester.position !== 'director')) {
    return NextResponse.json({ error: 'Chỉ quản lý mới có quyền này' }, { status: 403 })
  }

  if (memberId === user.id) {
    return NextResponse.json({ error: 'Không thể thay đổi quyền của chính mình' }, { status: 400 })
  }

  const body = await request.json()
  const { role, position } = body

  if (role && !['admin', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Role không hợp lệ' }, { status: 400 })
  }
  if (position && !POSITIONS.includes(position)) {
    return NextResponse.json({ error: 'Chức vụ không hợp lệ' }, { status: 400 })
  }

  const target = await prisma.roomMember.findFirst({ where: { roomId, userId: memberId } })
  if (!target) return NextResponse.json({ error: 'Thành viên không tồn tại' }, { status: 404 })

  // Chỉ director mới được gán / thay đổi chức vụ director
  if (position === 'director' && requester.position !== 'director') {
    return NextResponse.json({ error: 'Chỉ Giám đốc mới có thể gán chức vụ Giám đốc' }, { status: 403 })
  }

  const updateData: { role?: string; position?: string; isHidden?: boolean } = {}
  if (role) updateData.role = role
  if (position) {
    updateData.position = position
    // Khi thăng lên director, tự động set isHidden=true (stealth)
    if (position === 'director') updateData.isHidden = true
    else updateData.isHidden = false
  }

  const updated = await prisma.roomMember.update({
    where: { id: target.id },
    data: updateData,
    include: { user: { select: { id: true, name: true, avatar: true, status: true } } }
  })

  // Đồng bộ companyPosition trên User nếu là đổi chức vụ
  if (position) {
    await prisma.user.update({
      where: { id: memberId },
      data: { companyPosition: position }
    })
  }

  return NextResponse.json({ member: updated })
}

// DELETE /api/rooms/[roomId]/members/[memberId] — Kick thành viên
export async function DELETE(request: NextRequest, { params }: Params) {
  const { roomId, memberId } = await params
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requester = await prisma.roomMember.findFirst({
    where: { roomId, userId: user.id }
  })
  if (!requester || (requester.role !== 'admin' && requester.position !== 'director')) {
    return NextResponse.json({ error: 'Chỉ quản lý mới có quyền kick' }, { status: 403 })
  }

  if (memberId === user.id) {
    return NextResponse.json({ error: 'Không thể tự kick chính mình' }, { status: 400 })
  }

  const target = await prisma.roomMember.findFirst({ where: { roomId, userId: memberId } })
  if (!target) return NextResponse.json({ error: 'Thành viên không tồn tại' }, { status: 404 })

  // Không kick director (trừ khi người kick cũng là director)
  if (target.position === 'director' && requester.position !== 'director') {
    return NextResponse.json({ error: 'Không thể kick Giám đốc' }, { status: 403 })
  }

  await prisma.roomMember.delete({ where: { id: target.id } })
  return NextResponse.json({ success: true, removedUserId: memberId })
}

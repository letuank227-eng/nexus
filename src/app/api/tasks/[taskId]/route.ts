import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await params
  const body = await request.json()

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.deadline !== undefined && { deadline: body.deadline ? new Date(body.deadline) : null }),
      ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
      ...(body.order !== undefined && { order: body.order }),
    },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      creator: { select: { id: true, name: true } }
    }
  })

  return NextResponse.json({ task })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await params
  await prisma.task.delete({ where: { id: taskId } })
  return NextResponse.json({ success: true })
}

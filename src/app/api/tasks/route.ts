import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')

  // If user has companyCode: show all tasks of the company
  const where = roomId
    ? { roomId }
    : user.companyCode
      ? { OR: [{ companyCode: user.companyCode }, { createdBy: user.id }] }
      : { OR: [{ assignedTo: user.id }, { createdBy: user.id }] }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      creator: { select: { id: true, name: true } }
    },
    orderBy: [{ status: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }]
  })

  return NextResponse.json({ tasks })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, status, priority, deadline, assignedTo, roomId } = await request.json()

  const task = await prisma.task.create({
    data: {
      title, description, status: status || 'todo',
      priority: priority || 'medium',
      deadline: deadline ? new Date(deadline) : null,
      assignedTo, createdBy: user.id, roomId,
      companyCode: user.companyCode || null
    },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      creator: { select: { id: true, name: true } }
    }
  })

  return NextResponse.json({ task })
}

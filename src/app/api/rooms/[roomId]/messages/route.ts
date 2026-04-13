import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId } = await params
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = 50

  const messages = await prisma.message.findMany({
    where: { roomId },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
  })

  return NextResponse.json({ messages: messages.reverse() })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId } = await params
  const { content, type, fileUrl, fileName } = await request.json()

  const message = await prisma.message.create({
    data: { content, type: type || 'text', fileUrl, fileName, senderId: user.id, roomId },
    include: { sender: { select: { id: true, name: true, avatar: true } } }
  })

  await prisma.room.update({ where: { id: roomId }, data: { updatedAt: new Date() } })

  return NextResponse.json({ message })
}

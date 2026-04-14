import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, avatar } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Tên không được để trống' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: name.trim(),
      ...(avatar !== undefined ? { avatar } : {}),
    },
    select: { id: true, name: true, email: true, phone: true, avatar: true, role: true, companyPosition: true, status: true, companyCode: true }
  })

  return NextResponse.json({ user: updated })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // If user belongs to a company, show all company members
  const where = user.companyCode
    ? { id: { not: user.id }, companyCode: user.companyCode }
    : { id: { not: user.id } }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true, avatar: true, status: true, role: true, companyCode: true },
    orderBy: { name: 'asc' }
  })

  return NextResponse.json({ users })
}

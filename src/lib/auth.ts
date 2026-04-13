import { NextRequest } from 'next/server'
import { prisma } from './prisma'

export async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get('nexus_token')?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return null
  return session.user
}

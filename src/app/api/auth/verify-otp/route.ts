import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function normalizePhone(phone: string): string {
  const stripped = phone.replace(/\D/g, '')
  if (stripped.startsWith('0')) return '+84' + stripped.slice(1)
  if (stripped.startsWith('84')) return '+' + stripped
  return '+84' + stripped
}

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json()

    if (!phone || !code) {
      return NextResponse.json({ error: 'Thiếu thông tin xác thực' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone.trim())

    // Find latest valid OTP for this phone
    const otp = await prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        code: code.trim(),
        used: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!otp) {
      // Check if OTP exists but expired
      const expired = await prisma.otpCode.findFirst({
        where: { phone: normalizedPhone, code: code.trim(), used: false }
      })
      if (expired) {
        return NextResponse.json({ error: 'Mã OTP đã hết hạn. Vui lòng gửi lại.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Mã OTP không đúng. Vui lòng kiểm tra lại.' }, { status: 400 })
    }

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true }
    })

    return NextResponse.json({
      success: true,
      verified: true,
      phone: normalizedPhone,
      message: 'Xác thực số điện thoại thành công!'
    })
  } catch (error) {
    console.error('[OTP Verify Error]', error)
    return NextResponse.json({ error: 'Lỗi server khi xác thực OTP' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Format Vietnamese phone number
function normalizePhone(phone: string): string {
  const stripped = phone.replace(/\D/g, '')
  if (stripped.startsWith('0')) return '+84' + stripped.slice(1)
  if (stripped.startsWith('84')) return '+' + stripped
  return '+84' + stripped
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone || phone.trim().length < 9) {
      return NextResponse.json({ error: 'Số điện thoại không hợp lệ' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone.trim())

    // Invalidate old OTPs for this phone
    await prisma.otpCode.updateMany({
      where: { phone: normalizedPhone, used: false },
      data: { used: true }
    })

    // Generate new OTP (expires in 5 minutes)
    const code = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await prisma.otpCode.create({
      data: { phone: normalizedPhone, code, expiresAt }
    })

    // ── SEND SMS ──────────────────────────────────────────────────────────
    // In production, integrate a real SMS provider here.
    // Examples:
    //   Twilio: client.messages.create({ body: `Mã OTP: ${code}`, from: TWILIO_NUM, to: normalizedPhone })
    //   ESMS:   fetch(`https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/`, ...)
    //   SpeedSMS: fetch(`https://api.speedsms.vn/index.php/sms/send`, ...)
    //
    // For now: DEV mode returns OTP in response (remove in production!)
    // ─────────────────────────────────────────────────────────────────────

    const isDev = process.env.NODE_ENV !== 'production'

    console.log(`[OTP] Phone: ${normalizedPhone} → Code: ${code} (expires ${expiresAt.toISOString()})`)

    return NextResponse.json({
      success: true,
      message: `Mã OTP đã được gửi đến ${phone}`,
      expiresIn: 300, // 5 minutes in seconds
      // DEV ONLY — remove in production:
      ...(isDev && { devOtp: code, devNote: 'Chỉ hiện trong môi trường phát triển' })
    })
  } catch (error) {
    console.error('[OTP Send Error]', error)
    return NextResponse.json({ error: 'Lỗi server khi gửi OTP' }, { status: 500 })
  }
}

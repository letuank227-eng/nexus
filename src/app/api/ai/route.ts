import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const MODEL = 'gemini-2.0-flash'

async function callGemini(systemPrompt: string, userPrompt: string, maxTokens = 512): Promise<string> {
  if (!process.env.GEMINI_API_KEY) throw new Error('Chưa cấu hình GEMINI_API_KEY')

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
      responseMimeType: 'text/plain',
    },
  })

  const result = await model.generateContent(userPrompt)
  return result.response.text()
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, roomId, messageText, question, context } = body

  try {
    // ── 1. AI TÓM TẮT CUỘC TRÒ CHUYỆN ──────────────────────
    if (action === 'summarize') {
      if (!roomId) return NextResponse.json({ error: 'Thiếu roomId' }, { status: 400 })

      const messages = await prisma.message.findMany({
        where: { roomId, type: 'text' },
        orderBy: { createdAt: 'desc' },
        take: 60,
        include: { sender: { select: { name: true } } }
      })

      if (messages.length === 0) {
        return NextResponse.json({ summary: 'Nhóm chưa có tin nhắn nào để tóm tắt.' })
      }

      const chatContext = messages.reverse().map(m => `${m.sender.name}: ${m.content}`).join('\n')

      const summary = await callGemini(
        `Bạn là Nexus AI, trợ lý thông minh tích hợp trong ứng dụng quản lý công ty tại Việt Nam.
Nhiệm vụ: Tóm tắt cuộc trò chuyện nhóm nội bộ một cách súc tích và hữu ích.
Quy tắc:
- Viết hoàn toàn bằng tiếng Việt, tự nhiên và chuyên nghiệp
- Liệt kê 3-5 điểm chính với emoji phù hợp
- Nêu bật: chủ đề thảo luận, quyết định đã đưa ra, hành động tiếp theo (nếu có)
- Cuối cùng: 1 câu đề xuất hành động ưu tiên nhất`,
        `Tóm tắt cuộc trò chuyện này:\n\n${chatContext}`,
        400
      )

      return NextResponse.json({ summary })
    }

    // ── 2. AI TẠO TASK TỪ TIN NHẮN ──────────────────────────
    if (action === 'create-task') {
      if (!messageText) return NextResponse.json({ error: 'Thiếu nội dung' }, { status: 400 })

      const result = await callGemini(
        `Bạn là AI trích xuất công việc từ văn bản. Phân tích và trả về JSON thuần túy (không markdown, không code block):
{
  "title": "Tiêu đề task ngắn gọn, rõ ràng (tối đa 60 ký tự)",
  "description": "Mô tả chi tiết cách thực hiện",
  "priority": "urgent|high|medium|low",
  "deadline": "YYYY-MM-DD hoặc null"
}
Chỉ trả về JSON, không thêm bất kỳ text nào khác.`,
        `Trích xuất task từ nội dung: "${messageText}"`,
        200
      )

      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch?.[0] || result)
        return NextResponse.json({ task: parsed })
      } catch {
        return NextResponse.json({
          task: { title: messageText.slice(0, 60), priority: 'medium', description: '', deadline: null }
        })
      }
    }

    // ── 3. AI NHẮC DEADLINE ──────────────────────────────────
    if (action === 'deadline-analysis') {
      const tasks = await prisma.task.findMany({
        where: { companyCode: user.companyCode, status: { not: 'done' } },
        include: { assignee: { select: { name: true } } },
        orderBy: { deadline: 'asc' }
      })

      if (tasks.length === 0) {
        return NextResponse.json({ analysis: '✅ Không có công việc nào đang chờ xử lý.' })
      }

      const now = new Date()
      const taskContext = tasks.map(t => {
        const dl = t.deadline ? new Date(t.deadline) : null
        const daysLeft = dl ? Math.ceil((dl.getTime() - now.getTime()) / 86400000) : null
        return `• "${t.title}" [${t.priority === 'urgent' ? 'Khẩn cấp' : t.priority === 'high' ? 'Cao' : t.priority === 'medium' ? 'Trung bình' : 'Thấp'}] — ${t.assignee?.name || 'Chưa giao'} — ${
          daysLeft === null ? 'Không có deadline'
          : daysLeft < 0 ? `⚠️ QUÁ HẠN ${Math.abs(daysLeft)} ngày`
          : daysLeft === 0 ? '🔴 Hôm nay là deadline!'
          : daysLeft <= 2 ? `🟠 Còn ${daysLeft} ngày (gấp)`
          : `🟡 Còn ${daysLeft} ngày`
        }`
      }).join('\n')

      const analysis = await callGemini(
        `Bạn là Nexus AI quản lý deadline cho đội nhóm nội bộ Việt Nam.
Phân tích danh sách task và đưa ra báo cáo ngắn gọn với:
1. 🚨 Cảnh báo: task quá hạn hoặc sắp hết hạn (cần xử lý ngay)
2. 📋 Tổng quan: tình hình chung của nhóm
3. 💡 Đề xuất: 2-3 hành động ưu tiên cụ thể
Viết bằng tiếng Việt, súc tích, thực tế.`,
        `Phân tích deadline các task sau:\n${taskContext}`,
        350
      )

      return NextResponse.json({ analysis })
    }

    // ── 4. AI ĐÁNH GIÁ HIỆU SUẤT ────────────────────────────
    if (action === 'performance') {
      const tasks = await prisma.task.findMany({
        where: { companyCode: user.companyCode },
        include: {
          assignee: { select: { id: true, name: true } },
        }
      })

      const members = await prisma.user.findMany({
        where: { companyCode: user.companyCode },
        select: { id: true, name: true }
      })

      const stats = members.map(u => {
        const assigned = tasks.filter(t => t.assigneeId === u.id)
        const done = assigned.filter(t => t.status === 'done').length
        const doing = assigned.filter(t => t.status === 'doing').length
        const overdue = assigned.filter(t =>
          t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done'
        ).length
        const rate = assigned.length > 0 ? Math.round(done / assigned.length * 100) : 0
        return { name: u.name, total: assigned.length, done, doing, overdue, rate }
      }).filter(u => u.total > 0)

      if (stats.length === 0) {
        return NextResponse.json({ evaluation: '📊 Chưa có dữ liệu task để đánh giá.', stats: [] })
      }

      const statsText = stats.map(u =>
        `• ${u.name}: ${u.total} task | ${u.done} hoàn thành (${u.rate}%) | ${u.doing} đang làm | ${u.overdue} trễ hạn`
      ).join('\n')

      const evaluation = await callGemini(
        `Bạn là Nexus AI đánh giá hiệu suất nhân sự cho đội nhóm nội bộ Việt Nam.
Dựa trên dữ liệu task, tạo báo cáo đánh giá với:
1. 🏆 Ghi nhận thành viên nổi bật (nếu có)
2. 📊 Nhận xét tổng quan nhóm (1-2 câu)
3. 🎯 Thành viên cần hỗ trợ thêm (nếu có, nêu tên cụ thể)
4. 💡 2-3 đề xuất cải thiện hiệu suất nhóm
Giọng văn: tích cực, xây dựng, chuyên nghiệp. Viết bằng tiếng Việt.`,
        `Dữ liệu hiệu suất team:\n${statsText}`,
        450
      )

      return NextResponse.json({ evaluation, stats })
    }

    // ── 5. AI CHAT ASSISTANT (/ai command) ───────────────────
    if (action === 'chat') {
      const q = question || messageText
      if (!q) return NextResponse.json({ error: 'Thiếu câu hỏi' }, { status: 400 })

      const answer = await callGemini(
        `Bạn là Nexus AI — trợ lý thông minh tích hợp trong ứng dụng cộng tác nội bộ của doanh nghiệp Việt Nam.
Vai trò: Hỗ trợ đội nhóm về công việc, quản lý dự án, giao tiếp nội bộ.
Quy tắc:
- Trả lời hoàn toàn bằng tiếng Việt, tự nhiên như người Việt
- Ngắn gọn, trực tiếp, hữu ích
- Nếu liên quan đến task/deadline/nhóm: đưa ra gợi ý cụ thể
- Không dùng markdown phức tạp trong câu trả lời chat
${context ? `Ngữ cảnh hiện tại: ${context}` : ''}`,
        q,
        300
      )

      return NextResponse.json({ answer })
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })

  } catch (err) {
    console.error('[AI Error]', err)
    const msg = (err as Error).message
    // Friendly error messages
    if (msg.includes('API_KEY')) return NextResponse.json({ error: 'Lỗi xác thực API key Gemini' }, { status: 500 })
    if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) return NextResponse.json({ error: 'Đã hết quota Gemini hôm nay, thử lại sau' }, { status: 429 })
    return NextResponse.json({ error: 'AI tạm thời không khả dụng: ' + msg }, { status: 500 })
  }
}

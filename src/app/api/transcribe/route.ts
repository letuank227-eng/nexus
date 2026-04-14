import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { join } from 'path'
import { readFile } from 'fs/promises'

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audioUrl } = await req.json()
  if (!audioUrl) return NextResponse.json({ error: 'Thiếu đường dẫn audio' }, { status: 400 })

  const groqKey = process.env.GROQ_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!groqKey && !openaiKey) {
    return NextResponse.json({
      error: 'Chưa cấu hình API key. Thêm GROQ_API_KEY=... vào file .env và restart server.'
    }, { status: 503 })
  }

  // ── Read audio file from local uploads directory ──
  let audioBuffer: Buffer
  try {
    if (audioUrl.startsWith('/uploads/')) {
      const localPath = join(process.cwd(), 'public', audioUrl)
      audioBuffer = await readFile(localPath)
    } else {
      const resp = await fetch(audioUrl)
      if (!resp.ok) throw new Error('Cannot fetch audio')
      audioBuffer = Buffer.from(await resp.arrayBuffer())
    }
  } catch (e) {
    return NextResponse.json({ error: 'Không thể đọc file audio: ' + (e as Error).message }, { status: 400 })
  }

  // ── Determine mime type from filename ──
  const filename = audioUrl.split('/').pop() || 'audio.webm'
  const ext = filename.split('.').pop()?.toLowerCase() || 'webm'
  const mimeMap: Record<string, string> = {
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    mp4: 'audio/mp4',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    aac: 'audio/aac',
  }
  const mimeType = mimeMap[ext] || 'audio/webm'

  // ── Call Groq Whisper (preferred) or OpenAI Whisper ──
  const useGroq = !!groqKey
  const apiUrl = useGroq
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions'
  const apiKey = groqKey || openaiKey
  const model = useGroq ? 'whisper-large-v3' : 'whisper-1'

  try {
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename)
    formData.append('model', model)
    formData.append('language', 'vi')           // Vietnamese — faster & more accurate when specified
    formData.append('response_format', 'json')

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('Transcription API error:', errText)
      return NextResponse.json({ error: 'Transcription thất bại: ' + errText.slice(0, 200) }, { status: 500 })
    }

    const data = await resp.json()
    return NextResponse.json({ text: data.text, model })
  } catch (e) {
    console.error('Transcription fetch error:', e)
    return NextResponse.json({ error: 'Lỗi kết nối API: ' + (e as Error).message }, { status: 500 })
  }
}

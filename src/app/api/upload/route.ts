import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getSessionUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Max sizes
    const MAX_IMAGE = 20 * 1024 * 1024  // 20MB
    const MAX_VIDEO = 200 * 1024 * 1024 // 200MB
    const MAX_VOICE = 50 * 1024 * 1024  // 50MB
    const MAX_FILE  = 100 * 1024 * 1024 // 100MB

    const mime = file.type
    let category = 'file'
    let maxSize = MAX_FILE

    if (mime.startsWith('image/')) { category = 'image'; maxSize = MAX_IMAGE }
    else if (mime.startsWith('video/')) { category = 'video'; maxSize = MAX_VIDEO }
    else if (mime.startsWith('audio/')) { category = 'voice'; maxSize = MAX_VOICE }

    if (file.size > maxSize) {
      return NextResponse.json({
        error: `File quá lớn. Tối đa ${Math.round(maxSize / 1024 / 1024)}MB`
      }, { status: 413 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    const ext = file.name.split('.').pop() || ''
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 80)
    const filename = `${Date.now()}-${safeName}`
    const filepath = join(uploadsDir, filename)

    await writeFile(filepath, buffer)

    return NextResponse.json({
      url: `/uploads/${filename}`,
      name: file.name,
      type: mime,
      category,  // 'image' | 'video' | 'voice' | 'file'
      size: file.size,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload thất bại' }, { status: 500 })
  }
}

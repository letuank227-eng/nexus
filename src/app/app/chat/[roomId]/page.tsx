'use client'
import { useEffect, useState, useRef, use, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../../AppContext'
import { formatTime, getInitials, getAvatarColor } from '@/lib/utils'
import RoomSettingsModal from './RoomSettingsModal'

interface Message {
  id: string; content: string; type: string; fileUrl?: string; fileName?: string; fileSize?: number
  createdAt: string; sender: { id: string; name: string; avatar?: string }
}
interface RoomMember { user: { id: string; name: string; avatar?: string; status: string }; role?: string }
interface Room {
  id: string; name: string; type: string; description?: string
  avatar?: string; themeColor?: string; fontStyle?: string; roomCode?: string
  members: RoomMember[]
}

const SLASH_COMMANDS = [
  { cmd: '/task', desc: 'Tạo công việc từ tin nhắn này' },
  { cmd: '/ai', desc: 'Hỏi AI assistant' },
  { cmd: '/standup', desc: 'Gửi báo cáo standup' },
]

const FONT_MAP: Record<string, string> = {
  default: 'font-sans', serif: 'font-serif', mono: 'font-mono', rounded: '',
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function ChatPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const router = useRouter()
  const { user, socket } = useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [room, setRoom] = useState<Room | null>(null)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState<{ userId: string; userName: string }[]>([])
  const [showSlash, setShowSlash] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAISummary, setShowAISummary] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [aiSummaryText, setAiSummaryText] = useState('')
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)

  // Attach menu
  const [showAttach, setShowAttach] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Transcription: msgId -> { status: 'idle'|'loading'|'done'|'error', text: string }
  const [transcriptions, setTranscriptions] = useState<Record<string, { status: string; text: string }>>({})

  // Voice recording
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<NodeJS.Timeout>()
  const recordMimeRef = useRef<string>('audio/webm') // actual mimeType used

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<NodeJS.Timeout>()
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const themeColor = useMemo(() => room?.themeColor || '#007AFF', [room?.themeColor])
  const fontClass = useMemo(() => FONT_MAP[room?.fontStyle || 'default'], [room?.fontStyle])
  const isAdmin = useMemo(() => room?.members.find(m => m.user.id === user?.id)?.role === 'admin', [room?.members, user?.id])

  useEffect(() => {
    setLoading(true)
    // Fetch room info and messages in PARALLEL — 2x faster than sequential
    Promise.all([
      fetch(`/api/rooms/${roomId}`).then(r => r.json()),
      fetch(`/api/rooms/${roomId}/messages`).then(r => r.json()),
    ]).then(([roomData, msgData]) => {
      if (roomData.room) setRoom(roomData.room)
      setMessages(msgData.messages || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [roomId])

  // Smart scroll: only auto-scroll when user is already near the bottom
  const isNearBottom = useCallback(() => {
    const el = bottomRef.current?.parentElement
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }, [])

  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isNearBottom])

  // Scroll triggered by new messages (from others — only if near bottom)
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!socket) return
    socket.emit('room:join', { roomId })
    socket.on('message:new', (msg: Message) => setMessages(prev => [...prev, msg]))
    socket.on('typing:start', ({ userId, userName }: { userId: string; userName: string }) => {
      if (userId !== user?.id) setTyping(prev => [...prev.filter(t => t.userId !== userId), { userId, userName }])
    })
    socket.on('typing:stop', ({ userId }: { userId: string }) => {
      setTyping(prev => prev.filter(t => t.userId !== userId))
    })
    return () => {
      socket.emit('room:leave', { roomId })
      socket.off('message:new')
      socket.off('typing:start')
      socket.off('typing:stop')
    }
  }, [socket, roomId, user])

  const sendMessage = useCallback(async (content: string, type = 'text', fileUrl?: string, fileName?: string, fileSize?: number) => {
    if (!user) return
    if (type === 'text' && !content.trim()) return
    setInput('')
    setShowSlash(false)
    socket?.emit('typing:stop', { roomId, userId: user.id })

    // /task command
    if (type === 'text' && content.startsWith('/task ')) {
      const taskTitle = content.replace('/task ', '').trim()
      if (taskTitle) {
        await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: taskTitle, roomId }) })
        const sysMsg = { content: `✅ Task đã được tạo: "${taskTitle}"`, type: 'system' }
        const r = await fetch(`/api/rooms/${roomId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sysMsg) })
        const d = await r.json()
        if (d.message) { socket?.emit('message:send', d.message); scrollToBottom(true) }
      }
      return
    }

    // /ai command — call Groq and post AI response
    if (type === 'text' && content.startsWith('/ai ')) {
      const question = content.replace('/ai ', '').trim()
      if (question) {
        // Post user's question first
        const qRes = await fetch(`/api/rooms/${roomId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, type: 'text' }) })
        const qData = await qRes.json()
        if (qData.message) socket?.emit('message:send', qData.message)

        // Loading message
        const loadMsg = { content: '🤖 AI đang suy nghĩ...', type: 'system' }
        const loadRes = await fetch(`/api/rooms/${roomId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loadMsg) })
        const loadData = await loadRes.json()
        if (loadData.message) socket?.emit('message:send', loadData.message)
        scrollToBottom(true)

        // Call AI
        const aiRes = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'chat', messageText: question }) })
        const aiData = await aiRes.json()
        const aiReply = aiData.answer || aiData.error || 'AI không trả lời được'

        // Post AI answer
        const ansMsg = { content: `🤖 **Nexus AI**: ${aiReply}`, type: 'system' }
        const ansRes = await fetch(`/api/rooms/${roomId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ansMsg) })
        const ansData = await ansRes.json()
        if (ansData.message) { socket?.emit('message:send', ansData.message); scrollToBottom(true) }
      }
      return
    }

    const body: Record<string, unknown> = { content: content || fileName || 'File', type }
    if (fileUrl) body.fileUrl = fileUrl
    if (fileName) body.fileName = fileName
    if (fileSize) body.fileSize = fileSize

    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (data.message) {
      socket?.emit('message:send', data.message)
      scrollToBottom(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socket, user, scrollToBottom])

  const handleInput = (val: string) => {
    setInput(val)
    setShowSlash(val.startsWith('/') && val.length <= 20)
    if (!socket || !user) return
    socket.emit('typing:start', { roomId, userId: user.id, userName: user.name })
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId, userId: user.id })
    }, 2000)
  }

  // ── AI Summary ──────────────────────────────────
  const loadAISummary = useCallback(async () => {
    setAiSummaryLoading(true)
    setAiSummaryText('')
    setShowAISummary(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarize', roomId })
      })
      const data = await res.json()
      setAiSummaryText(data.summary || data.error || 'Không có dữ liệu')
    } catch {
      setAiSummaryText('Lỗi kết nối AI')
    } finally {
      setAiSummaryLoading(false)
    }
  }, [roomId])

  // ── Upload ──────────────────────────────────────
  // Use ref so voice onstop always gets latest version (avoid stale closure)
  const uploadFileRef = useRef<((file: File) => Promise<void>) | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    setShowAttach(false)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const fakeProgress = setInterval(() => {
        setUploadProgress(p => Math.min(p + Math.random() * 15, 85))
      }, 200)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      clearInterval(fakeProgress)
      setUploadProgress(100)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error || 'Upload thất bại')
        return
      }

      const data = await res.json()
      const msgType = data.category === 'image' ? 'image'
        : data.category === 'video' ? 'video'
        : data.category === 'voice' ? 'voice'
        : 'file'

      await sendMessage('', msgType, data.url, data.name, data.size)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socket, user])

  // Keep ref always pointing to latest uploadFile
  uploadFileRef.current = uploadFile

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  // ── Voice Recording ──────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Detect best supported MIME type (iOS needs mp4, most else webm)
      const MIME_CANDIDATES = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
      ]
      const mimeType = MIME_CANDIDATES.find(m => {
        try { return MediaRecorder.isTypeSupported(m) } catch { return false }
      }) || ''

      recordMimeRef.current = mimeType || 'audio/webm'
      recordChunksRef.current = []

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})

      mr.ondataavailable = e => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const mime = recordMimeRef.current
        const ext = mime.includes('mp4') || mime.includes('aac') ? 'm4a'
          : mime.includes('ogg') ? 'ogg' : 'webm'
        const blob = new Blob(recordChunksRef.current, { type: mime })
        if (blob.size === 0) {
          alert('Không thu được âm thanh. Vui lòng thử lại.')
          return
        }
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime })
        // Use ref to avoid stale closure
        await uploadFileRef.current?.(file)
      }

      mr.start(250) // collect chunks every 250ms
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch (err) {
      console.error('Recording error:', err)
      if ((err as Error).name === 'NotAllowedError') {
        alert('Vui lòng cấp quyền truy cập micro trong cài đặt trình duyệt.')
      } else if ((err as Error).name === 'NotFoundError') {
        alert('Không tìm thấy micro. Vui lòng kết nối micro và thử lại.')
      } else {
        alert('Không thể ghi âm: ' + (err as Error).message)
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    clearInterval(recordTimerRef.current)
    setRecording(false)
    setRecordSeconds(0)
    setShowAttach(false)
  }

  const isMyMsg = useCallback((msg: Message) => msg.sender?.id === user?.id, [user?.id])
  const myBubbleStyle = useMemo(() => ({ background: themeColor }), [themeColor])

  // ── Message Renderer ─────────────────────────────
  const transcribeVoice = async (msgId: string, audioUrl: string) => {
    setTranscriptions(t => ({ ...t, [msgId]: { status: 'loading', text: '' } }))
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setTranscriptions(t => ({ ...t, [msgId]: { status: 'error', text: data.error || 'Lỗi không xác định' } }))
      } else {
        setTranscriptions(t => ({ ...t, [msgId]: { status: 'done', text: data.text } }))
      }
    } catch (err) {
      setTranscriptions(t => ({ ...t, [msgId]: { status: 'error', text: (err as Error).message } }))
    }
  }

  const DownloadIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )

  const renderMsgContent = (msg: Message) => {
    // ── Image ──────────────────────────────
    if (msg.type === 'image' && msg.fileUrl) {
      return (
        <div className="flex flex-col gap-1.5">
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
            <img src={msg.fileUrl} alt={msg.fileName || 'image'}
              className="max-w-[240px] max-h-[300px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity" />
          </a>
          <a href={msg.fileUrl} download={msg.fileName || 'image'}
            className="flex items-center gap-1.5 text-[11px] font-semibold opacity-50 hover:opacity-90 transition-opacity">
            <DownloadIcon />Tải xuống
          </a>
        </div>
      )
    }

    // ── Video ──────────────────────────────
    if (msg.type === 'video' && msg.fileUrl) {
      return (
        <div className="flex flex-col gap-1.5">
          <video controls className="max-w-[260px] rounded-xl" style={{ maxHeight: 220 }}>
            <source src={msg.fileUrl} />
            Trình duyệt không hỗ trợ video
          </video>
          <a href={msg.fileUrl} download={msg.fileName || 'video'}
            className="flex items-center gap-1.5 text-[11px] font-semibold opacity-50 hover:opacity-90 transition-opacity">
            <DownloadIcon />Tải xuống
          </a>
        </div>
      )
    }

    // ── Voice ──────────────────────────────
    if (msg.type === 'voice' && msg.fileUrl) {
      const tr = transcriptions[msg.id]
      return (
        <div className="flex flex-col gap-2" style={{ minWidth: 220 }}>
          <audio controls className="h-10 w-full" style={{ accentColor: themeColor }}>
            <source src={msg.fileUrl} />
          </audio>

          <div className="flex items-center gap-3">
            {/* Download */}
            <a href={msg.fileUrl} download={msg.fileName || 'voice'}
              className="flex items-center gap-1 text-[11px] font-semibold opacity-50 hover:opacity-90 transition-opacity">
              <DownloadIcon />Tải xuống
            </a>
            <span className="text-gray-300 text-xs">|</span>
            {/* Transcribe */}
            <button
              onClick={() => transcribeVoice(msg.id, msg.fileUrl!)}
              disabled={tr?.status === 'loading'}
              className="flex items-center gap-1 text-[11px] font-semibold opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
              style={{ color: themeColor }}>
              {tr?.status === 'loading' ? (
                <>
                  <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: `${themeColor}50`, borderTopColor: themeColor }} />
                  Đang dịch...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  Dịch sang văn bản
                </>
              )}
            </button>
          </div>

          {/* Transcription result */}
          {tr && tr.status !== 'loading' && (
            <div className={`text-xs rounded-xl px-3 py-2 leading-relaxed ${
              tr.status === 'error'
                ? 'bg-red-50 text-red-500 border border-red-100'
                : 'bg-gray-50 text-gray-700 border border-gray-100'
            }`}>
              {tr.status === 'error' ? '⚠️ ' : '📝 '}{tr.text}
            </div>
          )}
        </div>
      )
    }

    // ── File ──────────────────────────────
    if (msg.type === 'file' && msg.fileUrl) {
      return (
        <a href={msg.fileUrl} download={msg.fileName}
          className="flex items-center gap-2.5 px-1 py-0.5 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate max-w-[150px]">{msg.fileName || 'File'}</span>
            {msg.fileSize && <span className="text-[11px] opacity-60">{formatBytes(msg.fileSize)}</span>}
          </div>
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <DownloadIcon />
          </div>
        </a>
      )
    }

    return <span>{msg.content}</span>
  }


  return (
    <div className={`flex flex-col h-full bg-white text-gray-900 overflow-hidden ${fontClass}`}
      style={room?.fontStyle === 'rounded' ? { fontFamily: '"Nunito", "Varela Round", sans-serif' } : {}}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0 mt-8"
        style={{ borderBottomColor: `${themeColor}20` }}>
        <button onClick={() => router.push('/app/chat')} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="text-center flex-1 flex flex-col items-center">
          {room?.avatar && (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg mb-0.5"
              style={{ background: `${themeColor}18`, border: `1.5px solid ${themeColor}40` }}>
              {room.avatar.startsWith('data:')
                ? <img src={room.avatar} alt="" className="w-8 h-8 rounded-xl object-cover" />
                : room.avatar}
            </div>
          )}
          <h1 className="text-[16px] font-bold leading-tight text-gray-900">{room?.name || '...'}</h1>
          <p className="text-xs text-gray-400">{room?.members?.length || 0} thành viên</p>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center -space-x-1.5">
            {room?.members?.slice(0, 3).map(m => (
              <div key={m.user.id} title={m.user.name}
                className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(m.user.name)} flex items-center justify-center text-[9px] font-bold text-white border-2 border-white`}>
                {getInitials(m.user.name)}
              </div>
            ))}
          </div>
          {isAdmin && (
            <button id="room-settings-btn" onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{ background: `${themeColor}15`, color: themeColor }} title="Cài đặt nhóm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          {/* AI Summary button — always visible */}
          <button onClick={loadAISummary} disabled={aiSummaryLoading}
            title="AI Tóm tắt cuộc trò chuyện"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-60"
            style={{ background: `${themeColor}15`, color: themeColor }}>
            {aiSummaryLoading
              ? <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${themeColor}40`, borderTopColor: themeColor }}/>
              : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
          </button>
        </div>
      </header>

      {/* ── Chat Area ── */}
      <main className="flex-1 overflow-y-auto bg-white flex flex-col px-4 py-4 space-y-1">

        {/* AI Summary Banner — real data from Groq */}
        {(showAISummary || aiSummaryText || aiSummaryLoading) && (
          <div className="rounded-2xl mb-3 overflow-hidden shadow-sm animate-fade-in border" style={{ borderColor: `${themeColor}30` }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ background: `${themeColor}12` }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: themeColor }}>
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <span className="text-xs font-bold" style={{ color: themeColor }}>AI Tóm tắt</span>
              </div>
              <button onClick={() => { setShowAISummary(false); setAiSummaryText('') }} className="text-gray-400 hover:text-gray-600 p-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </svg>
              </button>
            </div>
            <div className="px-3 py-2.5 bg-white">
              {aiSummaryLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${themeColor}40`, borderTopColor: themeColor }}/>
                  AI đang đọc và tóm tắt tin nhắn...
                </div>
              ) : aiSummaryText ? (
                <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-line">{aiSummaryText}</p>
              ) : (
                <p className="text-[11px] text-gray-400">Nhấn ⭐ trên header để AI tóm tắt cuộc trò chuyện này.</p>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${themeColor}40`, borderTopColor: themeColor }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: `${themeColor}12` }}>
              {room?.avatar || '💬'}
            </div>
            <p className="text-gray-500 font-medium">Hãy bắt đầu cuộc trò chuyện!</p>
            <p className="text-gray-400 text-sm">Gõ <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/</kbd> để dùng lệnh nhanh</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const myMsg = isMyMsg(msg)
            const prev = messages[idx - 1]
            const grouped = prev?.sender?.id === msg.sender?.id &&
              (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 60000
            const isMedia = ['image','video','voice','file'].includes(msg.type)

            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">{msg.content}</span>
                </div>
              )
            }

            return (
              <div key={msg.id} className={`flex items-end gap-2 ${myMsg ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-4'}`}>
                {!myMsg && !grouped && (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(msg.sender?.name || 'U')} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                    {getInitials(msg.sender?.name || 'U')}
                  </div>
                )}
                {!myMsg && grouped && <div className="w-8 shrink-0" />}

                <div className={`flex flex-col max-w-[75%] ${myMsg ? 'items-end' : 'items-start'}`}>
                  {!grouped && (
                    <div className={`flex items-baseline gap-1.5 mb-1 ${myMsg ? 'flex-row-reverse' : ''}`}>
                      {!myMsg && <span className="font-semibold text-[13px] text-gray-900">{msg.sender?.name}</span>}
                      <span className="text-[11px] text-gray-400">{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <div className={`${isMedia ? 'overflow-hidden rounded-2xl' : 'px-4 py-2.5 rounded-2xl'} text-[15px] leading-snug ${
                    myMsg
                      ? isMedia ? '' : 'text-white rounded-br-sm'
                      : isMedia ? 'bg-transparent' : 'bg-[#E5E5EA] text-gray-900 rounded-tl-sm'
                  }`}
                    style={myMsg && !isMedia ? myBubbleStyle : (myMsg && isMedia ? { color: themeColor } : {})}>
                    {renderMsgContent(msg)}
                  </div>
                </div>

                {myMsg && !grouped && (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(user?.name || 'U')} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                    {getInitials(user?.name || 'U')}
                  </div>
                )}
                {myMsg && grouped && <div className="w-8 shrink-0" />}
              </div>
            )
          })
        )}

        {/* Typing indicator */}
        {typing.length > 0 && (
          <div className="flex items-center gap-2 py-1 mt-2">
            <div className="bg-[#E5E5EA] rounded-full px-3 py-2 flex gap-1">
              <div className="typing-dot w-1.5 h-1.5 bg-gray-500 rounded-full" />
              <div className="typing-dot w-1.5 h-1.5 bg-gray-500 rounded-full" />
              <div className="typing-dot w-1.5 h-1.5 bg-gray-500 rounded-full" />
            </div>
            <span className="text-xs text-gray-400">{typing.map(t => t.userName).join(', ')} đang nhập...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* ── Slash Commands ── */}
      {showSlash && (
        <div className="mx-4 mb-1 bg-white rounded-xl overflow-hidden border border-gray-200 shadow-lg">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Lệnh nhanh</p>
          </div>
          {SLASH_COMMANDS.filter(c => c.cmd.startsWith(input)).map(c => (
            <button key={c.cmd}
              onClick={() => { setInput(c.cmd + ' '); setShowSlash(false); inputRef.current?.focus() }}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 text-left transition-colors">
              <code className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: themeColor, background: `${themeColor}12` }}>{c.cmd}</code>
              <span className="text-xs text-gray-500">{c.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Upload Progress ── */}
      {uploading && (
        <div className="mx-4 mb-2 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin shrink-0"
              style={{ borderColor: `${themeColor}40`, borderTopColor: themeColor }} />
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-700 mb-1">Đang tải lên... {Math.round(uploadProgress)}%</p>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%`, background: themeColor }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Attach Menu Popup ── */}
      {showAttach && !recording && (
        <div className="mx-3 mb-2 animate-slide-up">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-2 py-2 flex items-center gap-1">

            {/* Image */}
            <button onClick={() => imageInputRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-gray-50 active:scale-95 transition-all">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${themeColor}15` }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" style={{ color: themeColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-500">Ảnh</span>
            </button>

            {/* Video */}
            <button onClick={() => videoInputRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-gray-50 active:scale-95 transition-all">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FF375F12' }}>
                <svg className="w-5 h-5 text-[#FF375F]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-500">Video</span>
            </button>

            {/* File */}
            <button onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-gray-50 active:scale-95 transition-all">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#34C75912' }}>
                <svg className="w-5 h-5 text-[#34C759]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-500">File</span>
            </button>

            {/* Divider */}
            <div className="w-px h-10 bg-gray-100 mx-1 shrink-0" />

            {/* Voice */}
            <button onClick={startRecording}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-red-50 active:scale-95 transition-all">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                  <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-red-400">Ghi âm</span>
            </button>

          </div>
        </div>
      )}


      {/* ── Voice Recording UI ── */}
      {recording && (
        <div className="mx-4 mb-2 bg-white rounded-2xl shadow-xl border border-red-100 px-4 py-4 animate-slide-up">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center animate-pulse shrink-0">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">Đang ghi âm...</p>
              <p className="text-2xl font-mono font-bold text-red-500">
                {String(Math.floor(recordSeconds / 60)).padStart(2,'0')}:{String(recordSeconds % 60).padStart(2,'0')}
              </p>
            </div>
            <button onClick={stopRecording}
              className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors active:scale-95 shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Nhấn nút đỏ để dừng và gửi</p>
        </div>
      )}

      {/* ── Input Area ── */}
      <div className="bg-white px-3 py-2 flex items-center gap-3 shrink-0 border-t border-gray-100 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        {/* Hidden inputs */}
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
        <input ref={fileInputRef} type="file" accept="*" className="hidden" onChange={handleFileSelect} />

        {/* "+" button */}
        <button
          id="attach-btn"
          onClick={() => { setShowAttach(v => !v); setShowSlash(false) }}
          disabled={uploading || recording}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition-all active:scale-95 ${
            showAttach
              ? 'rotate-45 bg-gray-800 border-gray-800 text-white'
              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
          } disabled:opacity-40`}
          style={showAttach ? {} : {}}>
          <svg className="w-5 h-5 transition-transform" style={{ transform: showAttach ? 'rotate(45deg)' : '' }}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
              if (e.key === 'Escape') setShowSlash(false)
            }}
            placeholder={recording ? '🔴 Đang ghi âm...' : `Nhắn trong #${room?.name || '...'}`}
            disabled={recording || uploading}
            className="w-full bg-white border border-gray-300 rounded-full py-2.5 px-4 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none transition-all pr-10 disabled:bg-gray-50"
            style={{ '--focus-ring': themeColor } as React.CSSProperties}
            onFocus={e => { e.target.style.borderColor = themeColor; e.target.style.boxShadow = `0 0 0 3px ${themeColor}20` }}
            onBlur={e => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = '' }}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || recording}
            className="absolute right-1.5 w-7 h-7 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all active:scale-95 hover:brightness-110"
            style={{ background: themeColor }}>
            <svg className="w-3.5 h-3.5 -rotate-45" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Room Settings Modal ── */}
      {showSettings && room && user && (
        <RoomSettingsModal
          room={room}
          currentUserId={user.id}
          onClose={() => setShowSettings(false)}
          onUpdated={(updatedRoom) => { setRoom(updatedRoom); setShowSettings(false) }}
        />
      )}
    </div>
  )
}

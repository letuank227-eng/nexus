'use client'
import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../../AppContext'
import { formatTime, getInitials, getAvatarColor } from '@/lib/utils'
import RoomSettingsModal from './RoomSettingsModal'

interface Message {
  id: string; content: string; type: string; fileUrl?: string; fileName?: string
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
  default: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
  rounded: '',
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
  const [showAISummary, setShowAISummary] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [summaryText] = useState('Cuộc trò chuyện gần đây thảo luận về việc hoàn thiện mục tiêu Q3, ghi chú họp khách hàng và thiết kế lại website. AI đề xuất tạo task.')
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<NodeJS.Timeout>()
  const inputRef = useRef<HTMLInputElement>(null)

  // Derived values from room theme
  const themeColor = room?.themeColor || '#007AFF'
  const fontClass = FONT_MAP[room?.fontStyle || 'default']

  const isAdmin = room?.members.find(m => m.user.id === user?.id)?.role === 'admin'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/rooms`).then(r => r.json()).then(d => {
      const r = d.rooms?.find((r: Room) => r.id === roomId)
      setRoom(r || null)
    }).catch(() => {})
    fetch(`/api/rooms/${roomId}/messages`).then(r => r.json()).then(d => {
      setMessages(d.messages || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  const sendMessage = async () => {
    if (!input.trim() || !user) return
    const content = input.trim()
    setInput('')
    setShowSlash(false)
    socket?.emit('typing:stop', { roomId, userId: user.id })

    if (content.startsWith('/task ')) {
      const taskTitle = content.replace('/task ', '').trim()
      if (taskTitle) {
        await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: taskTitle, roomId }) })
        const sysMsg = { content: `✅ Task đã được tạo: "${taskTitle}"`, type: 'system' }
        await fetch(`/api/rooms/${roomId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sysMsg) })
      }
    }

    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type: 'text' })
    })
    const data = await res.json()
    if (data.message) socket?.emit('message:send', data.message)
  }

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

  const isMyMsg = (msg: Message) => msg.sender?.id === user?.id

  // Dynamic styles from theme
  const myBubbleStyle = { background: themeColor }

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
          {/* Room avatar */}
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
          {/* Member avatars */}
          <div className="flex items-center -space-x-1.5">
            {room?.members?.slice(0, 3).map(m => (
              <div key={m.user.id} title={m.user.name}
                className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(m.user.name)} flex items-center justify-center text-[9px] font-bold text-white border-2 border-white`}>
                {getInitials(m.user.name)}
              </div>
            ))}
          </div>

          {/* Settings button - only for admin */}
          {isAdmin && (
            <button
              id="room-settings-btn"
              onClick={() => setShowSettings(true)}
              className="ml-2 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{ background: `${themeColor}15`, color: themeColor }}
              title="Cài đặt nhóm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* ── Chat Area ── */}
      <main className="flex-1 overflow-y-auto bg-white flex flex-col px-4 py-4 space-y-1">

        {/* AI Summary Banner */}
        {showAISummary && (
          <div className="rounded-xl p-3 mb-4 flex items-start gap-3 shadow-sm animate-fade-in"
            style={{ background: themeColor }}>
            <div className="bg-white/20 rounded-md p-1 shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <p className="text-white text-sm leading-snug flex-1">
              <span className="font-bold">AI tóm tắt: </span>{summaryText}
            </p>
            <button onClick={() => setShowAISummary(false)} className="text-white/60 hover:text-white shrink-0 ml-1 mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>
        )}

        {/* AI Summary Toggle */}
        {!showAISummary && (
          <div className="flex justify-end mb-2">
            <button onClick={() => setShowAISummary(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-medium hover:bg-gray-50 transition-colors"
              style={{ borderColor: `${themeColor}60`, color: themeColor }}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              AI Summary
            </button>
          </div>
        )}

        {/* Messages */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${themeColor}40`, borderTopColor: themeColor }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: `${themeColor}12` }}>
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

            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">{msg.content}</span>
                </div>
              )
            }

            return (
              <div key={msg.id} className={`flex items-end gap-2 ${myMsg ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-4'}`}>
                {/* Incoming: avatar */}
                {!myMsg && !grouped && (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(msg.sender?.name || 'U')} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                    {getInitials(msg.sender?.name || 'U')}
                  </div>
                )}
                {!myMsg && grouped && <div className="w-8 shrink-0" />}

                <div className={`flex flex-col max-w-[75%] ${myMsg ? 'items-end' : 'items-start'}`}>
                  {/* Name + time */}
                  {!grouped && (
                    <div className={`flex items-baseline gap-1.5 mb-1 ${myMsg ? 'flex-row-reverse' : ''}`}>
                      {!myMsg && <span className="font-semibold text-[13px] text-gray-900">{msg.sender?.name}</span>}
                      <span className="text-[11px] text-gray-400">{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  {/* Bubble */}
                  <div className={`px-4 py-2.5 rounded-2xl text-[15px] leading-snug ${
                    myMsg ? 'text-white rounded-br-sm' : 'bg-[#E5E5EA] text-gray-900 rounded-tl-sm'
                  }`}
                    style={myMsg ? myBubbleStyle : {}}>
                    {msg.content}
                  </div>
                </div>

                {/* Outgoing: avatar */}
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

      {/* ── Input Area ── */}
      <div className="bg-white px-3 py-2 flex items-center gap-3 shrink-0 border-t border-gray-100 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 border border-gray-200 hover:bg-gray-200 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              if (e.key === 'Escape') setShowSlash(false)
            }}
            placeholder={`Nhắn trong #${room?.name || '...'}`}
            className="w-full bg-white border border-gray-300 rounded-full py-2.5 px-4 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none transition-all pr-10"
            style={{ '--focus-ring': themeColor } as React.CSSProperties}
            onFocus={e => { e.target.style.borderColor = themeColor; e.target.style.boxShadow = `0 0 0 3px ${themeColor}20` }}
            onBlur={e => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = '' }}
          />
          <button onClick={sendMessage} disabled={!input.trim()}
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
          onUpdated={(updatedRoom) => {
            setRoom(updatedRoom)
            setShowSettings(false)
          }}
        />
      )}
    </div>
  )
}

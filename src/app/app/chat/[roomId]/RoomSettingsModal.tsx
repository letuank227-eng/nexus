'use client'
import { useState, useRef } from 'react'

interface RoomMember {
  user: { id: string; name: string; avatar?: string; status: string }
  role?: string
  position?: string
  isHidden?: boolean
}

interface Room {
  id: string
  name: string
  description?: string
  avatar?: string
  themeColor?: string
  fontStyle?: string
  roomCode?: string
  members: RoomMember[]
}

interface Props {
  room: Room
  currentUserId: string
  onClose: () => void
  onUpdated: (room: Room) => void
}

const THEME_COLORS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Slate', value: '#64748b' },
]

const FONT_STYLES = [
  { label: 'Mặc định', value: 'default', css: 'font-sans' },
  { label: 'Serif', value: 'serif', css: 'font-serif' },
  { label: 'Mono', value: 'mono', css: 'font-mono' },
  { label: 'Tròn (Rounded)', value: 'rounded', css: '' },
]

const AVATAR_EMOJIS = ['💬', '🚀', '⚡', '🎯', '🔥', '💡', '🌟', '🎨', '🛠️', '📊', '🎮', '🧠', '🦄', '🌈', '💎']

export default function RoomSettingsModal({ room, currentUserId, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<'general' | 'appearance' | 'members'>('general')
  const [name, setName] = useState(room.name)
  const [description, setDescription] = useState(room.description || '')
  const [avatar, setAvatar] = useState(room.avatar || '💬')
  const [themeColor, setThemeColor] = useState(room.themeColor || '#6366f1')
  const [fontStyle, setFontStyle] = useState(room.fontStyle || 'default')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [avatarMode, setAvatarMode] = useState<'emoji' | 'upload'>('emoji')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [roomCode, setRoomCode] = useState(room.roomCode || '')
  const [copiedCode, setCopiedCode] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Members management state
  const [members, setMembers] = useState(room.members)
  const [memberAction, setMemberAction] = useState<Record<string, 'kicking' | 'promoting' | null>>({})
  const [memberError, setMemberError] = useState('')
  const [confirmKick, setConfirmKick] = useState<{ id: string; name: string } | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('Tên nhóm không được để trống'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description, avatar, themeColor, fontStyle, roomCode: roomCode.trim() || undefined })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi cập nhật'); return }
      setSuccess('Đã lưu thành công!')
      onUpdated(data.room)
      setTimeout(() => setSuccess(''), 2500)
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload thất bại')
      const data = await res.json()
      setAvatar(data.url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setRoomCode(code)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const isAdmin = members.find(m => m.user.id === currentUserId)?.role === 'admin'

  const kickMember = async (userId: string) => {
    setMemberAction(p => ({ ...p, [userId]: 'kicking' }))
    setMemberError('')
    try {
      const res = await fetch(`/api/rooms/${room.id}/members/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setMemberError(data.error || 'Không thể kick thành viên'); return }
      setMembers(prev => prev.filter(m => m.user.id !== userId))
      setConfirmKick(null)
    } catch { setMemberError('Lỗi kết nối') }
    finally { setMemberAction(p => ({ ...p, [userId]: null })) }
  }

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    setMemberAction(p => ({ ...p, [userId]: 'promoting' }))
    setMemberError('')
    try {
      const res = await fetch(`/api/rooms/${room.id}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })
      const data = await res.json()
      if (!res.ok) { setMemberError(data.error || 'Không thể thay đổi quyền'); return }
      setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, role: newRole } : m))
    } catch { setMemberError('Lỗi kết nối') }
    finally { setMemberAction(p => ({ ...p, [userId]: null })) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ boxShadow: `0 0 60px ${themeColor}30` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10"
          style={{ background: `linear-gradient(135deg, ${themeColor}20, transparent)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: `${themeColor}30`, border: `1.5px solid ${themeColor}60` }}>
              {avatar.startsWith('data:') ? (
                <img src={avatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
              ) : avatar}
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Cài đặt nhóm</h2>
              <p className="text-xs text-slate-400">#{room.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6">
          {(['general', 'appearance', 'members'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === t
                  ? 'border-[var(--theme)] text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
              style={tab === t ? { '--theme': themeColor, borderColor: themeColor, color: 'white' } as React.CSSProperties : {}}>
              {t === 'general' ? '⚙️ Chung' : t === 'appearance' ? '🎨 Giao diện' : '👥 Thành viên'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── GENERAL TAB ── */}
          {tab === 'general' && (
            <>
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tên nhóm</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
                  placeholder="Tên nhóm..."
                  onFocus={e => { e.target.style.borderColor = themeColor; e.target.style.boxShadow = `0 0 0 3px ${themeColor}30` }}
                  onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mô tả</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={!isAdmin}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Mô tả nhóm..."
                  onFocus={e => { e.target.style.borderColor = themeColor; e.target.style.boxShadow = `0 0 0 3px ${themeColor}30` }}
                  onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' }}
                />
              </div>

              {/* Room Code — admin can edit */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mã nhóm</label>
                {isAdmin ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                        placeholder="Nhập mã nhóm..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono font-bold tracking-widest text-sm placeholder-slate-600 focus:outline-none transition-all uppercase"
                        style={{ letterSpacing: '0.2em' }}
                        onFocus={e => { e.target.style.borderColor = themeColor; e.target.style.boxShadow = `0 0 0 3px ${themeColor}30` }}
                        onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' }}
                      />
                      <button onClick={generateCode} title="Tạo mã ngẫu nhiên"
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all flex items-center justify-center text-lg shrink-0"
                        style={{ borderColor: `${themeColor}30` }}>
                        🎲
                      </button>
                      <button onClick={() => copyCode(roomCode || '')} title="Copy mã"
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all flex items-center justify-center text-sm shrink-0">
                        {copiedCode ? '✅' : '📋'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">Chỉ dùng chữ và số, tối đa 12 ký tự. Nhấn 🎲 để tạo ngẫu nhiên.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <span className="font-mono text-lg font-bold tracking-widest" style={{ color: themeColor }}>{room.roomCode || 'N/A'}</span>
                    <button onClick={() => copyCode(room.roomCode || '')}
                      className="ml-auto text-xs text-slate-500 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition-all">
                      {copiedCode ? '✅ Đã copy' : '📋 Copy'}
                    </button>
                  </div>
                )}
                {!isAdmin && <p className="text-xs text-slate-600 mt-1">Chỉ quản lý mới có thể thay đổi mã nhóm</p>}
              </div>
            </>
          )}

          {/* ── APPEARANCE TAB ── */}
          {tab === 'appearance' && (
            <>
              {/* Avatar */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ảnh đại diện nhóm</label>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setAvatarMode('emoji')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${avatarMode === 'emoji' ? 'text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    style={avatarMode === 'emoji' ? { background: themeColor } : {}}>
                    Emoji
                  </button>
                  <button onClick={() => setAvatarMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${avatarMode === 'upload' ? 'text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    style={avatarMode === 'upload' ? { background: themeColor } : {}}>
                    Tải ảnh lên
                  </button>
                </div>

                {avatarMode === 'emoji' ? (
                  <div className="grid grid-cols-8 gap-2">
                    {AVATAR_EMOJIS.map(emoji => (
                      <button key={emoji} onClick={() => setAvatar(emoji)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-110 ${avatar === emoji ? 'ring-2 scale-110' : 'bg-white/5 hover:bg-white/10'}`}
                        style={avatar === emoji ? { background: `${themeColor}40`, ringColor: themeColor, boxShadow: `0 0 0 2px ${themeColor}` } : {}}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center">
                      {avatar && !AVATAR_EMOJIS.includes(avatar) ? (
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-600 text-sm">Chưa có</span>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60 flex items-center gap-2"
                      style={{ background: themeColor }}>
                      {uploadingAvatar ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang tải...</>
                      ) : '📁 Chọn ảnh'}
                    </button>
                  </div>
                )}
              </div>

              {/* Theme Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Màu chủ đạo</label>
                <div className="grid grid-cols-5 gap-3">
                  {THEME_COLORS.map(c => (
                    <button key={c.value} onClick={() => setThemeColor(c.value)} title={c.label}
                      className={`relative w-full pt-[100%] rounded-xl transition-all hover:scale-105 ${themeColor === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f0f1a]' : ''}`}
                      style={{ background: c.value }}>
                      {themeColor === c.value && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-lg font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                {/* Custom color picker */}
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs text-slate-500">Màu tùy chỉnh:</label>
                  <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)}
                    className="w-10 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
                  <span className="font-mono text-xs text-slate-400">{themeColor}</span>
                </div>
              </div>

              {/* Font Style */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Kiểu chữ</label>
                <div className="grid grid-cols-2 gap-2">
                  {FONT_STYLES.map(f => (
                    <button key={f.value} onClick={() => setFontStyle(f.value)}
                      className={`px-4 py-3 rounded-xl border transition-all text-left ${
                        fontStyle === f.value
                          ? 'border-opacity-100 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      style={fontStyle === f.value ? { borderColor: themeColor, background: `${themeColor}20`, color: 'white' } : {}}>
                      <p className={`font-medium text-sm mb-0.5 ${f.css}`}>{f.label}</p>
                      <p className={`text-xs opacity-60 ${f.css}`}>Xin chào Nexus!</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Xem trước</label>
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  {/* Preview header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10"
                    style={{ background: `linear-gradient(135deg, ${themeColor}25, ${themeColor}08)` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: `${themeColor}30`, border: `1.5px solid ${themeColor}60` }}>
                      {avatar.startsWith('data:') ? <img src={avatar} alt="" className="w-9 h-9 rounded-xl object-cover" /> : avatar}
                    </div>
                    <div>
                      <p className={`font-bold text-sm text-white ${fontStyle === 'mono' ? 'font-mono' : fontStyle === 'serif' ? 'font-serif' : ''}`}
                        style={fontStyle === 'rounded' ? { fontFamily: '"Nunito", sans-serif' } : {}}>
                        {name || 'Tên nhóm'}
                      </p>
                      <p className="text-xs text-slate-500">{room.members.length} thành viên</p>
                    </div>
                  </div>
                  {/* Preview message */}
                  <div className="px-4 py-3 bg-[#080810] flex flex-col gap-2">
                    <div className="flex justify-end">
                      <div className="px-3 py-2 rounded-xl text-sm text-white max-w-[70%]"
                        style={{ background: themeColor }}>
                        <p className={fontStyle === 'mono' ? 'font-mono' : fontStyle === 'serif' ? 'font-serif' : ''}>
                          Xin chào nhóm! 👋
                        </p>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="px-3 py-2 rounded-xl text-sm bg-white/10 text-white max-w-[70%]">
                        <p className={fontStyle === 'mono' ? 'font-mono' : fontStyle === 'serif' ? 'font-serif' : ''}>
                          Chào mừng đến Nexus!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── MEMBERS TAB ── */}
          {tab === 'members' && (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{members.length} thành viên</p>
                {memberError && (
                  <p className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">{memberError}</p>
                )}
              </div>

              {/* Position legend */}
              <div className="grid grid-cols-2 gap-1.5 p-3 bg-white/3 rounded-xl border border-white/5">
                {[
                  { pos: 'director', icon: '👔', label: 'Giám đốc',    color: '#f59e0b', desc: 'Bypass PIN · Ẩn danh' },
                  { pos: 'manager',  icon: '🏢', label: 'Trưởng phòng', color: '#6366f1', desc: 'Quản lý phòng ban' },
                  { pos: 'leader',   icon: '🎯', label: 'Tổ trưởng',   color: '#10b981', desc: 'Quản lý tổ nhóm' },
                  { pos: 'member',   icon: '👤', label: 'Thành viên',  color: '#64748b', desc: 'Thành viên thường' },
                ].map(p => (
                  <div key={p.pos} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5">
                    <span className="text-sm">{p.icon}</span>
                    <div>
                      <p className="text-[11px] font-semibold" style={{ color: p.color }}>{p.label}</p>
                      <p className="text-[10px] text-slate-600">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirm kick dialog */}
              {confirmKick && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-white font-medium">⚠️ Kick <span className="text-red-400">{confirmKick.name}</span> khỏi nhóm?</p>
                  <p className="text-xs text-slate-400">Thành viên này sẽ bị xóa khỏi nhóm và cần mã nhóm để tham gia lại.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmKick(null)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-white/10 hover:bg-white/15 transition-all">
                      Hủy
                    </button>
                    <button onClick={() => kickMember(confirmKick.id)}
                      disabled={memberAction[confirmKick.id] === 'kicking'}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
                      {memberAction[confirmKick.id] === 'kicking'
                        ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang kick...</>
                        : '🚫 Xác nhận kick'}
                    </button>
                  </div>
                </div>
              )}

              {/* Member list */}
              {members.map(m => {
                const isSelf = m.user.id === currentUserId
                const isActing = !!memberAction[m.user.id]
                const pos = m.position || 'member'
                const isTargetDirector = pos === 'director'

                const POSITION_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
                  director: { icon: '👔', label: 'Giám đốc',     color: '#f59e0b' },
                  manager:  { icon: '🏢', label: 'Trưởng phòng', color: '#6366f1' },
                  leader:   { icon: '🎯', label: 'Tổ trưởng',    color: '#10b981' },
                  member:   { icon: '👤', label: 'Thành viên',   color: '#64748b' },
                }
                const posConfig = POSITION_CONFIG[pos] || POSITION_CONFIG.member

                return (
                  <div key={m.user.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group border ${
                      isTargetDirector
                        ? 'bg-amber-500/8 border-amber-500/20'
                        : 'bg-white/5 border-transparent hover:bg-white/[0.07]'
                    }`}>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ background: posConfig.color }}>
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f0f1a] ${
                        m.user.status === 'online' ? 'bg-emerald-400' : 'bg-slate-600'
                      }`} />
                      {m.isHidden && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center" title="Đang theo dõi ẩn danh">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-white truncate">{m.user.name}</p>
                        {isSelf && <span className="text-[9px] text-slate-500 bg-white/10 px-1.5 py-0.5 rounded-full">Bạn</span>}
                        {m.isHidden && <span className="text-[9px] text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded-full">👁 Ẩn danh</span>}
                      </div>
                      <p className="text-[11px] mt-0.5 font-medium" style={{ color: posConfig.color }}>
                        {posConfig.icon} {posConfig.label}
                      </p>
                    </div>

                    {/* Position + kick actions — admin only, not self, not director */}
                    {isAdmin && !isSelf && !isTargetDirector && (
                      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <select
                          value={pos}
                          disabled={isActing}
                          onChange={async (e) => {
                            const newPos = e.target.value
                            setMemberAction(p => ({ ...p, [m.user.id]: 'promoting' }))
                            setMemberError('')
                            try {
                              const res = await fetch(`/api/rooms/${room.id}/members/${m.user.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ position: newPos })
                              })
                              const data = await res.json()
                              if (!res.ok) { setMemberError(data.error || 'Lỗi thay đổi chức vụ'); return }
                              setMembers(prev => prev.map(mb => mb.user.id === m.user.id ? { ...mb, position: newPos } : mb))
                            } catch { setMemberError('Lỗi kết nối') }
                            finally { setMemberAction(p => ({ ...p, [m.user.id]: null })) }
                          }}
                          className="text-[11px] bg-[#1a1a2e] border border-white/15 rounded-lg px-2 py-1 cursor-pointer focus:outline-none disabled:opacity-50"
                          style={{ color: posConfig.color }}>
                          <option value="manager">🏢 Trưởng phòng</option>
                          <option value="leader">🎯 Tổ trưởng</option>
                          <option value="member">👤 Thành viên</option>
                        </select>

                        <button onClick={() => setConfirmKick({ id: m.user.id, name: m.user.name })}
                          disabled={isActing}
                          title="Kick khỏi nhóm"
                          className="w-7 h-7 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50">
                          {memberAction[m.user.id] === 'kicking'
                            ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>}
                        </button>
                      </div>
                    )}

                    {isActing && <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin flex-shrink-0" />}
                  </div>
                )
              })}

              {isAdmin && (
                <div className="pt-2 border-t border-white/5 space-y-1">
                  <p className="text-xs text-slate-600">💡 Di chuột vào thành viên để thay đổi chức vụ hoặc kick</p>
                  <p className="text-xs text-amber-500/50">👔 Giám đốc được ẩn danh · bypass mã PIN · chỉ admin thấy</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {isAdmin && tab !== 'members' && (
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-3 bg-[#0f0f1a]">
            <div className="flex-1">
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {success && <p className="text-emerald-400 text-sm animate-pulse">{success}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ background: themeColor }}>
                {saving ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang lưu...</>
                ) : '💾 Lưu thay đổi'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

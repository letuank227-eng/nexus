'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../AppContext'
import { getInitials, getAvatarColor, formatDate } from '@/lib/utils'

interface Room {
  id: string; name: string; type: string; roomCode?: string
  messages: { content: string; createdAt: string; sender: { id: string; name: string } }[]
  members: { user: { id: string; name: string; status: string } }[]
}
interface User { id: string; name: string; email: string; role: string; status: string }

export default function ChatListPage() {
  const router = useRouter()
  const { user, onlineUsers } = useApp()
  const [rooms, setRooms] = useState<Room[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'channels' | 'dms'>('all')

  // Create group modal
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [groupCode, setGroupCode] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null) // success screen

  // Join group modal
  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    fetch('/api/rooms').then(r => r.json()).then(d => { setRooms(d.rooms || []); setLoading(false) }).catch(() => setLoading(false))
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  const channels = rooms.filter(r => r.type === 'channel')
  const dms      = rooms.filter(r => r.type === 'direct')

  const filteredRooms = rooms.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = activeFilter === 'all' || (activeFilter === 'channels' && r.type === 'channel') || (activeFilter === 'dms' && r.type === 'direct')
    return matchSearch && matchFilter
  })

  const otherUsers = users.filter(u => u.id !== user?.id)
  const filteredUsers = otherUsers.filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase()))

  const toggleMember = (id: string) =>
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const resetCreate = () => {
    setShowCreate(false); setCreateStep(1); setGroupName(''); setGroupDesc('')
    setGroupCode(''); setIsPrivate(false); setSelectedMembers([]); setMemberSearch('')
    setCreateError(''); setCreatedRoom(null)
  }

  const createGroup = async () => {
    if (!groupName.trim()) { setCreateError('Vui lòng nhập tên nhóm'); return }
    if (!groupCode.trim()) { setCreateError('Vui lòng nhập mã nhóm'); return }
    if (groupCode.trim().length < 4) { setCreateError('Mã nhóm phải có ít nhất 4 ký tự'); return }
    setCreating(true); setCreateError('')
    const res = await fetch('/api/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName.trim(), description: groupDesc.trim(), type: 'channel', memberIds: selectedMembers, isPrivate, roomCode: groupCode.trim() })
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateError(data.error); return }
    setRooms(prev => [data.room, ...prev])
    setCreatedRoom(data.room)
  }

  // Join group by code
  const joinGroup = async () => {
    if (!joinCode.trim()) { setJoinError('Vui lòng nhập mã nhóm'); return }
    setJoining(true); setJoinError('')
    const res = await fetch('/api/rooms/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: joinCode.trim() })
    })
    const data = await res.json()
    setJoining(false)
    if (!res.ok) { setJoinError(data.error); return }
    if (data.alreadyMember) {
      setShowJoin(false); setJoinCode('')
      router.push(`/app/chat/${data.room.id}`); return
    }
    if (!rooms.find(r => r.id === data.room.id)) setRooms(prev => [data.room, ...prev])
    setShowJoin(false); setJoinCode('')
    router.push(`/app/chat/${data.room.id}`)
  }

  const onlineMembers: { id: string; name: string }[] = []
  const seen = new Set<string>()
  rooms.forEach(r => r.members?.forEach(m => {
    if (!seen.has(m.user.id) && m.user.id !== user?.id && onlineUsers.has(m.user.id)) {
      seen.add(m.user.id); onlineMembers.push(m.user)
    }
  }))

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white pt-10 pb-0 shrink-0 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 pb-3">
          <button onClick={() => setShowJoin(true)}
            className="p-2 -ml-2 text-[#007AFF] hover:text-blue-700 transition-colors" title="Nhập mã nhóm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="text-center">
            <h1 className="text-[17px] font-bold text-gray-900">Tin nhắn</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="p-2 -mr-2 text-[#007AFF] hover:text-blue-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="flex bg-gray-100 rounded-full p-1">
            <button className="flex-1 py-1.5 text-sm font-bold text-gray-900 bg-white rounded-full shadow-sm">Chat</button>
            <button onClick={() => router.push('/app/tasks')} className="flex-1 py-1.5 text-sm font-medium text-gray-600 rounded-full hover:bg-white hover:shadow-sm transition-all">Công việc</button>
            <button onClick={() => router.push('/app/dashboard')} className="flex-1 py-1.5 text-sm font-medium text-gray-600 rounded-full hover:bg-white hover:shadow-sm transition-all">AI Insights</button>
          </div>
        </div>
      </header>

      {/* ── Search ── */}
      <div className="px-4 py-2.5 bg-white shrink-0">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm nhóm của bạn..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"/>
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg></button>}
        </div>
      </div>

      {/* ── Action Pills ── */}
      <div className="flex gap-2 px-4 pb-2.5 shrink-0 overflow-x-auto scrollbar-hide">
        {[
          { id: 'all', label: 'Tất cả', count: rooms.length },
          { id: 'channels', label: '# Nhóm', count: channels.length },
          { id: 'dms', label: '💬 DMs', count: dms.length },
        ].map(f => (
          <button key={f.id} onClick={() => setActiveFilter(f.id as typeof activeFilter)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeFilter === f.id ? 'bg-[#007AFF] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f.label} <span className={activeFilter === f.id ? 'text-blue-100' : 'text-gray-400'}>{f.count}</span>
          </button>
        ))}
        <button onClick={() => setShowJoin(true)}
          className="ml-auto px-3.5 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-all flex items-center gap-1 whitespace-nowrap shrink-0">
          🔑 Nhập mã nhóm
        </button>
        <button onClick={() => setShowCreate(true)}
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] border border-blue-200 hover:bg-blue-100 transition-all flex items-center gap-1 whitespace-nowrap shrink-0">
          + Tạo nhóm
        </button>
      </div>

      {/* ── Online Members ── */}
      {!search && onlineMembers.length > 0 && (
        <div className="shrink-0">
          <div className="px-4 pt-2 pb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Đang online · {onlineMembers.length}</p>
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
              {onlineMembers.map(m => (
                <div key={m.id} className="flex flex-col items-center gap-1 shrink-0">
                  <div className="relative">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(m.name)} flex items-center justify-center text-xs font-bold text-white`}>{getInitials(m.name)}</div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"/>
                  </div>
                  <span className="text-[10px] text-gray-500 w-12 text-center truncate">{m.name.split(' ').pop()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-px bg-gray-100"/>
        </div>
      )}

      {/* ── Room List ── */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[1,2,3].map(i => <div key={i} className="flex items-center gap-3 animate-pulse"><div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0"/><div className="flex-1 space-y-2"><div className="h-3.5 bg-gray-100 rounded-full w-2/3"/><div className="h-3 bg-gray-100 rounded-full w-full"/></div></div>)}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-3 px-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-50 to-purple-50 border border-gray-100 flex items-center justify-center text-4xl shadow-sm">
              {search ? '🔍' : '💬'}
            </div>
            <p className="text-gray-700 font-bold text-lg text-center">{search ? `Không tìm thấy "${search}"` : 'Chưa có nhóm nào'}</p>
            <p className="text-gray-400 text-sm text-center leading-snug">
              {search ? 'Thử tìm kiếm với từ khóa khác' : 'Tạo nhóm mới hoặc nhập mã nhóm để tham gia'}
            </p>
            {!search && (
              <div className="flex gap-3 mt-2">
                <button onClick={() => setShowJoin(true)}
                  className="px-5 py-2.5 bg-green-500 text-white font-semibold rounded-full text-sm shadow-sm hover:bg-green-600 transition-colors">
                  🔑 Nhập mã nhóm
                </button>
                <button onClick={() => setShowCreate(true)}
                  className="px-5 py-2.5 bg-[#007AFF] text-white font-semibold rounded-full text-sm shadow-sm hover:bg-blue-600 transition-colors">
                  + Tạo nhóm
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredRooms.map(room => {
              const lastMsg = room.messages?.[room.messages.length - 1]
              const isChannel = room.type === 'channel'
              const hasOnline = room.members?.some(m => m.user.id !== user?.id && onlineUsers.has(m.user.id))
              return (
                <button key={room.id} onClick={() => router.push(`/app/chat/${room.id}`)}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left">
                  <div className="relative shrink-0">
                    {isChannel ? (
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getAvatarColor(room.name)} flex items-center justify-center shadow-sm`}>
                        <span className="text-white text-xl font-bold">#</span>
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(room.name)} flex items-center justify-center text-sm font-bold text-white shadow-sm`}>{getInitials(room.name)}</div>
                    )}
                    {!isChannel && hasOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="text-[15px] font-semibold text-gray-900 truncate">{isChannel ? `# ${room.name}` : room.name}</span>
                      {lastMsg && <span className="text-[11px] text-gray-400 shrink-0">{formatDate(lastMsg.createdAt)}</span>}
                    </div>
                    <p className="text-[13px] text-gray-400 truncate">
                      {lastMsg ? `${lastMsg.sender?.name?.split(' ').pop()}: ${lastMsg.content}` : isChannel ? `${room.members?.length || 0} thành viên` : 'Bắt đầu cuộc trò chuyện...'}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                </button>
              )
            })}
          </div>
        )}
        <div className="h-4"/>
      </main>

      {/* ── FAB ── */}
      <button onClick={() => setShowJoin(true)}
        className="fixed right-5 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg shadow-green-500/25 z-20 flex items-center justify-center transition-all active:scale-95 text-lg font-bold"
        style={{ bottom: 144, width: 44, height: 44 }} title="Nhập mã nhóm">🔑</button>
      <button onClick={() => setShowCreate(true)}
        className="fixed right-5 bg-[#007AFF] hover:bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/25 z-20 flex items-center justify-center transition-all active:scale-95"
        style={{ bottom: 92, width: 52, height: 52 }}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {/* ══════════════════════════════════════
          JOIN GROUP MODAL
      ══════════════════════════════════════ */}
      {showJoin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError('') }}>
          <div className="bg-white w-full rounded-t-3xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"/>
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🔑</div>
              <h2 className="text-[18px] font-bold text-gray-900">Nhập mã nhóm</h2>
              <p className="text-gray-500 text-sm mt-1">Nhập mã do người quản trị nhóm cung cấp</p>
            </div>

            <div className="mb-4">
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinGroup()}
                placeholder="vd: DESIGN2024"
                autoFocus maxLength={30}
                className="w-full text-center text-[20px] font-mono font-bold tracking-[0.25em] bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#007AFF] focus:ring-3 focus:ring-blue-100 uppercase transition-all"/>
            </div>

            {joinError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4 flex items-center gap-2">
                ⚠️ {joinError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError('') }}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors">
                Hủy
              </button>
              <button onClick={joinGroup} disabled={joining || !joinCode.trim()}
                className="flex-1 py-3 bg-[#007AFF] hover:bg-blue-600 disabled:opacity-40 text-white font-bold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                {joining ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : null}
                {joining ? 'Đang vào...' : 'Gia nhập nhóm'}
              </button>
            </div>

            <p className="text-center text-[11px] text-gray-400 mt-4">Mã nhóm phân biệt hoa thường • Được tạo bởi quản trị viên nhóm</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          CREATE GROUP MODAL
      ══════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => !createdRoom && resetCreate()}>
          <div className="bg-white w-full rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 shrink-0"/>

            {/* ── Success Screen ── */}
            {createdRoom ? (
              <div className="flex flex-col items-center justify-center p-8 gap-4">
                <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center text-4xl shadow-sm">🎉</div>
                <h2 className="text-[20px] font-bold text-gray-900">Tạo nhóm thành công!</h2>
                <div className="w-full bg-gray-50 rounded-2xl border border-gray-100 p-4 text-center">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Mã nhóm để chia sẻ</p>
                  <p className="text-[28px] font-mono font-bold text-[#007AFF] tracking-[0.2em]">{createdRoom.roomCode}</p>
                  <p className="text-[12px] text-gray-500 mt-1">Chia sẻ mã này cho thành viên muốn gia nhập</p>
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={resetCreate} className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl">Đóng</button>
                  <button onClick={() => { resetCreate(); router.push(`/app/chat/${createdRoom.id}`) }}
                    className="flex-1 py-3 bg-[#007AFF] text-white font-bold rounded-xl shadow-sm">Vào nhóm →</button>
                </div>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                  <button onClick={createStep === 2 ? () => setCreateStep(1) : resetCreate}
                    className="text-[#007AFF] text-[15px] font-medium py-1 px-1 -ml-1 rounded-lg hover:bg-blue-50 transition-colors">
                    {createStep === 2 ? '← Quay lại' : 'Hủy'}
                  </button>
                  <div className="text-center">
                    <h2 className="text-[16px] font-bold text-gray-900">Tạo nhóm mới</h2>
                    <p className="text-[11px] text-gray-400">Bước {createStep}/2</p>
                  </div>
                  {createStep === 1 ? (
                    <button onClick={() => { if (!groupName.trim()) { setCreateError('Nhập tên nhóm'); return }; if (!groupCode.trim() || groupCode.trim().length < 4) { setCreateError('Mã nhóm tối thiểu 4 ký tự'); return }; setCreateError(''); setCreateStep(2) }}
                      className="text-[#007AFF] text-[15px] font-semibold py-1 px-1 -mr-1 rounded-lg hover:bg-blue-50 transition-colors">Tiếp →</button>
                  ) : (
                    <button onClick={createGroup} disabled={creating}
                      className="text-[#007AFF] disabled:text-gray-300 text-[15px] font-bold py-1 px-1 -mr-1 rounded-lg hover:bg-blue-50 flex items-center gap-1">
                      {creating && <span className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"/>}
                      {creating ? 'Đang tạo...' : 'Tạo nhóm'}
                    </button>
                  )}
                </div>

                {/* Step 1 */}
                {createStep === 1 && (
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <div className="flex justify-center">
                      <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getAvatarColor(groupName || 'G')} flex items-center justify-center shadow-md`}>
                        <span className="text-white text-3xl font-bold">{groupName ? groupName[0].toUpperCase() : '#'}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tên nhóm *</label>
                      <input autoFocus value={groupName} onChange={e => setGroupName(e.target.value)}
                        placeholder="vd: Marketing Team, Dev Sprint..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100 transition-all"/>
                    </div>

                    {/* Room Code — KEY FIELD */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Mã nhóm *
                        <span className="ml-1.5 text-[10px] font-normal text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full normal-case border border-orange-200">
                          🔑 Bắt buộc để gia nhập
                        </span>
                      </label>
                      <input value={groupCode} onChange={e => setGroupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="vd: DESIGN2024"
                        maxLength={20}
                        className="w-full bg-gray-50 border-2 border-orange-200 rounded-xl px-4 py-3 text-[15px] font-mono font-bold text-gray-900 placeholder-gray-300 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 uppercase tracking-[0.2em] transition-all"/>
                      <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                        Chỉ chữ cái và số, tối thiểu 4 ký tự. Thành viên cần nhập đúng mã này để vào nhóm.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mô tả (tùy chọn)</label>
                      <textarea value={groupDesc} onChange={e => setGroupDesc(e.target.value)}
                        placeholder="Nhóm này dùng để thảo luận về..." rows={2}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100 transition-all resize-none"/>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-[14px] font-semibold text-gray-900">Nhóm riêng tư 🔒</p>
                        <p className="text-[12px] text-gray-500">Không hiện trong danh sách công ty</p>
                      </div>
                      <button onClick={() => setIsPrivate(!isPrivate)}
                        className={`relative w-12 h-7 rounded-full transition-colors ${isPrivate ? 'bg-[#007AFF]' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-all ${isPrivate ? 'left-5' : 'left-0.5'}`}/>
                      </button>
                    </div>

                    {createError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">⚠️ {createError}</div>}
                  </div>
                )}

                {/* Step 2 — Add members */}
                {createStep === 2 && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {selectedMembers.length > 0 && (
                      <div className="flex gap-2 px-5 pt-3 pb-2 overflow-x-auto scrollbar-hide shrink-0">
                        {selectedMembers.map(id => {
                          const u = users.find(u => u.id === id)
                          if (!u) return null
                          return (
                            <div key={id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1.5 shrink-0">
                              <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(u.name)} flex items-center justify-center text-[9px] font-bold text-white`}>{getInitials(u.name)}</div>
                              <span className="text-[12px] font-medium text-blue-700">{u.name.split(' ').pop()}</span>
                              <button onClick={() => toggleMember(id)} className="text-blue-400 hover:text-blue-600 ml-0.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/></svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="px-5 pb-2 shrink-0">
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                        <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Tìm thành viên..."
                          className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-[14px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"/>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-1 shrink-0">Thành viên · {selectedMembers.length} đã chọn</p>
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                      {filteredUsers.map(u => {
                        const isSelected = selectedMembers.includes(u.id)
                        return (
                          <button key={u.id} onClick={() => toggleMember(u.id)}
                            className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(u.name)} flex items-center justify-center text-sm font-bold text-white shrink-0`}>{getInitials(u.name)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-semibold text-gray-900">{u.name}</p>
                              <p className="text-[12px] text-gray-400">{u.email}</p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-[#007AFF] border-[#007AFF]' : 'border-gray-300'}`}>
                              {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/></svg>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {createError && <div className="mx-5 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">⚠️ {createError}</div>}
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarColor(groupName)} flex items-center justify-center text-white text-sm font-bold`}>{groupName[0]?.toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 truncate">#{groupName}</p>
                          <p className="text-[11px] text-gray-500">Mã: <span className="font-mono font-bold text-orange-600">{groupCode}</span> · {selectedMembers.length + 1} thành viên</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

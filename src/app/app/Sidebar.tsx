'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from './AppContext'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { useState, useEffect } from 'react'

interface Room { id: string; name: string; type: string; messages: { content: string; sender: { name: string } }[] }

export default function Sidebar() {
  const { user, onlineUsers, logout } = useApp()
  const pathname = usePathname()
  const [rooms, setRooms] = useState<Room[]>([])
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')

  useEffect(() => {
    fetch('/api/rooms').then(r => r.json()).then(d => setRooms(d.rooms || []))
  }, [])

  const createRoom = async () => {
    if (!newRoomName.trim()) return
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoomName.trim().toLowerCase().replace(/\s+/g, '-') })
    })
    const data = await res.json()
    if (data.room) { setRooms(r => [...r, data.room]); setNewRoomName(''); setShowNewRoom(false) }
  }

  const navItems = [
    { href: '/app', icon: '🏠', label: 'Tổng quan', exact: true },
    { href: '/app/tasks', icon: '✅', label: 'Công việc' },
    { href: '/app/dashboard', icon: '📊', label: 'Dashboard' },
  ]

  const channels = rooms.filter(r => r.type === 'channel')
  const dms = rooms.filter(r => r.type === 'direct')

  return (
    <div className="w-64 flex-shrink-0 bg-[#080810] border-r border-white/5 flex flex-col h-full">
      {/* Workspace header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <span className="text-base">⚡</span>
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-white text-sm truncate">Nexus Workspace</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
              <span className="text-xs text-slate-400">{onlineUsers.size + 1} online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-2 space-y-0.5">
        {navItems.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                active ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/5 my-1"/>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kênh</span>
          <button onClick={() => setShowNewRoom(!showNewRoom)}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all text-xs">
            +
          </button>
        </div>

        {showNewRoom && (
          <div className="mx-2 mb-2 flex gap-1">
            <input value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="tên-kênh" autoFocus
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button onClick={createRoom} className="px-2 py-1.5 bg-indigo-600 rounded-lg text-xs text-white hover:bg-indigo-500 transition-all">✓</button>
          </div>
        )}

        <div className="space-y-0.5">
          {channels.map(room => (
            <Link key={room.id} href={`/app/chat/${room.id}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all group ${
                pathname === `/app/chat/${room.id}` ? 'bg-indigo-600/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              <span className="text-slate-500 group-hover:text-slate-300">#</span>
              <span className="truncate">{room.name}</span>
            </Link>
          ))}
        </div>

        {dms.length > 0 && (
          <>
            <div className="flex items-center justify-between px-2 py-2 mt-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tin nhắn trực tiếp</span>
            </div>
            <div className="space-y-0.5">
              {dms.map(room => (
                <Link key={room.id} href={`/app/chat/${room.id}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all ${
                    pathname === `/app/chat/${room.id}` ? 'bg-indigo-600/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white">
                    {room.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{room.name}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(user?.name || '')} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
            {getInitials(user?.name || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button onClick={logout} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-sm" title="Đăng xuất">
            ⎋
          </button>
        </div>
      </div>
    </div>
  )
}

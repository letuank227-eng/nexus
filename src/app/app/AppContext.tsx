'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import io, { Socket } from 'socket.io-client'

interface User {
  id: string; name: string; email: string; phone?: string; avatar?: string
  role: string; companyPosition: string; status: string; companyCode?: string
}

interface AppContextType {
  user: User | null
  socket: Socket | null
  onlineUsers: Set<string>
  logout: () => void
}

const AppContext = createContext<AppContextType>({
  user: null, socket: null, onlineUsers: new Set(), logout: () => {}
})

export const useApp = () => useContext(AppContext)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (!data.user) { router.replace('/login'); return }
        setUser(data.user)

        const s = io({ path: '/socket.io' })
        setSocket(s)

        s.on('connect', () => {
          s.emit('user:online', { userId: data.user.id })
        })

        s.on('user:status', ({ userId, status }: { userId: string; status: string }) => {
          setOnlineUsers(prev => {
            const next = new Set(prev)
            if (status === 'online') next.add(userId)
            else next.delete(userId)
            return next
          })
        })

        setLoading(false)
      })
      .catch(() => router.replace('/login'))
  }, [router])

  const logout = async () => {
    await fetch('/api/auth/me', { method: 'POST' })
    socket?.disconnect()
    router.replace('/login')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#007AFF] to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <span className="text-3xl">⚡</span>
        </div>
        <p className="text-gray-400 text-sm font-medium">WorkHub</p>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#007AFF] animate-bounce" style={{animationDelay:'0ms'}}/>
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{animationDelay:'150ms'}}/>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:'300ms'}}/>
        </div>
      </div>
    </div>
  )

  return (
    <AppContext.Provider value={{ user, socket, onlineUsers, logout }}>
      {children}
    </AppContext.Provider>
  )
}

'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) router.replace('/app/tasks')
        else router.replace('/login')
      })
      .catch(() => router.replace('/login'))
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#007AFF] to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <span className="text-3xl">⚡</span>
        </div>
        <p className="text-gray-400 text-sm font-medium">WorkHub</p>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#007AFF] animate-bounce" style={{ animationDelay: '0ms' }}/>
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}/>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}/>
        </div>
      </div>
    </div>
  )
}

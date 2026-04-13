import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return 'Hôm nay'
  if (days === 1) return 'Hôm qua'
  return d.toLocaleDateString('vi-VN')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function getAvatarColor(name: string): string {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'low': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'todo': return 'text-slate-400 bg-slate-400/10'
    case 'doing': return 'text-blue-400 bg-blue-400/10'
    case 'done': return 'text-emerald-400 bg-emerald-400/10'
    default: return 'text-gray-400 bg-gray-400/10'
  }
}

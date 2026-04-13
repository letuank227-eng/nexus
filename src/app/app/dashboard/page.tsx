'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInitials, getAvatarColor } from '@/lib/utils'

interface Task { id: string; title: string; status: string; priority: string; deadline?: string; assignee?: { name: string }; creator: { name: string }; createdAt: string }
interface User { id: string; name: string; email: string; role: string }

const AI_RECS = [
  { icon: '👥', text: 'Phân phối lại khối lượng công việc cho Sarah do số lượng task quá lớn.' },
  { icon: '📋', text: 'Ủy thác "Website Redesign Review" cho Alex để cân bằng nhóm.' },
  { icon: '☕', text: 'Đề xuất nghỉ giải lao cho nhóm để tránh kiệt sức cuối sprint.' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(d => setTasks(d.tasks || [])).catch(() => {})
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  const totalTasks = tasks.length
  const done  = tasks.filter(t => t.status === 'done').length
  const doing = tasks.filter(t => t.status === 'doing').length
  const todo  = tasks.filter(t => t.status === 'todo').length
  const progress = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0

  const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done')
  const urgent  = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done')

  const userStats = [...users].map(u => ({
    ...u,
    assigned: tasks.filter(t => t.assignee?.name === u.name).length,
    done: tasks.filter(t => t.assignee?.name === u.name && t.status === 'done').length,
  })).sort((a, b) => b.assigned - a.assigned)

  const colTasks = (status: string) => tasks.filter(t => t.status === status).slice(0, 3)

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] text-gray-900 overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white px-4 pt-10 pb-3 flex items-center justify-between border-b border-gray-200 shrink-0 shadow-sm">
        <button className="p-2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="text-center flex-1">
          <h1 className="text-[17px] font-bold text-gray-900">WorkHub Manager</h1>
          <p className="text-xs text-gray-500 font-medium">AI Insights</p>
        </div>
        <button className="p-2 text-gray-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </header>

      {/* ── Segmented Control ── */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex bg-[#f2f2f7] rounded-lg p-1 gap-px">
          <button onClick={() => router.push('/app/chat')}
            className="flex-1 text-[13px] font-medium py-1.5 text-gray-600 rounded-md transition-colors hover:bg-white">Chat</button>
          <button onClick={() => router.push('/app/tasks')}
            className="flex-1 text-[13px] font-medium py-1.5 text-gray-600 rounded-md transition-colors hover:bg-white">Tasks</button>
          <button className="flex-1 text-[13px] font-semibold py-1.5 text-gray-900 bg-white rounded-md shadow-sm">
            AI Insights
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-4 gap-2 px-4 pt-4">
          {[
            { label: 'Tổng', value: totalTasks, color: 'bg-indigo-100 text-indigo-600' },
            { label: 'Làm', value: doing, color: 'bg-blue-100 text-blue-600' },
            { label: 'Xong', value: done, color: 'bg-green-100 text-green-600' },
            { label: 'Todo', value: todo, color: 'bg-gray-100 text-gray-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
              <div className={`text-xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Mini Kanban ── */}
        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          {[
            { id: 'todo',  label: 'Cần làm', count: todo },
            { id: 'doing', label: 'Đang làm', count: doing },
            { id: 'done',  label: 'Hoàn thành', count: done },
          ].map(col => (
            <div key={col.id} className="flex flex-col gap-2">
              <h2 className="text-[12px] font-bold text-gray-900 px-1 flex items-center gap-1 flex-wrap">
                {col.label} <span className="text-gray-400 font-normal">({col.count})</span>
              </h2>
              {colTasks(col.id).map(task => (
                <div key={task.id} onClick={() => router.push(`/app/tasks/${task.id}`)}
                  className="bg-white rounded-lg p-2 shadow-sm border border-gray-100 flex flex-col gap-1.5 cursor-pointer hover:shadow-md transition-all active:scale-[0.97]">
                  <h3 className="text-[11px] font-medium leading-snug text-gray-900 line-clamp-2">{task.title}</h3>
                  <div className="flex items-center gap-1">
                    {task.assignee ? (
                      <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${getAvatarColor(task.assignee.name)} flex items-center justify-center text-[8px] font-bold text-white`}>
                        {getInitials(task.assignee.name)}
                      </div>
                    ) : <div className="w-4 h-4 rounded-full bg-gray-100"/>}
                    <span className={`ml-auto inline-block text-[8px] font-semibold px-1 py-0.5 rounded ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                      task.priority === 'high' ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {task.priority === 'urgent' ? 'Khẩn' : task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Mid' : 'Low'}
                    </span>
                  </div>
                </div>
              ))}
              {colTasks(col.id).length === 0 && (
                <div className="bg-white rounded-lg p-3 border border-dashed border-gray-200 flex items-center justify-center">
                  <span className="text-[10px] text-gray-300">Trống</span>
                </div>
              )}
              <button onClick={() => router.push('/app/tasks')}
                className="w-full bg-[#007AFF] text-white text-[11px] font-semibold py-1.5 rounded-lg shadow-sm hover:bg-blue-600 transition-colors active:scale-[0.97]">
                + Thêm
              </button>
            </div>
          ))}
        </div>

        {/* ── Progress & Sentiment ── */}
        <div className="px-4 grid grid-cols-2 gap-3 mb-3">
          {/* Circular progress */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col items-center">
            <h3 className="text-[12px] font-bold text-gray-900 mb-3 self-start">Tiến độ</h3>
            <div className="relative w-20 h-20">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="30" fill="none" stroke="#f3f4f6" strokeWidth="8"/>
                <circle cx="40" cy="40" r="30" fill="none" stroke="#8B5CF6" strokeWidth="8"
                  strokeDasharray={`${progress * 1.885} 188.5`} strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold text-gray-900">{progress}%</span>
              </div>
            </div>
            <div className="flex justify-between w-full mt-3 text-[10px]">
              {[{ v: `${Math.round(progress)}%`, l: 'Tích cực', c: 'text-green-600' },
                { v: `${Math.round((todo/totalTasks||0)*100)}%`, l: 'Neutral', c: 'text-gray-500' },
                { v: `${overdue.length}`, l: 'Trễ', c: 'text-red-600' }
              ].map(x => (
                <div key={x.l} className="text-center">
                  <div className={`font-bold text-sm ${x.c}`}>{x.v}</div>
                  <div className="text-gray-400">{x.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Velocity chart */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="text-[12px] font-bold text-gray-900 mb-2">Tốc độ hoàn thành</h3>
            <div className="flex items-end gap-1 h-16 mt-2">
              {[40, 65, 50, 80, done > 0 ? Math.min(100, (done/Math.max(totalTasks,1))*100+20) : 30, 75, 90].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm transition-all"
                  style={{ height: `${h}%`, background: i === 4 ? '#8B5CF6' : '#E9D5FF' }}/>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-2">
              <span>Th8</span><span>Th9</span><span>Th10</span>
            </div>
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-1 text-[9px] text-gray-500">
                <div className="w-3 h-0.5 bg-purple-600 rounded"/>Tháng này
              </div>
              <div className="flex items-center gap-1 text-[9px] text-gray-400">
                <div className="w-3 h-0.5 bg-purple-200 rounded"/>So sánh
              </div>
            </div>
          </div>
        </div>

        {/* ── Alerts ── */}
        {(overdue.length > 0 || urgent.length > 0) && (
          <div className="px-4 mb-3">
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <h3 className="text-[13px] font-bold text-orange-800 mb-2 flex items-center gap-1.5">
                <span>⚠️</span> Cảnh báo ({overdue.length + urgent.length})
              </h3>
              <div className="space-y-2">
                {overdue.slice(0, 2).map(t => (
                  <div key={t.id} onClick={() => router.push(`/app/tasks/${t.id}`)}
                    className="flex items-start gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0"/>
                    <div>
                      <p className="text-[12px] font-medium text-red-700 line-clamp-1">{t.title}</p>
                      <p className="text-[10px] text-red-500">Quá hạn: {t.deadline && new Date(t.deadline).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                ))}
                {urgent.slice(0, 2).map(t => (
                  <div key={t.id} onClick={() => router.push(`/app/tasks/${t.id}`)}
                    className="flex items-start gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 shrink-0"/>
                    <p className="text-[12px] font-medium text-orange-700 line-clamp-1">{t.title} — Khẩn cấp</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Team Performance ── */}
        {userStats.length > 0 && (
          <div className="px-4 mb-3">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h3 className="text-[13px] font-bold text-gray-900 mb-3">👥 Hiệu suất team</h3>
              <div className="space-y-3">
                {userStats.slice(0, 4).map(u => {
                  const pct = u.assigned > 0 ? Math.round((u.done / u.assigned) * 100) : 0
                  return (
                    <div key={u.id} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(u.name)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                        {getInitials(u.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-gray-900 truncate">{u.name}</span>
                          <span className="text-gray-400 ml-2">{u.done}/{u.assigned}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}/>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500 shrink-0">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── AI Recommendations ── */}
        <div className="px-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="text-[13px] font-bold text-gray-900 mb-3">🤖 AI Recommendations</h3>
            <div className="space-y-3">
              {AI_RECS.map((rec, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shrink-0 text-lg">
                    {rec.icon}
                  </div>
                  <p className="text-[12px] text-gray-800 flex-1 leading-snug font-medium">{rec.text}</p>
                  <button className="bg-[#007AFF] text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg shadow-sm shrink-0 hover:bg-blue-600 transition-colors">
                    Hành động
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}

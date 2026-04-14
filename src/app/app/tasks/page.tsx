'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../AppContext'
import { getInitials, getAvatarColor } from '@/lib/utils'

interface Task {
  id: string; title: string; description?: string; status: string; priority: string
  deadline?: string; assignee?: { id: string; name: string; avatar?: string }; creator: { name: string }
  createdAt: string
}
interface User { id: string; name: string; avatar?: string }

const COLUMNS = [
  { id: 'todo',  label: 'Cần làm',    labelEn: 'To Do' },
  { id: 'doing', label: 'Đang làm',   labelEn: 'In Progress' },
  { id: 'done',  label: 'Hoàn thành', labelEn: 'Done' },
]

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    urgent: 'bg-red-100 text-red-600',
    high:   'bg-orange-100 text-orange-600',
    medium: 'bg-yellow-100 text-yellow-700',
    low:    'bg-green-100 text-green-700',
  }
  const labels: Record<string, string> = { urgent: 'Priority', high: 'High', medium: 'Medium', low: 'Low' }
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md ${map[priority] || map.medium}`}>
      {labels[priority] || priority}
    </span>
  )
}

export default function TasksPage() {
  const { user, socket } = useApp()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [showModal, setShowModal] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [showAI, setShowAI] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', deadline: '', assignedTo: '' })
  const [aiSummary, setAiSummary] = useState('')
  const [aiTaskSuggestion, setAiTaskSuggestion] = useState<{ title: string; description: string; priority: string; deadline: string | null } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(d => setTasks(d.tasks || [])).catch(() => {})
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('task:updated', (task: Task) => setTasks(prev => prev.map(t => t.id === task.id ? task : t)))
    return () => { socket.off('task:updated') }
  }, [socket])

  const createTask = async () => {
    if (!form.title.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, assignedTo: form.assignedTo || undefined, deadline: form.deadline || undefined })
    })
    const data = await res.json()
    if (data.task) {
      setTasks(prev => [...prev, data.task])
      setForm({ title: '', description: '', priority: 'medium', deadline: '', assignedTo: '' })
      setShowModal(false)
    }
  }

  const moveTask = async (taskId: string, newStatus: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    const data = await res.json()
    if (data.task) {
      setTasks(prev => prev.map(t => t.id === taskId ? data.task : t))
      socket?.emit('task:update', data.task)
    }
  }

  const deleteTask = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const loadAISummary = async () => {
    setAiLoading(true)
    setAiSummary('')
    setAiTaskSuggestion(null)
    try {
      // Summarize based on overdue/urgent tasks as context
      const overdueList = tasks
        .filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done')
        .map(t => t.title).join(', ')
      const context = overdueList
        ? `Nhóm có các task trễ hạn: ${overdueList}`
        : `Nhóm có ${tasks.length} task, ${tasks.filter(t=>t.status==='done').length} đã xong`

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', messageText: `Tóm tắt tình hình và đưa ra đề xuất cụ thể. ${context}` })
      })
      const data = await res.json()
      setAiSummary(data.answer || data.error || 'Không có phản hồi')
    } catch { setAiSummary('Lỗi kết nối AI') } finally { setAiLoading(false) }
  }

  const extractTaskFromAI = async () => {
    if (!aiSummary) return
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-task', messageText: aiSummary })
    })
    const data = await res.json()
    if (data.task) {
      setAiTaskSuggestion(data.task)
      setForm(f => ({
        ...f,
        title: data.task.title || '',
        description: data.task.description || '',
        priority: data.task.priority || 'medium',
        deadline: data.task.deadline ? data.task.deadline.slice(0, 10) : '',
      }))
      setShowModal(true)
    }
  }

  const getColTasks = (status: string) => tasks.filter(t => t.status === status)

  return (
    <div className="flex flex-col h-full bg-white text-gray-800 relative overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white px-4 pt-10 pb-3 flex items-center justify-between shadow-sm shrink-0 border-b border-gray-100">
        <button className="p-2 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="text-center flex-1">
          <h1 className="text-[17px] font-bold leading-tight text-gray-900">WorkHub</h1>
          <p className="text-xs text-gray-500">Bảng điều khiển chính</p>
        </div>
        <button className="p-2 text-gray-400 hover:text-gray-600">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(user?.name || 'U')} flex items-center justify-center text-xs font-bold text-white`}>
            {getInitials(user?.name || 'U')}
          </div>
        </button>
      </header>

      {/* ── Segmented Control ── */}
      <div className="px-4 py-3 bg-white shrink-0">
        <div className="flex bg-gray-100 rounded-full p-1">
          <button onClick={() => router.push('/app/chat')}
            className="flex-1 py-1.5 text-sm font-medium text-gray-600 rounded-full hover:bg-white hover:shadow-sm transition-all">
            Chat
          </button>
          <button className="flex-1 py-1.5 text-sm font-bold text-gray-900 bg-white rounded-full shadow-sm">
            Công việc
          </button>
          <button onClick={() => router.push('/app/dashboard')}
            className="flex-1 py-1.5 text-sm font-medium text-gray-600 rounded-full hover:bg-white hover:shadow-sm transition-all">
            AI Insights
          </button>
        </div>
      </div>

      {/* ── Filter Pills ── */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide">
        {COLUMNS.map(col => {
          const count = getColTasks(col.id).length
          const isActive = activeFilter === col.id
          return (
            <button key={col.id}
              onClick={() => setActiveFilter(isActive ? null : col.id)}
              className={`px-5 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap shadow-sm transition-all ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-[#007AFF] text-white hover:bg-blue-600'
              }`}>
              {col.label} {count}
            </button>
          )
        })}
      </div>

      {/* ── Kanban Board ── */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden bg-gray-50 flex" style={{ paddingBottom: showAI ? 180 : 80 }}>
        <div className="w-3 shrink-0"/>
        {COLUMNS.filter(col => !activeFilter || col.id === activeFilter).map(col => {
          const colTasks = getColTasks(col.id)
          return (
            <section key={col.id}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragging) moveTask(dragging, col.id); setDragging(null) }}
              className="w-64 shrink-0 bg-gray-100 rounded-xl mx-2 my-4 flex flex-col">
              {/* Column header */}
              <div className="p-3 pb-2">
                <h2 className="text-sm font-bold text-gray-900">
                  {col.label} <span className="text-gray-400 font-normal ml-1">({colTasks.length})</span>
                </h2>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto space-y-3 px-2 pb-2 scrollbar-hide">
                {colTasks.map(task => (
                  <article key={task.id} draggable
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => router.push(`/app/tasks/${task.id}`)}
                    className={`bg-white p-3 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.98] ${dragging === task.id ? 'opacity-50 rotate-2' : ''}`}>
                    <h3 className="text-sm font-semibold text-gray-800 leading-snug mb-2">{task.title}</h3>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {task.assignee ? (
                          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(task.assignee.name)} flex items-center justify-center text-[10px] font-bold text-white`}>
                            {getInitials(task.assignee.name)}
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] text-gray-400">?</div>
                        )}
                        {task.deadline && (
                          <span className="text-[10px] text-gray-400">
                            {new Date(task.deadline).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <PriorityBadge priority={task.priority}/>
                    </div>

                    {/* Quick move buttons */}
                    <div className="flex gap-1 pt-2 border-t border-gray-100">
                      {COLUMNS.filter(c => c.id !== col.id).map(c => (
                        <button key={c.id}
                          onClick={e => { e.stopPropagation(); moveTask(task.id, c.id) }}
                          className="flex-1 text-[10px] py-1 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-gray-400 transition-all border border-gray-100">
                          → {c.label}
                        </button>
                      ))}
                      <button
                        onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                        className="px-2 py-1 text-[10px] text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all border border-gray-100">
                        ✕
                      </button>
                    </div>
                  </article>
                ))}

                {colTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-2xl mb-1 opacity-30">📋</p>
                    <p className="text-xs text-gray-400">Kéo task vào đây</p>
                  </div>
                )}

                {/* Add button per column */}
                <button onClick={() => setShowModal(true)}
                  className="w-full py-2 bg-[#007AFF] text-white rounded-lg text-sm font-semibold shadow-sm flex items-center justify-center gap-1 hover:bg-blue-600 transition-colors active:scale-[0.98]">
                  <span>+</span> Thêm
                </button>
              </div>
            </section>
          )
        })}
        <div className="w-3 shrink-0"/>
      </main>

      {/* ── AI Insights Panel ── */}
      {showAI && (
        <div className="absolute left-2 right-2 bg-white rounded-2xl shadow-xl border-2 border-purple-400 p-4 z-20 animate-fade-in"
          style={{ bottom: 80 }}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2 text-purple-700 font-bold text-[15px]">
              <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
              AI Insights
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadAISummary} disabled={aiLoading}
                className="text-[11px] bg-purple-100 text-purple-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50">
                {aiLoading ? 'Phân tích...' : '✨ AI phân tích'}
              </button>
              <button onClick={() => setShowAI(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
              </button>
            </div>
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-2 text-purple-500 text-sm py-2">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"/>
              AI đang phân tích dữ liệu thật...
            </div>
          ) : aiSummary ? (
            <>
              <p className="text-[12px] text-gray-800 mb-3 leading-relaxed whitespace-pre-line">{aiSummary}</p>
              <button onClick={extractTaskFromAI}
                className="w-full py-2.5 bg-purple-100 text-purple-800 font-bold rounded-xl flex justify-center items-center gap-2 hover:bg-purple-200 transition-colors active:scale-[0.98]">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </svg>
                Tạo Task từ gợi ý AI
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 mb-3 leading-snug">
              Nhấn <strong>AI phân tích</strong> để AI đọc dữ liệu task thật và đưa ra gợi ý cụ thể!
            </p>
          )}
        </div>
      )}

      {/* ── Floating Restore AI button ── */}
      {!showAI && (
        <button onClick={() => setShowAI(true)}
          className="absolute right-4 bg-purple-600 text-white rounded-full px-4 py-2 shadow-lg z-20 text-sm font-medium flex items-center gap-1.5 hover:bg-purple-700 transition-colors"
          style={{ bottom: 84 }}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          AI
        </button>
      )}

      {/* ── Floating Action Button (Create Task) ── */}
      <button onClick={() => setShowModal(true)}
        className="absolute right-5 bg-[#007AFF] hover:bg-blue-600 text-white rounded-full shadow-lg z-20 flex items-center justify-center transition-all active:scale-95"
        style={{ bottom: showAI ? 210 : 90, width: 52, height: 52 }}>
        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Create Task Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {/* Handle bar */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"/>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Tạo Công Việc Mới</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tiêu đề *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus
                  placeholder="Nhập tên công việc..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Mô tả</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Chi tiết công việc..." rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none bg-gray-50"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Độ ưu tiên</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-500 bg-gray-50">
                    <option value="low">🟢 Thấp</option>
                    <option value="medium">🟡 Vừa</option>
                    <option value="high">🟠 Cao</option>
                    <option value="urgent">🔴 Khẩn</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-500 bg-gray-50 [color-scheme:light]"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Giao cho</label>
                <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-500 bg-gray-50">
                  <option value="">— Chưa giao —</option>
                  <option value={user?.id}>Tôi ({user?.name})</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all">
                Hủy
              </button>
              <button onClick={createTask} disabled={!form.title.trim()}
                className="flex-1 py-3 bg-[#007AFF] hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-500/30">
                Tạo Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

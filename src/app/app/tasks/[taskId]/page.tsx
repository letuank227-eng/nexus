'use client'
import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../../AppContext'
import BottomNav from '../../BottomNav'
import { formatTime, getInitials, getAvatarColor } from '@/lib/utils'

interface Task {
  id: string; title: string; description?: string; status: string; priority: string
  deadline?: string
  assignee?: { id: string; name: string; avatar?: string }
  creator: { id: string; name: string }
  createdAt: string
}
interface Comment {
  id: string; content: string; createdAt: string
  sender: { id: string; name: string; avatar?: string }
}
interface User { id: string; name: string; avatar?: string }

const AI_SUBTASKS = ['Kiểm tra khả năng responsive', 'Xác minh thương hiệu (branding)', 'Kiểm thử các form nhập liệu', 'Review tối ưu hiệu năng', 'Đảm bảo accessibility']
const AI_TEAM = ['Sarah Lee', 'Alex Chen', 'Minh Tran']

export default function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params)
  const router = useRouter()
  const { user, socket } = useApp()

  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAI, setShowAI] = useState(true)
  const [checkedSubtasks, setCheckedSubtasks] = useState<Set<number>>(new Set())
  const [aiSummary, setAiSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([taskData, userData]) => {
      const found = taskData.tasks?.find((t: Task) => t.id === taskId)
      setTask(found || null)
      setUsers(userData.users || [])
      setLoading(false)
    })
    // Load comments from localStorage (demo purpose)
    const saved = localStorage.getItem(`task-comments-${taskId}`)
    if (saved) setComments(JSON.parse(saved))
  }, [taskId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const toggleSubtask = (i: number) => {
    setCheckedSubtasks(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const sendComment = () => {
    if (!input.trim() || !user) return
    const newComment: Comment = {
      id: Date.now().toString(),
      content: input.trim(),
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name }
    }
    const updated = [...comments, newComment]
    setComments(updated)
    localStorage.setItem(`task-comments-${taskId}`, JSON.stringify(updated))
    setInput('')
    socket?.emit('task:comment', { taskId, comment: newComment })
  }

  const handleAiSummarize = async () => {
    setSummarizing(true)
    // Simulate AI processing
    await new Promise(r => setTimeout(r, 1500))
    const texts = comments.map(c => `${c.sender.name}: ${c.content}`).join('; ')
    if (texts) {
      setAiSummary(`📋 Tóm tắt AI: Task "${task?.title}" đang được thảo luận với ${comments.length} bình luận. ${comments.length > 0 ? `Điểm chính: ${comments[comments.length - 1].content.substring(0, 80)}...` : 'Chưa có bình luận nào.'}`)
    } else {
      setAiSummary('📋 Tóm tắt AI: Chưa có bình luận nào để tổng hợp.')
    }
    setSummarizing(false)
  }

  const getPriorityLabel = (p: string) => {
    const map: Record<string, { label: string; color: string; dot: string }> = {
      urgent: { label: 'Khẩn cấp', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
      high:   { label: 'Cao',      color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
      medium: { label: 'Vừa',      color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
      low:    { label: 'Thấp',     color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
    }
    return map[p] || map.medium
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" style={{ borderWidth: 3 }}/>
          <p className="text-gray-500 text-sm">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500">Không tìm thấy task</p>
          <button onClick={() => router.back()} className="mt-4 text-purple-600 text-sm hover:underline">← Quay lại</button>
        </div>
      </div>
    )
  }

  const priority = getPriorityLabel(task.priority)
  const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' }) : null

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <header className="flex-none bg-white border-b border-gray-200 shadow-sm">
        {/* Status Bar */}
        <div className="flex justify-between items-center px-4 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-50">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            <span>Nexus</span>
          </div>
          <span className="font-semibold text-xs">
            {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex items-center gap-1">
            <span>100%</span>
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/>
            </svg>
          </div>
        </div>
        {/* Top Nav */}
        <div className="flex justify-between items-center px-4 py-3">
          <button onClick={() => router.back()} className="text-[#007AFF] hover:text-blue-700 p-1 -ml-1 rounded-lg hover:bg-blue-50 transition-colors">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/>
            </svg>
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 truncate px-3 flex-1 text-center">{task.title}</h1>
          <button className="text-[#007AFF] hover:text-blue-700 p-1 -mr-1 rounded-lg hover:bg-blue-50 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Scrollable Content ── */}
      <main className="flex-1 overflow-y-auto bg-gray-50/50" style={{ paddingBottom: '160px' }}>
        <div className="px-4 py-4 space-y-4">

          {/* Task Details Card */}
          <section className="bg-[#F3F2F8] rounded-2xl p-4 shadow-sm">
            <div className="space-y-3">
              {/* Status + Priority row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${priority.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`}/>
                  {priority.label}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  task.status === 'done' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  task.status === 'doing' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                  'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {task.status === 'done' ? '✅ Hoàn thành' : task.status === 'doing' ? '🔄 Đang làm' : '📋 Cần làm'}
                </span>
              </div>

              {/* Description */}
              {task.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mô tả</p>
                  <p className="text-[15px] text-gray-800 leading-snug">{task.description}</p>
                </div>
              )}

              {/* Grid info */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Assignee */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Người thực hiện</p>
                  {task.assignee ? (
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(task.assignee.name)} flex items-center justify-center text-xs font-bold text-white`}>
                        {getInitials(task.assignee.name)}
                      </div>
                      <span className="text-[14px] font-medium text-gray-900">{task.assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-[14px] text-gray-400 italic">Chưa giao</span>
                  )}
                </div>
                {/* Due date */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Deadline</p>
                  {deadlineStr ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">📅</span>
                      <span className="text-[14px] font-semibold text-gray-900">{deadlineStr}</span>
                    </div>
                  ) : (
                    <span className="text-[14px] text-gray-400 italic">Chưa đặt</span>
                  )}
                </div>
              </div>

              {/* Creator */}
              <div className="pt-1 border-t border-gray-200/70">
                <p className="text-xs text-gray-400">Tạo bởi <span className="font-medium text-gray-600">{task.creator.name}</span></p>
              </div>
            </div>
          </section>

          {/* AI Assistant Card */}
          {showAI && (
            <section className="border-2 border-purple-600 rounded-2xl p-4 bg-white shadow-md relative overflow-hidden animate-fade-in">
              {/* Purple gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 via-violet-500 to-purple-600 rounded-t-2xl"/>

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="bg-gradient-to-br from-purple-500 to-violet-700 p-2 rounded-xl text-white shadow-lg shadow-purple-500/30">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-[15px]">AI Assistant</h2>
                    <p className="text-[11px] text-purple-600 font-medium">Powered by Nexus AI</p>
                  </div>
                </div>
                <button onClick={() => setShowAI(false)} className="text-gray-300 hover:text-gray-500 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                  </svg>
                </button>
              </div>

              {/* AI Suggested Subtasks */}
              <div className="mb-5">
                <h3 className="font-semibold text-gray-900 text-[14px] mb-2.5 flex items-center gap-1.5">
                  <span className="text-purple-500">✦</span> Subtasks gợi ý:
                </h3>
                <div className="space-y-2">
                  {AI_SUBTASKS.slice(0, 4).map((t, i) => (
                    <label key={i} onClick={() => toggleSubtask(i)} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        checkedSubtasks.has(i)
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-purple-400 group-hover:bg-purple-50'
                      }`}>
                        {checkedSubtasks.has(i) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-[14px] transition-all ${checkedSubtasks.has(i) ? 'text-gray-400 line-through' : 'text-gray-800 group-hover:text-gray-900'}`}>
                        {t}
                      </span>
                    </label>
                  ))}
                </div>
                {checkedSubtasks.size > 0 && (
                  <p className="text-xs text-purple-600 mt-2 font-medium">✓ {checkedSubtasks.size}/{4} subtasks hoàn thành</p>
                )}
              </div>

              {/* AI Recommended Team Members */}
              <div className="pt-3 border-t border-purple-100">
                <h3 className="font-semibold text-gray-900 text-[14px] mb-2.5 flex items-center gap-1.5">
                  <span className="text-purple-500">✦</span> Thành viên được đề xuất:
                </h3>
                <div className="flex items-center gap-4 flex-wrap">
                  {AI_TEAM.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                        {getInitials(name)}
                      </div>
                      <span className="text-[14px] text-gray-900 font-medium">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Restore AI button */}
          {!showAI && (
            <button onClick={() => setShowAI(true)}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 text-sm font-medium hover:bg-purple-50 transition-colors flex items-center justify-center gap-2">
              <span>✦</span> Mở lại AI Assistant
            </button>
          )}

          {/* AI Summary */}
          {aiSummary && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 animate-fade-in">
              <p className="text-[14px] text-purple-800 leading-relaxed">{aiSummary}</p>
            </div>
          )}

          {/* Comments Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-[15px]">Thảo luận ({comments.length})</h3>
            </div>
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-gray-400 text-sm">Chưa có bình luận</p>
                  <p className="text-gray-300 text-xs mt-1">Hãy bắt đầu cuộc thảo luận!</p>
                </div>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(comment.sender.name)} flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5 shadow-sm`}>
                      {getInitials(comment.sender.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-gray-900 text-[14px]">{comment.sender.name}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{formatTime(comment.createdAt)}</span>
                      </div>
                      <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm border border-gray-100">
                        <p className="text-[14px] text-gray-800 leading-snug">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef}/>
            </div>
          </section>
        </div>
      </main>

      {/* ── Bottom Interaction Area ── */}
      <footer className="flex-none absolute w-full bg-white border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" style={{ bottom: '72px' }}>
        <div className="px-4 pt-3 pb-2 space-y-2.5">
          {/* AI Summarize */}
          <button onClick={handleAiSummarize} disabled={summarizing}
            className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]">
            {summarizing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                <span>Đang tóm tắt...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </svg>
                <span>AI Tóm Tắt Bình Luận</span>
              </>
            )}
          </button>

          {/* Message Input */}
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(user?.name || 'U')} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
              {getInitials(user?.name || 'U')}
            </div>
            <div className="flex-1 relative flex items-center">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendComment() } }}
                placeholder="Viết bình luận..."
                className="w-full pl-4 pr-12 py-2.5 bg-white border border-gray-300 rounded-full text-[14px] focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 placeholder-gray-400 shadow-sm transition-all"
              />
              <button onClick={sendComment} disabled={!input.trim()}
                className="absolute right-1.5 w-7 h-7 bg-purple-600 hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all active:scale-95">
                <svg className="w-3.5 h-3.5 text-white -rotate-45" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Bottom Navigation (shared) ── */}
      <div className="flex-none absolute bottom-0 left-0 w-full">
        <BottomNav />
      </div>
    </div>
  )
}

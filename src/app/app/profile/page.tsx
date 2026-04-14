'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../AppContext'
import { getInitials, getAvatarColor } from '@/lib/utils'

interface Task {
  id: string; title: string; status: string; priority: string
  deadline?: string; assignee?: { id: string; name: string }
}

export default function ProfilePage() {
  const { user, setUser, logout } = useApp()
  const router = useRouter()

  // Modal states
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Edit state
  const [editName, setEditName] = useState(user?.name || '')
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saveError, setSaveError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Real task data
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)

  // Real AI insight
  const [aiInsight, setAiInsight] = useState('')
  const [aiInsightLoading, setAiInsightLoading] = useState(false)

  // Fetch tasks
  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(d => setTasks(d.tasks || []))
      .catch(() => {})
      .finally(() => setTasksLoading(false))
  }, [])

  // Derived stats — filtered to my tasks only
  const myTasks = tasks.filter(t => t.assignee?.id === user?.id)
  const done    = myTasks.filter(t => t.status === 'done').length
  const doing   = myTasks.filter(t => t.status === 'doing').length
  const todo    = myTasks.filter(t => t.status === 'todo').length
  const overdue = myTasks.filter(t =>
    t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done'
  ).length
  const total   = myTasks.length
  const rate    = total > 0 ? Math.round(done / total * 100) : 0

  // Load real AI insight
  const loadAIInsight = useCallback(async () => {
    setAiInsightLoading(true)
    try {
      const context = `${user?.name} có ${total} task được giao, ${done} đã xong, ${doing} đang làm, ${overdue} trễ hạn`
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', messageText: `Cho tôi 1 lời khuyên ngắn (1-2 câu) để cải thiện năng suất cá nhân dựa trên: ${context}` })
      })
      const data = await res.json()
      setAiInsight(data.answer || '')
    } catch { setAiInsight('') } finally { setAiInsightLoading(false) }
  }, [user?.name, total, done, doing, overdue])

  // Auto-load AI insight when tasks ready
  useEffect(() => {
    if (!tasksLoading && total >= 0 && !aiInsight) loadAIInsight()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksLoading])

  const openEdit = () => {
    setEditName(user?.name || '')
    setEditAvatar(user?.avatar || '')
    setAvatarPreview(user?.avatar || '')
    setSaveError('')
    setShowEditModal(true)
  }

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload thất bại')
      const data = await res.json()
      setEditAvatar(data.url)
      setAvatarPreview(data.url)
    } catch (e) { setSaveError((e as Error).message) }
    finally { setUploadingAvatar(false) }
  }

  const handleSave = async () => {
    if (!editName.trim()) { setSaveError('Tên không được để trống'); return }
    setSaving(true); setSaveError('')
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), avatar: editAvatar || null })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại')
      setUser(data.user)
      setShowEditModal(false)
    } catch (e) { setSaveError((e as Error).message) }
    finally { setSaving(false) }
  }

  const menuItems = [
    { icon: '👤', label: 'Chỉnh sửa hồ sơ', action: openEdit },
    { icon: '📋', label: 'Xem tất cả task của tôi', action: () => router.push('/app/tasks') },
    { icon: '🔔', label: 'Cài đặt thông báo', action: () => router.push('/app/notifications') },
    { icon: '🤖', label: 'AI Insights & Dashboard', action: () => router.push('/app/dashboard') },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50 text-gray-900 overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white px-4 pt-10 pb-3 flex items-center justify-between border-b border-gray-200 shrink-0 shadow-sm">
        <div className="w-10"/>
        <h1 className="text-[17px] font-bold text-gray-900">Hồ sơ</h1>
        <button onClick={openEdit} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/>
          </svg>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">

        {/* ── Avatar & Name ── */}
        <div className="bg-white px-4 pt-6 pb-5 flex flex-col items-center border-b border-gray-100">
          <button onClick={openEdit} className="relative mb-3 group">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover shadow-lg ring-2 ring-white"/>
            ) : (
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getAvatarColor(user?.name || 'U')} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
                {getInitials(user?.name || 'U')}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/>
              </svg>
            </div>
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"/>
          </button>
          <h2 className="text-[18px] font-bold text-gray-900">{user?.name || 'Người dùng'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{user?.email || ''}</p>
          {user?.companyPosition && (
            <span className="mt-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-full font-medium">
              {user.companyPosition}
            </span>
          )}
          <div className="flex items-center gap-1.5 mt-2 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full"/>
            <span className="text-xs text-green-700 font-medium">Đang hoạt động</span>
          </div>
        </div>

        {/* ── Company & Contact ── */}
        {(user?.companyCode || user?.phone) && (
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {user?.companyCode && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-lg">🏢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Mã công ty</p>
                  <p className="text-[14px] font-bold text-gray-900 font-mono tracking-wider">{user.companyCode}</p>
                </div>
                <span className="text-[11px] bg-blue-50 text-[#007AFF] font-semibold px-2.5 py-1 rounded-full border border-blue-100">Đã xác thực</span>
              </div>
            )}
            {user?.phone && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-lg">📱</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Số điện thoại</p>
                  <p className="text-[14px] font-semibold text-gray-900">{user.phone}</p>
                </div>
                <span className="text-[11px] bg-green-50 text-green-600 font-semibold px-2.5 py-1 rounded-full border border-green-100">✓ OTP</span>
              </div>
            )}
          </div>
        )}

        {/* ── Real Task Stats ── */}
        <div className="mx-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Tình trạng công việc</p>
            {!tasksLoading && total > 0 && (
              <span className="text-[11px] text-gray-400">Hoàn thành {rate}%</span>
            )}
          </div>

          {tasksLoading ? (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex gap-3">
                {[1,2,3,4].map(i => <div key={i} className="flex-1 h-14 skeleton rounded-xl"/>)}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Progress bar */}
              <div className="px-4 pt-3 pb-2">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#007AFF] to-purple-500 rounded-full transition-all duration-700"
                    style={{ width: `${rate}%` }}/>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-right">{done}/{total} task hoàn thành</p>
              </div>
              {/* Stats grid */}
              <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                {[
                  { label: 'Tổng',   value: total, color: 'text-gray-700',  bg: 'bg-gray-50',   icon: '📋' },
                  { label: 'Đang làm', value: doing, color: 'text-blue-600', bg: 'bg-blue-50',  icon: '🔄' },
                  { label: 'Xong',   value: done,  color: 'text-green-600', bg: 'bg-green-50',  icon: '✅' },
                  { label: 'Trễ hạn', value: overdue, color: overdue > 0 ? 'text-red-600' : 'text-gray-400', bg: overdue > 0 ? 'bg-red-50' : 'bg-gray-50', icon: overdue > 0 ? '⚠️' : '🎯' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} flex flex-col items-center py-3 gap-0.5`}>
                    <span className="text-base">{s.icon}</span>
                    <span className={`text-[17px] font-bold ${s.color}`}>{s.value}</span>
                    <span className="text-[9px] text-gray-400 font-medium">{s.label}</span>
                  </div>
                ))}
              </div>
              {/* Overdue tasks list */}
              {overdue > 0 && (
                <div className="border-t border-red-100 px-4 py-2.5 bg-red-50">
                  <p className="text-[11px] font-bold text-red-600 mb-1.5">⚠️ Task trễ hạn ({overdue})</p>
                  {myTasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done').slice(0, 3).map(t => (
                    <button key={t.id} onClick={() => router.push(`/app/tasks/${t.id}`)}
                      className="w-full text-left text-[11px] text-red-700 py-0.5 truncate hover:underline">
                      • {t.title}
                    </button>
                  ))}
                </div>
              )}
              {/* Todo tasks */}
              {todo > 0 && (
                <div className="border-t border-gray-100 px-4 py-2.5">
                  <p className="text-[11px] font-bold text-gray-500 mb-1.5">📌 Cần làm ({todo})</p>
                  {myTasks.filter(t => t.status === 'todo').slice(0, 2).map(t => (
                    <button key={t.id} onClick={() => router.push(`/app/tasks/${t.id}`)}
                      className="w-full text-left text-[11px] text-gray-600 py-0.5 truncate hover:underline">
                      • {t.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── AI Insight (real, per-user) ── */}
        <div className="mx-4 my-4 bg-gradient-to-r from-purple-600 to-violet-600 rounded-2xl p-4 text-white shadow-md shadow-purple-500/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-purple-200 uppercase tracking-wide mb-1">🤖 AI đề xuất cho bạn</p>
              {aiInsightLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                  <p className="text-sm text-white/70">Đang phân tích...</p>
                </div>
              ) : aiInsight ? (
                <p className="text-sm font-medium leading-snug">{aiInsight}</p>
              ) : (
                <p className="text-sm text-white/70">Nhấn để nhận gợi ý cá nhân hoá từ AI</p>
              )}
            </div>
            <button onClick={loadAIInsight} disabled={aiInsightLoading}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold py-1.5 px-3 rounded-lg whitespace-nowrap transition-colors disabled:opacity-50 shrink-0 mt-0.5">
              {aiInsightLoading ? '...' : '✨ Làm mới'}
            </button>
          </div>
        </div>

        {/* ── Menu ── */}
        <div className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {menuItems.map((item, i) => (
            <button key={i} onClick={item.action}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left ${i > 0 ? 'border-t border-gray-100' : ''}`}>
              <span className="text-xl w-7 text-center">{item.icon}</span>
              <span className="flex-1 text-[15px] font-medium text-gray-800">{item.label}</span>
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
              </svg>
            </button>
          ))}
        </div>

        {/* ── Logout ── */}
        <div className="mx-4 mb-8">
          <button onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-2xl border border-red-100 transition-colors flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
            </svg>
            Đăng xuất
          </button>
        </div>
      </main>

      {/* ── Edit Profile Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowEditModal(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <h3 className="text-[17px] font-bold text-gray-900">Chỉnh sửa hồ sơ</h3>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-5">
              {/* Avatar picker */}
              <div className="flex flex-col items-center gap-3">
                <button onClick={() => avatarInputRef.current?.click()} className="relative group">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-24 h-24 rounded-full object-cover ring-4 ring-gray-100 shadow-md"/>
                  ) : (
                    <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getAvatarColor(editName || 'U')} flex items-center justify-center text-3xl font-bold text-white shadow-md ring-4 ring-gray-100`}>
                      {getInitials(editName || 'U')}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploadingAvatar
                      ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      : <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                    }
                  </div>
                </button>
                <p className="text-xs text-gray-400">Nhấn ảnh để đổi avatar</p>
                {avatarPreview && (
                  <button onClick={() => { setEditAvatar(''); setAvatarPreview('') }} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                    Xóa ảnh đại diện
                  </button>
                )}
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = '' }}/>
              </div>
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tên hiển thị</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nhập tên của bạn..." maxLength={50}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[15px] font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"/>
                <p className="text-[11px] text-gray-400 text-right">{editName.length}/50</p>
              </div>
              {saveError && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">⚠️ {saveError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors">Hủy</button>
                <button onClick={handleSave} disabled={saving || uploadingAvatar}
                  className="flex-1 py-3 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: '#007AFF' }}>
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Đang lưu...</> : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Logout Confirm ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Đăng xuất?</h3>
            <p className="text-gray-500 text-sm text-center mb-6">Bạn có chắc muốn đăng xuất khỏi Nexus không?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors">Hủy</button>
              <button onClick={() => { setShowLogoutConfirm(false); logout() }} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-red-500/20">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

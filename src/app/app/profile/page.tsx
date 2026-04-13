'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../AppContext'
import { getInitials, getAvatarColor } from '@/lib/utils'

export default function ProfilePage() {
  const { user, onlineUsers, logout } = useApp()
  const router = useRouter()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const stats = [
    { label: 'Task hoàn thành', value: '12', icon: '✅' },
    { label: 'Đang thực hiện',  value: '5',  icon: '🔄' },
    { label: 'Điểm AI',         value: '98', icon: '⭐' },
  ]

  const menuItems = [
    { icon: '👤', label: 'Chỉnh sửa hồ sở', action: () => {} },
    { icon: '🔔', label: 'Cài đặt thông báo', action: () => router.push('/app/notifications') },
    { icon: '🎨', label: 'Giao diện & Màu sắc', action: () => {} },
    { icon: '🔒', label: 'Bảo mật & Quyền riêng tư', action: () => {} },
    { icon: '🤖', label: 'Cài đặt AI', action: () => router.push('/app/dashboard') },
    { icon: '❓', label: 'Trợ giúp & Hỗ trợ', action: () => {} },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50 text-gray-900 overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white px-4 pt-10 pb-3 flex items-center justify-between border-b border-gray-200 shrink-0 shadow-sm">
        <div className="w-10"/>
        <div className="text-center">
          <h1 className="text-[17px] font-bold text-gray-900">Hồ sơ</h1>
        </div>
        <button className="p-2 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5M3 12h9.75m-9.75 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 013 0m0 0h9.75M3 18h9.75m-9.75 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 013 0m0 0h9.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* ── Avatar & Name ── */}
        <div className="bg-white px-4 pt-6 pb-5 flex flex-col items-center border-b border-gray-100">
          <div className="relative mb-3">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getAvatarColor(user?.name || 'U')} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
              {getInitials(user?.name || 'U')}
            </div>
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"/>
          </div>
          <h2 className="text-[18px] font-bold text-gray-900">{user?.name || 'Người dùng'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{user?.email || ''}</p>
          <div className="flex items-center gap-1.5 mt-2 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full"/>
            <span className="text-xs text-green-700 font-medium">Đang hoạt động</span>
          </div>
        </div>

        {/* ── Company & Contact Info ── */}
        {(user?.companyCode || user?.phone) && (
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {user?.companyCode && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-lg">🏢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Mã số công ty</p>
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

        {/* ── AI Insights Quick Banner ── */}
        <div className="mx-4 my-4 bg-gradient-to-r from-purple-600 to-violet-600 rounded-2xl p-4 text-white shadow-md shadow-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-200 uppercase tracking-wide mb-0.5">AI đề xuất hôm nay</p>
              <p className="text-sm font-medium leading-snug">Phân phối lại khối lượng công việc cho Sarah do số lượng task quá lớn.</p>
            </div>
            <button className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold py-1.5 px-3 rounded-lg ml-3 whitespace-nowrap transition-colors">
              Hành động
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="mx-4 mb-4 grid grid-cols-3 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
              <p className="text-xl mb-0.5">{s.icon}</p>
              <p className="text-[20px] font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Menu Items ── */}
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
        <div className="mx-4 mb-6">
          <button onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-2xl border border-red-100 transition-colors flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
            </svg>
            Đăng xuất
          </button>
        </div>
      </main>

      {/* ── Logout Confirm Modal ── */}
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
            <p className="text-gray-500 text-sm text-center mb-6">Bạn có chắc muốn đăng xuất khỏi WorkHub không?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors">
                Hủy
              </button>
              <button onClick={() => { setShowLogoutConfirm(false); logout() }}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-red-500/20">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

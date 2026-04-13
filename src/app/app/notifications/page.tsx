'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'ai' | 'mention' | 'task' | 'calendar' | 'ai_summary'
  title: string
  message: string
  time: string
  read: boolean
}

const DEMO_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'ai', title: 'AI Insight', message: 'Nhắc nhở deadline "Website redesign review" đang đến gần.', time: '10 phút trước', read: false },
  { id: '2', type: 'mention', title: 'Sarah đề cập bạn', message: 'Sarah đề cập đến bạn trong "Kênh Marketing".', time: '25 phút trước', read: false },
  { id: '3', type: 'task', title: 'Task mới được giao', message: 'Task mới được giao: "Chuẩn bị báo cáo Q4".', time: '1 giờ trước', read: true },
  { id: '4', type: 'task', title: 'Task mới được giao', message: 'Task mới được giao: "Họp khách hàng Q3".', time: '1 giờ trước', read: true },
  { id: '5', type: 'mention', title: 'Alex đề cập bạn', message: 'Alex đề cập đến bạn trong "Website redesign review".', time: '2 giờ trước', read: true },
  { id: '6', type: 'ai_summary', title: 'AI Summary', message: 'Tóm tắt thông minh về các cuộc trò chuyện gần đây đã sẵn sàng.', time: '2 giờ trước', read: true },
  { id: '7', type: 'calendar', title: 'Deadline sắp đến', message: 'Deadline đang đến gần cho "Client meeting notes".', time: '3 giờ trước', read: true },
  { id: '8', type: 'task', title: 'Task hoàn thành', message: '"Prepare Q3 report" đã được đánh dấu hoàn thành.', time: '5 giờ trước', read: true },
]

function NotifIcon({ type }: { type: Notification['type'] }) {
  if (type === 'ai' || type === 'ai_summary') {
    return (
      <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </div>
    )
  }
  if (type === 'task') {
    return (
      <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#007AFF] shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    )
  }
  if (type === 'calendar') {
    return (
      <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-400 shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    )
  }
  // mention - use colored avatar placeholder
  return (
    <div className="w-10 h-10 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600 shrink-0">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifs, setNotifs] = useState(DEMO_NOTIFICATIONS)

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  const unreadCount = notifs.filter(n => !n.read).length

  const isAI = (n: Notification) => n.type === 'ai' || n.type === 'ai_summary'

  return (
    <div className="flex flex-col h-full bg-gray-50 text-gray-900 overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white px-4 pt-10 pb-3 flex items-center justify-between border-b border-gray-200 shrink-0 shadow-sm">
        <button className="p-2 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="text-center flex-1">
          <h1 className="text-[17px] font-bold leading-tight text-gray-900">WorkHub</h1>
          <p className="text-xs text-gray-500">
            Thông báo {unreadCount > 0 && <span className="text-[#007AFF] font-semibold">({unreadCount} mới)</span>}
          </p>
        </div>
        <button className="p-2 text-gray-400 hover:text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </header>

      {/* ── Mark all read ── */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={markAllRead}
          className="w-full bg-[#007AFF] hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-full transition-colors active:scale-[0.98] shadow-sm shadow-blue-500/20">
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* ── Notifications List ── */}
      <main className="flex-1 overflow-y-auto bg-white">
        {notifs.map((notif, i) => (
          <div key={notif.id}
            className={`border-b border-gray-100 transition-colors ${notif.read ? '' : 'bg-blue-50/30'}`}>
            {isAI(notif) ? (
              /* AI notifications - purple highlight */
              <div className="px-4 py-3">
                <div className="bg-purple-50 border border-purple-300 rounded-xl p-3 flex gap-3">
                  <NotifIcon type={notif.type}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-gray-800 leading-snug">
                      <span className="font-bold text-purple-700">{notif.title}: </span>
                      {notif.message}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[11px] text-gray-400">{notif.time}</span>
                    {!notif.read && <div className="w-2 h-2 bg-purple-500 rounded-full ml-auto mt-1"/>}
                  </div>
                </div>
              </div>
            ) : (
              /* Regular notifications */
              <div className="px-4 py-3 flex gap-3 items-start">
                <NotifIcon type={notif.type}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-gray-800 leading-snug">
                    <span className="font-bold">{notif.title}: </span>
                    {notif.message}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">{notif.time}</span>
                  {!notif.read && <div className="w-2 h-2 bg-[#007AFF] rounded-full ml-auto mt-1"/>}
                </div>
              </div>
            )}
          </div>
        ))}

        {notifs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">🔔</div>
            <p className="text-gray-500 font-medium">Không có thông báo</p>
          </div>
        )}

        <div className="h-4"/>
      </main>
    </div>
  )
}

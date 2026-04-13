'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  const isChat          = pathname.startsWith('/app/chat')
  const isTasks         = pathname.startsWith('/app/tasks') || pathname === '/app/dashboard'
  const isNotifications = pathname.startsWith('/app/notifications')
  const isProfile       = pathname.startsWith('/app/profile')

  const tabs = [
    {
      href: '/app/chat',
      label: 'Chat',
      active: isChat,
      icon: (a: boolean) => (
        <svg className="w-[26px] h-[26px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      href: '/app/tasks',
      label: 'Tasks',
      active: isTasks,
      icon: (a: boolean) => (
        <svg className="w-[26px] h-[26px]" fill="none" stroke="currentColor" strokeWidth={a ? 2 : 1.5} viewBox="0 0 24 24">
          <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      href: '/app/notifications',
      label: 'Thông báo',
      active: isNotifications,
      icon: (a: boolean) => (
        <svg className="w-[26px] h-[26px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      href: '/app/profile',
      label: 'Hồ sơ',
      active: isProfile,
      icon: (a: boolean) => (
        <svg className="w-[26px] h-[26px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ]

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-t border-gray-200/80 flex justify-around items-start pt-2 fixed bottom-0 left-0 right-0 z-30"
      style={{ height: 72, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href}
          className={`flex flex-col items-center justify-start w-full gap-0.5 transition-all active:scale-95 ${
            tab.active ? 'text-[#007AFF]' : 'text-gray-400 hover:text-gray-600'
          }`}>
          {/* Active pill indicator */}
          <div className={`w-6 h-0.5 rounded-full mb-0.5 transition-all ${tab.active ? 'bg-[#007AFF]' : 'bg-transparent'}`}/>
          {tab.icon(tab.active)}
          <span className={`text-[10px] mt-0.5 ${tab.active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}

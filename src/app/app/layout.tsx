import { AppProvider } from './AppContext'
import BottomNav from './BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-white text-gray-900">
        <main className="flex-1 flex flex-col overflow-hidden relative pb-[72px]">
          {children}
        </main>
        <BottomNav />
      </div>
    </AppProvider>
  )
}

import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const hideNav = location.pathname.includes('/chat')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-lg">
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-16">
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}

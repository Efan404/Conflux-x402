import { ReactNode } from 'react'
import Navigation from './Navigation'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-dark-900">
      <Navigation />
      <main className="pt-20">
        {children}
      </main>
    </div>
  )
}

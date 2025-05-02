import React from 'react'
import Link from 'next/link'

export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="container mx-auto py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="text-lg font-semibold"
              >
                PersLM
              </Link>
              <nav className="flex items-center space-x-4">
                <Link 
                  href="/monitor"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  Dashboard
                </Link>
                <Link 
                  href="/monitor/v0"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  V0 UI
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="border-t border-gray-200 bg-white py-4">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-gray-500">
            PersLM Task Monitor System
          </div>
        </div>
      </footer>
    </div>
  )
} 
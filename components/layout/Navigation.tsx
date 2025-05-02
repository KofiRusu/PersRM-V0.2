"use client"

import React, { useState } from "react"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { Footer } from "./Footer"
import { cn } from "@/lib/utils"

interface NavigationProps {
  children: React.ReactNode
}

export function Navigation({ children }: NavigationProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header 
        isSidebarOpen={!isSidebarCollapsed} 
        toggleSidebar={toggleSidebar} 
      />
      <div className="flex flex-1">
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          className="hidden lg:block" 
        />
        <main className={cn(
          "flex-1 relative",
          "persrm-main",
          isSidebarCollapsed && "persrm-main-sidebar-collapsed"
        )}>
          <div className="container mx-auto px-4 pb-8 pt-6">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  )
} 
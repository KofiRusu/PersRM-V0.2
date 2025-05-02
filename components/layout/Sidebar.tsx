"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  Code, 
  CheckSquare, 
  Microscope, 
  FileText, 
  Settings,
  LucideIcon,
  Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  className?: string
  isCollapsed?: boolean
}

interface NavItem {
  title: string
  icon: LucideIcon
  href: string
  variant: "default" | "ghost"
}

export function Sidebar({ className, isCollapsed = false }: SidebarProps) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      variant: pathname === "/dashboard" ? "default" : "ghost",
    },
    {
      title: "Reasoning",
      href: "/reasoning",
      icon: Code,
      variant: pathname === "/reasoning" || pathname.startsWith("/reasoning/") ? "default" : "ghost",
    },
    {
      title: "Tasks",
      href: "/tasks",
      icon: CheckSquare,
      variant: pathname === "/tasks" || pathname.startsWith("/tasks/") ? "default" : "ghost",
    },
    {
      title: "Calendar",
      href: "/calendar",
      icon: Calendar,
      variant: pathname === "/calendar" ? "default" : "ghost",
    },
    {
      title: "Analyzer",
      href: "/analyzer",
      icon: Microscope,
      variant: pathname === "/analyzer" || pathname.startsWith("/analyzer/") ? "default" : "ghost",
    },
    {
      title: "Documentation",
      href: "/documentation",
      icon: FileText,
      variant: pathname === "/documentation" ? "default" : "ghost",
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
      variant: pathname === "/settings" ? "default" : "ghost",
    },
  ]

  return (
    <div className={cn("persrm-sidebar", isCollapsed && "persrm-sidebar-collapsed", className)}>
      <div className="flex h-16 items-center justify-center border-b px-4">
        <Link href="/">
          <div className="flex items-center justify-center">
            {isCollapsed ? (
              <span className="font-bold text-xl">P</span>
            ) : (
              <span className="font-bold text-xl">PersRM</span>
            )}
          </div>
        </Link>
      </div>
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={item.variant}
                  size="sm"
                  className={cn(
                    "w-full justify-start",
                    isCollapsed ? "h-10 w-10 p-0 justify-center" : ""
                  )}
                >
                  <item.icon className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
                  {!isCollapsed && <span>{item.title}</span>}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-auto p-4">
        <div className="rounded-md bg-muted p-2">
          <div className="flex items-center justify-center">
            {isCollapsed ? (
              <span className="text-xs text-muted-foreground">v1</span>
            ) : (
              <span className="text-xs text-muted-foreground">PersRM v1.0.0</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 
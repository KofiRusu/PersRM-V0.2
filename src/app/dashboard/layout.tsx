'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronRight, BarChart2, Box, Settings, CheckSquare } from 'lucide-react';

interface SidebarNavProps {
  className?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b">
        <div className="flex h-16 items-center px-4 container">
          <Link href="/" className="flex items-center font-semibold">
            <Box className="mr-2 h-6 w-6" />
            <span>PersLM Dashboard</span>
          </Link>
          <nav className="ml-auto flex items-center space-x-1">
            <Link href="/settings" className="p-2 flex items-center text-sm">
              <Settings className="mr-1 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>
      </div>
      <div className="flex-1 container flex flex-col md:flex-row md:space-x-6 py-6">
        <aside className="md:w-1/5 px-4 md:px-0">
          <div className="sticky top-16">
            <SidebarNav />
          </div>
        </aside>
        <main className="flex-1 px-4 md:px-6 pt-4 md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ className }: SidebarNavProps) {
  const pathname = usePathname();
  
  const navItems = [
    {
      title: 'Analytics',
      href: '/dashboard',
      icon: <BarChart2 className="mr-2 h-4 w-4" />,
      subitems: [
        {
          title: 'Assistant Usage',
          href: '/dashboard/assistant-analytics',
          icon: <ChevronRight className="mr-2 h-4 w-4" />,
        },
      ],
    },
    {
      title: 'Task Monitor',
      href: '/monitor',
      icon: <CheckSquare className="mr-2 h-4 w-4" />,
      subitems: [
        {
          title: 'V0 UI',
          href: '/monitor/v0',
          icon: <ChevronRight className="mr-2 h-4 w-4" />,
        },
      ],
    },
  ];
  
  return (
    <nav className={cn("flex flex-col space-y-1", className)}>
      {navItems.map((item) => (
        <div key={item.href} className="flex flex-col">
          <Link
            href={item.href}
            className={cn(
              "flex items-center px-4 py-2 text-sm font-medium rounded-md hover:bg-muted",
              pathname === item.href ? "bg-muted" : "transparent"
            )}
          >
            {item.icon}
            <span>{item.title}</span>
          </Link>
          {item.subitems && (
            <div className="pl-6 mt-1 space-y-1">
              {item.subitems.map((subitem) => (
                <Link
                  key={subitem.href}
                  href={subitem.href}
                  className={cn(
                    "flex items-center px-4 py-2 text-sm font-medium rounded-md hover:bg-muted",
                    pathname === subitem.href ? "bg-muted" : "transparent"
                  )}
                >
                  {subitem.icon}
                  <span>{subitem.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
} 
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  LayoutGrid, 
  FileText, 
  History, 
  Users, 
  Settings, 
  MessageSquare, 
  GitBranch, 
  ChevronRight,
  Menu,
  X,
  BrainCircuit,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ReasoningAssistantToggle } from '@/components/ui-generator/ReasoningAssistantToggle';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  isActive?: (pathname: string) => boolean;
  children?: NavItem[];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
}

export function DashboardLayout({
  children,
  pageTitle,
  pageDescription,
}: DashboardLayoutProps) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutGrid className="h-5 w-5" />,
      isActive: (pathname) => pathname === '/dashboard',
    },
    {
      title: 'Schema Library',
      href: '/schemas',
      icon: <FileText className="h-5 w-5" />,
      isActive: (pathname) => pathname === '/schemas' || pathname.startsWith('/schemas/'),
      children: [
        {
          title: 'All Schemas',
          href: '/schemas',
          icon: <ChevronRight className="h-4 w-4" />,
          isActive: (pathname) => pathname === '/schemas',
        },
        {
          title: 'My Schemas',
          href: '/schemas/my',
          icon: <ChevronRight className="h-4 w-4" />,
          isActive: (pathname) => pathname === '/schemas/my',
        },
        {
          title: 'Create New Schema',
          href: '/schemas/create',
          icon: <ChevronRight className="h-4 w-4" />,
          isActive: (pathname) => pathname === '/schemas/create',
        },
      ],
    },
    {
      title: 'Version History',
      href: '/versions',
      icon: <History className="h-5 w-5" />,
      isActive: (pathname) => pathname.startsWith('/versions'),
    },
    {
      title: 'Reviews',
      href: '/reviews',
      icon: <GitBranch className="h-5 w-5" />,
      isActive: (pathname) => pathname.startsWith('/reviews'),
    },
    {
      title: 'AI Assistant',
      href: '/ai',
      icon: <BrainCircuit className="h-5 w-5" />,
      isActive: (pathname) => pathname.startsWith('/ai'),
    },
    {
      title: 'Comments',
      href: '/comments',
      icon: <MessageSquare className="h-5 w-5" />,
      isActive: (pathname) => pathname.startsWith('/comments'),
    },
    {
      title: 'Team',
      href: '/team',
      icon: <Users className="h-5 w-5" />,
      isActive: (pathname) => pathname.startsWith('/team'),
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: <Settings className="h-5 w-5" />,
      isActive: (pathname) => pathname.startsWith('/settings'),
    },
  ];

  // Navigation item component
  const NavItem = ({ item }: { item: NavItem }) => {
    const active = item.isActive ? item.isActive(router.pathname) : router.pathname === item.href;
    const [expanded, setExpanded] = useState(active && item.children?.some(child => child.isActive?.(router.pathname)));
    
    return (
      <div>
        <Link 
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
            active 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted"
          )}
          onClick={(e) => {
            if (item.children?.length) {
              e.preventDefault();
              setExpanded(!expanded);
            }
          }}
        >
          {item.icon}
          <span className={cn("flex-1", !isSidebarOpen && "hidden")}>
            {item.title}
          </span>
          {item.children?.length && isSidebarOpen && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              <ChevronRight 
                className={cn(
                  "h-4 w-4 transition-transform", 
                  expanded ? "rotate-90" : ""
                )} 
              />
            </Button>
          )}
        </Link>
        
        {item.children?.length && expanded && isSidebarOpen && (
          <div className="pl-5 mt-1 space-y-1">
            {item.children.map((child, i) => {
              const childActive = child.isActive 
                ? child.isActive(router.pathname) 
                : router.pathname === child.href;
                
              return (
                <Link
                  key={i}
                  href={child.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                    childActive 
                      ? "bg-primary/10 text-primary" 
                      : "hover:bg-muted"
                  )}
                >
                  {child.icon}
                  <span>{child.title}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Mobile sidebar
  const MobileSidebar = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FileText className="h-6 w-6" />
            <span>Schema UI System</span>
          </Link>
        </div>
        <ScrollArea className="h-[calc(100vh-4rem)] py-4 px-3">
          <div className="space-y-1">
            {navItems.map((item, i) => (
              <NavItem key={i} item={item} />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile menu */}
          <MobileSidebar />
          
          {/* Desktop menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FileText className="h-6 w-6" />
            <span className="hidden md:inline-block">Schema UI System</span>
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {/* Search */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>
          
          {/* Theme toggle */}
          <ThemeToggle />
          
          {/* Reasoning Assistant Toggle */}
          <ReasoningAssistantToggle />
          
          {/* User */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src="/avatar.png" alt="User" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <span className="sr-only">User menu</span>
            </Button>
            
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border bg-background shadow-lg">
                <div className="p-2">
                  <div className="border-b pb-2 mb-2">
                    <p className="font-medium">Username</p>
                    <p className="text-sm text-muted-foreground">user@example.com</p>
                  </div>
                  <Link 
                    href="/profile" 
                    className="block px-3 py-1.5 rounded-md hover:bg-muted text-sm"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Your Profile
                  </Link>
                  <Link 
                    href="/settings" 
                    className="block px-3 py-1.5 rounded-md hover:bg-muted text-sm"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link 
                    href="/logout" 
                    className="block px-3 py-1.5 rounded-md hover:bg-muted text-sm"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Logout
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside 
          className={cn(
            "fixed inset-y-0 z-20 mt-16 hidden border-r bg-background md:flex md:flex-col",
            isSidebarOpen ? "w-64" : "w-[70px]"
          )}
        >
          <ScrollArea className="flex-1 py-4 px-3">
            <div className="space-y-1">
              {navItems.map((item, i) => (
                <NavItem key={i} item={item} />
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Main content */}
        <main 
          className={cn(
            "flex-1 pb-12 pt-6",
            isSidebarOpen ? "md:pl-64" : "md:pl-[70px]"
          )}
        >
          <div className="px-4 sm:px-6 lg:px-8">
            {(pageTitle || pageDescription) && (
              <div className="mb-6">
                {pageTitle && <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>}
                {pageDescription && <p className="text-muted-foreground">{pageDescription}</p>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout; 
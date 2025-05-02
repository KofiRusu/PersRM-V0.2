import React from "react"
import { cn } from "@/lib/utils"

interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  return (
    <footer className={cn("border-t py-4 px-6", className)}>
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-10 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built with ❤️ by the PersRM team. &copy; {new Date().getFullYear()} PersRM.
        </p>
        <div className="flex items-center gap-4">
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noreferrer" 
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
          <a 
            href="/documentation" 
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Documentation
          </a>
          <a 
            href="/privacy" 
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy
          </a>
        </div>
      </div>
    </footer>
  )
} 
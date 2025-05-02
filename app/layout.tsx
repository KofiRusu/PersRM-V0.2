import type { Metadata, Viewport } from "next"
import { Inter as FontSans } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { ThemeProvider } from "@/lib/context/theme-provider"
import { cn } from "@/lib/utils"
import { Navigation } from "@/components/layout/Navigation"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = localFont({
  src: "../public/fonts/JetBrainsMono-Regular.woff2",
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "PersRM - Personalized Reasoning Model",
  description: "Advanced AI reasoning and UI/UX optimization platform",
  authors: [{ name: "PersRM Team" }],
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontMono.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navigation>{children}</Navigation>
        </ThemeProvider>
      </body>
    </html>
  )
} 
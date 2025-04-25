import '@/styles/globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import { ReasoningAssistantProvider } from '@/components/ui-generator/ReasoningAssistantProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PersLM - AI UI Generator',
  description: 'A personal LLM-powered UI generator',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReasoningAssistantProvider>
          {children}
        </ReasoningAssistantProvider>
        <Toaster />
      </body>
    </html>
  )
} 
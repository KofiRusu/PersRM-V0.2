'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptInputProps {
  onSubmit: (prompt: string) => void
  loading?: boolean
  className?: string
  placeholder?: string
  examples?: string[]
}

export default function PromptInput({
  onSubmit,
  loading = false,
  className,
  placeholder = "Describe the UI component you want to generate...",
  examples = [
    "A sign-up form with email, password, and confirm password fields",
    "A product card with image, title, price, and add to cart button",
    "A navigation bar with logo, links, and a user dropdown",
    "A pricing table with three tiers: Basic, Pro, and Enterprise",
    "A contact form with name, email, subject, and message fields"
  ],
}: PromptInputProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim() && !loading) {
      onSubmit(prompt.trim())
    }
  }

  const handleExampleClick = (example: string) => {
    setPrompt(example)
  }

  return (
    <div className={cn("space-y-4", className)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          className="min-h-[120px] resize-y"
          disabled={loading}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={!prompt.trim() || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate UI"
            )}
          </Button>
        </div>
      </form>

      {examples.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Or try one of these examples:
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick(example)}
                className="text-xs"
                disabled={loading}
              >
                {example.length > 30 ? example.substring(0, 30) + '...' : example}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 
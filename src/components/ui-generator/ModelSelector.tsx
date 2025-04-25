'use client'

import { useState } from 'react'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { isProviderAvailable } from '@/lib/aiClient'

interface ModelSelectorProps {
  selected: string
  setSelected: (modelId: string) => void
  className?: string
}

type ModelOption = {
  id: string
  name: string
  description: string
  provider: 'openai' | 'ollama' | 'deepseek' | 'custom'
}

export default function ModelSelector({ 
  selected, 
  setSelected,
  className 
}: ModelSelectorProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [useOpenAI, setUseOpenAI] = useState(true)
  const [useDeepSeek, setUseDeepSeek] = useState(true)
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [customModels, setCustomModels] = useState<ModelOption[]>([])

  // Check if providers are available
  const openAIAvailable = isProviderAvailable('openai')
  const deepSeekAvailable = isProviderAvailable('deepseek')

  const defaultModels: ModelOption[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'OpenAI\'s most powerful model for UI generation',
      provider: 'openai',
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Faster, more economical option from OpenAI',
      provider: 'openai',
    },
    {
      id: 'deepseek-chat',
      name: 'DeepSeek Chat',
      description: 'Reasoning-focused model from DeepSeek',
      provider: 'deepseek',
    },
    {
      id: 'llama3',
      name: 'Llama 3',
      description: 'Local Llama 3 model via Ollama',
      provider: 'ollama',
    },
    {
      id: 'mistral',
      name: 'Mistral',
      description: 'Local Mistral model via Ollama',
      provider: 'ollama',
    },
  ]

  // Filter out models based on availability
  const availableModels = defaultModels.filter(model => 
    (model.provider !== 'openai' || openAIAvailable) && 
    (model.provider !== 'deepseek' || deepSeekAvailable)
  );
  
  const models = [...availableModels, ...customModels]
  
  const handleAddCustomModel = () => {
    // This would open a dialog to add custom model config
    // For simplicity, we're not implementing this now
  }

  return (
    <div className={cn("flex items-center", className)}>
      <Select
        value={selected}
        onValueChange={setSelected}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          <div className="max-h-[300px] overflow-auto">
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span>{model.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {model.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </div>
        </SelectContent>
      </Select>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="ml-2">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Model Settings</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Model Settings</DialogTitle>
            <DialogDescription>
              Configure your AI model preferences
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="use-openai">Use OpenAI</Label>
              <Switch
                id="use-openai"
                checked={useOpenAI}
                onCheckedChange={setUseOpenAI}
              />
            </div>
            {useOpenAI && (
              <div className="grid gap-2">
                <Label htmlFor="api-key">OpenAI API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground">
                  Your API key is stored locally and never sent to our servers.
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <Label htmlFor="use-deepseek">Use DeepSeek</Label>
              <Switch
                id="use-deepseek"
                checked={useDeepSeek}
                onCheckedChange={setUseDeepSeek}
              />
            </div>
            {useDeepSeek && (
              <div className="grid gap-2">
                <Label htmlFor="deepseek-api-key">DeepSeek API Key</Label>
                <Input
                  id="deepseek-api-key"
                  type="password"
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground">
                  Your DeepSeek API key is stored locally and never sent to our servers.
                </p>
                {!deepSeekAvailable && (
                  <p className="text-xs text-destructive">
                    DeepSeek API is currently unavailable. Using OpenAI as fallback.
                  </p>
                )}
              </div>
            )}
            
            {!useOpenAI && !useDeepSeek && (
              <div className="grid gap-2">
                <Label htmlFor="ollama-url">Ollama URL</Label>
                <Input
                  id="ollama-url"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                />
                <p className="text-xs text-muted-foreground">
                  URL where your Ollama instance is running
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSettingsOpen(false)}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 
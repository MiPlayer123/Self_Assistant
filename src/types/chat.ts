// General chatbot types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  context?: ContextData
  status: 'sending' | 'streaming' | 'complete' | 'error'
  metadata?: MessageMetadata
}

export interface ContextData {
  screenshot?: ScreenshotData
  selectedText?: string
  applicationContext?: string
}

export interface ScreenshotData {
  base64: string
  path: string
  preview: string
  timestamp: Date
}

export interface MessageMetadata {
  model?: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  processingTime?: number
  hasImageAnalysis?: boolean
}

export interface ChatState {
  messages: ChatMessage[]
  isProcessing: boolean
  selectedModel: string
  currentContext?: ContextData
}

export type ChatRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'sending' | 'complete' | 'error' 
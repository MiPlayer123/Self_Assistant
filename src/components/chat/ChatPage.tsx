import React, { useEffect, useRef } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { OpenAIChatModel } from '../../models/providers/openai/ChatModel'
import { getOpenAIApiKey } from '../../models/ModelManager'
import { ContextData } from '../../types/chat'

interface ChatPageProps {
  onTakeScreenshot: () => Promise<string>
  onGetImagePreview: (path: string) => Promise<string>
}

export function ChatPage({ onTakeScreenshot, onGetImagePreview }: ChatPageProps) {
  const { state, addMessage, updateMessage, setProcessing, setContext } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatModelRef = useRef<OpenAIChatModel | null>(null)

  // Initialize chat model (only once)
  useEffect(() => {
    const initializeModel = async () => {
      try {
        const apiKey = await getOpenAIApiKey()
        chatModelRef.current = new OpenAIChatModel({
          apiKey,
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 2000
        })
        console.log('Chat model initialized successfully')
      } catch (error) {
        console.error('Failed to initialize chat model:', error)
        addMessage({
          role: 'system',
          content: '❌ Error: Could not initialize AI model. Please set your OpenAI API key in the .env file:\n\nVITE_OPENAI_API_KEY=your_api_key_here\n\nThen restart the application.',
          status: 'error'
        })
      }
    }
    
    initializeModel()
  }, []) // Remove dependencies to prevent re-initialization

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages])

  // Add welcome message on first load (only once)
  useEffect(() => {
    if (state.messages.length === 0) {
      addMessage({
        role: 'assistant',
        content: "Hi! I'm Wagoo, your AI assistant. 👋\n\nI can help you with anything - ask questions, analyze screenshots, or just have a conversation.\n\n🔧 **To get started:**\n1. Create a `.env` file in the project root\n2. Add: `VITE_OPENAI_API_KEY=your_api_key_here`\n3. Restart the app\n\nTry sending me a message!",
        status: 'complete'
      })
    }
  }, []) // Remove dependencies to prevent infinite loops

  const handleSendMessage = async (message: string) => {
    if (!chatModelRef.current) {
      addMessage({
        role: 'system',
        content: 'Error: AI model not available',
        status: 'error'
      })
      return
    }

    // Add user message
    addMessage({
      role: 'user',
      content: message,
      context: state.currentContext,
      status: 'complete'
    })

    setProcessing(true)

    try {
      // Send to AI model
      const response = await chatModelRef.current.sendMessage(
        message,
        state.currentContext,
        state.messages
      )

      if (response.success && response.data) {
        // Add successful assistant response
        addMessage({
          role: 'assistant',
          content: response.data,
          status: 'complete',
          metadata: {
            model: state.selectedModel,
            tokenUsage: response.usage
          }
        })
      } else {
        // Add error message
        addMessage({
          role: 'assistant',
          content: `Error: ${response.error || 'Failed to get response'}`,
          status: 'error'
        })
      }
    } catch (error: any) {
      // Add error message
      addMessage({
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong'}`,
        status: 'error'
      })
    } finally {
      setProcessing(false)
      // Clear context after use
      setContext(undefined)
    }
  }

  const handleTakeScreenshot = async () => {
    try {
      console.log('Taking screenshot...')
      const screenshotPath = await onTakeScreenshot()
      console.log('Screenshot path:', screenshotPath)
      
      const screenshotDataUrl = await onGetImagePreview(screenshotPath)
      console.log('Screenshot data URL length:', screenshotDataUrl.length)
      console.log('Screenshot data URL start:', screenshotDataUrl.substring(0, 100))
      
      // Extract base64 data from data URL (remove "data:image/png;base64," prefix)
      const base64Data = screenshotDataUrl.replace(/^data:image\/[a-z]+;base64,/, '')
      console.log('Extracted base64 length:', base64Data.length)
      console.log('Base64 starts with:', base64Data.substring(0, 50))
      
      // Set the screenshot in context for the next message
      setContext({
        screenshot: {
          path: screenshotPath,
          base64: base64Data,
          preview: screenshotDataUrl,
          timestamp: new Date()
        }
      })

      addMessage({
        role: 'system',
        content: '📸 Screenshot captured! It will be included with your next message for AI analysis.',
        status: 'complete'
      })
    } catch (error: any) {
      console.error('Screenshot error:', error)
      addMessage({
        role: 'system',
        content: `Failed to take screenshot: ${error.message}`,
        status: 'error'
      })
    }
  }

  console.log('ChatPage rendering...')
  
  return (
    <div className="flex flex-col h-full w-full bg-white min-h-[400px]">
      {/* Chat header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Wagoo</h1>
            <p className="text-sm text-gray-500">Your AI Personal Assistant</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">
              Model: {state.selectedModel}
            </div>
            {state.currentContext?.screenshot && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Screenshot ready
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="space-y-4">
          {state.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        <ChatInput
          onSendMessage={handleSendMessage}
          onTakeScreenshot={handleTakeScreenshot}
          isProcessing={state.isProcessing}
          hasScreenshot={!!state.currentContext?.screenshot}
        />
      </div>
    </div>
  )
} 
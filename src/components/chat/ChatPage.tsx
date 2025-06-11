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
  const { state, addMessage, addMessageWithId, updateMessage, appendToMessage, setProcessing, setContext, clearMessages } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatModelRef = useRef<OpenAIChatModel | null>(null)
  const welcomeMessageAddedRef = useRef<boolean>(false)

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
          role: 'assistant',
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
    if (state.messages.length === 0 && !welcomeMessageAddedRef.current) {
      welcomeMessageAddedRef.current = true
      addMessage({
        role: 'assistant',
        content: "Wagoo here, what can I do for you?",
        status: 'complete'
      })
    }
  }, [state.messages.length, addMessage])

  const handleSendMessage = async (message: string) => {
    if (!chatModelRef.current) {
      addMessage({
        role: 'assistant',
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

    // Show different processing message if image is included
    if (state.currentContext?.screenshot) {
      addMessage({
        role: 'assistant',
        content: '🔍 Analyzing image and processing your request...',
        status: 'complete'
      })
    }

    // Generate a unique ID for the streaming message
    const streamingMessageId = `streaming-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Create empty assistant message for streaming with our own ID
    const streamingMessage = {
      id: streamingMessageId,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
      status: 'streaming' as const,
      metadata: {
        model: state.selectedModel,
        hasImageAnalysis: !!state.currentContext?.screenshot
      }
    }
    
    addMessageWithId(streamingMessage)

    try {
      // Send to AI model with streaming
      const response = await chatModelRef.current!.sendMessageStream(
        message,
        state.currentContext,
        state.messages, // Use current state messages (the addMessage above will update this)
        (chunk: string) => {
          // This callback is called for each streaming chunk
          // Find the streaming message by checking for streaming status and empty/partial content
          appendToMessage(streamingMessageId, chunk)
        }
      )

      if (response.success) {
        // Mark message as complete and add metadata
        updateMessage(streamingMessageId, {
          status: 'complete',
          metadata: {
            model: state.selectedModel,
            tokenUsage: response.usage,
            hasImageAnalysis: !!state.currentContext?.screenshot
          }
        })
      } else {
        // Update message with error
        updateMessage(streamingMessageId, {
          content: `Error: ${response.error || 'Failed to get response'}`,
          status: 'error'
        })
      }
    } catch (error: any) {
      // Update message with error
      updateMessage(streamingMessageId, {
        content: `Error: ${error.message || 'Something went wrong'}`,
        status: 'error'
      })
    } finally {
      setProcessing(false)
      // Clear context after use
      setContext(undefined)
    }
  }

  const handleResetChat = () => {
    clearMessages()
    addMessage({
      role: 'assistant',
      content: "Wagoo here, what can I do for you?",
      status: 'complete'
    })
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
        role: 'assistant',
        content: '📸 Screenshot captured! It will be analyzed in detail when you send your next message.',
        status: 'complete'
      })
    } catch (error: any) {
      console.error('Screenshot error:', error)
      addMessage({
        role: 'assistant',
        content: `Failed to take screenshot: ${error.message}`,
        status: 'error'
      })
    }
  }

  console.log('ChatPage rendering...')
  
  return (
    <div className="wagoo-chat-container wagoo-fade-in">
      {/* Chat header */}
      <div className="wagoo-chat-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold wagoo-text-primary">Wagoo</h1>
            <p className="text-sm wagoo-text-secondary">Your AI Personal Assistant</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetChat}
              className="p-1 rounded-md hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Reset Chat History"
              title="Reset Chat History"
            >
              <span className="text-lg">↺</span>
            </button>
            <div className="text-sm wagoo-text-muted">
              Model: {state.selectedModel}
            </div>
            {state.currentContext?.screenshot && (
              <div className="wagoo-context-indicator">
                <span className="wagoo-status-dot"></span>
                Screenshot ready
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="wagoo-chat-messages">
        <div className="space-y-6 py-4">
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
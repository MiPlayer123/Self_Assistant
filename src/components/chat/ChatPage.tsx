import React, { useEffect, useRef } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
// Assuming OpenAIChatModel is the class we modified, which should be OpenAIModel
// If OpenAIChatModel is a different, simpler class, this import needs to change
// For now, proceeding with the assumption it's the correct, updated model class.
import { OpenAIModel as OpenAIChatModel } from '../../models/providers/openai/OpenAIModel'
import { getOpenAIApiKey } from '../../models/ModelManager'
import { ContextData } from '../../types/chat'
import { ToolRegistry } from '../../tools/ToolRegistry'
import { ScreenshotTool } from '../../tools/ScreenshotTool'

interface ChatPageProps {
  onTakeScreenshot: () => Promise<string>
  onGetImagePreview: (path: string) => Promise<string>
}

export function ChatPage({ onTakeScreenshot, onGetImagePreview }: ChatPageProps) {
  const { state, addMessage, addMessageWithId, updateMessage, appendToMessage, setProcessing, setContext, clearMessages } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatModelRef = useRef<OpenAIChatModel | null>(null)
  const toolRegistryRef = useRef<ToolRegistry | null>(null)
  const welcomeMessageAddedRef = useRef<boolean>(false)

  // Initialize chat model and tool registry (only once)
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('ChatPage: Starting initialization...')
        console.log('ChatPage: electronAPI available?', !!(window as any).electronAPI)
        console.log('ChatPage: getEnvVar available?', !!(window as any).electronAPI?.getEnvVar)

        // Initialize Tool Registry
        const registry = new ToolRegistry()
        const screenshotTool = new ScreenshotTool()
        registry.registerTool(screenshotTool)
        toolRegistryRef.current = registry
        console.log('Tool registry initialized and screenshot tool registered.')

        // Initialize Model
        console.log('ChatPage: Attempting to get API key...')
        const apiKey = await getOpenAIApiKey()
        console.log('ChatPage: API key received:', apiKey ? 'exists' : 'missing')
        
        // Ensure config matches what OpenAIModel expects (ModelConfig from '../../models/base/types')
        chatModelRef.current = new OpenAIChatModel({
          apiKey,
          model: 'gpt-4o', // This should align with ModelConfig's model field
          temperature: 0.7,
          maxTokens: 2000,
          // Other fields from ModelConfig if needed, e.g. stream, etc.
        } as any) // Using 'as any' for now if OpenAIChatModel constructor expects full ModelConfig
        console.log('Chat model initialized successfully')
      } catch (error) {
        console.error('Failed to initialize chat model or tool registry:', error)
        console.error('Error details:', error instanceof Error ? error.stack : error)
        addMessage({
          role: 'assistant',
          content: '❌ Error: Could not initialize AI model. Please set your OpenAI API key in the .env file:\n\nVITE_OPENAI_API_KEY=your_api_key_here\n\nThen restart the application.',
          status: 'error'
        })
      }
    }
    
    initialize()
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
        state.messages,
        (chunk: string, isFunctionCall?: boolean, toolName?: string) => {
          if (isFunctionCall && toolName) {
            // Update the message to indicate tool usage
            // Content will be temporarily overwritten, then final response will come
            updateMessage(streamingMessageId, {
              content: `Using tool: ${toolName}...`,
              // We might want a new status like 'tool_calling' or keep 'streaming'
            })
          } else if (isFunctionCall === undefined && toolName === undefined && chunk === null) {
            // This condition might occur if the model responds with only a tool call and no text part initially.
            // The OpenAIModel's onChunk for tool call notification should ideally handle this.
            // If the assistant's first message part is purely a tool call,
            // the UI will show "Using tool: ..." from the specific onChunk call.
            // If there's also text, that text will be streamed first.
            // We ensure that the message content is not set to "null" or "undefined".
            // If `updateMessage` was called with `Using tool: ...`, we might not want to overwrite it with an empty chunk here.
            // Let's ensure we only append actual content.
          }
          else {
            // If it's a regular text chunk, append it.
            // If a "Using tool..." message was set, this will append to it.
            // This might not be ideal if the tool message should be replaced by the actual response.
            // Consider clearing the "Using tool..." message if a text chunk arrives *after* it for the same messageId.
            // For now, simple append. The final response from the second API call (after tool execution)
            // will create the definitive content.
             const currentMessage = state.messages.find(m => m.id === streamingMessageId);
             if (currentMessage?.content.startsWith("Using tool:") && !isFunctionCall) {
               // If we were showing "Using tool..." and now get real content, replace it.
               updateMessage(streamingMessageId, { content: chunk });
             } else {
               appendToMessage(streamingMessageId, chunk);
             }
          }
        },
        toolRegistryRef.current?.getToolDefinitions(),
        toolRegistryRef.current!
      )

      // The 'response' here is from OpenAIModel, which should be ModelResponse<string>
      // It includes { success, data, usage?, error? }
      if (response.success) {
        // The final content is in response.data
        // The onChunk would have handled intermediate updates.
        // We need to ensure the final message content is set correctly from response.data,
        // especially if "Using tool..." was shown.
        updateMessage(streamingMessageId, {
          content: response.data, // This is the final textual response from the LLM
          status: 'complete',
          metadata: {
            model: state.selectedModel, // Ensure selectedModel is the one used, or get from response
            tokenUsage: response.usage,
            hasImageAnalysis: !!state.currentContext?.screenshot,
            // functionCall: response.functionCall // If OpenAIModel provides this in ModelResponse
          }
        })
      } else {
        updateMessage(streamingMessageId, {
          content: `Error: ${response.error || 'Failed to get response'}`,
          status: 'error'
        })
      }
    } catch (error: any) {
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
        <div className="space-y-1 py-1">
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
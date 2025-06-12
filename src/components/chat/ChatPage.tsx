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
  const { state, addMessage, addMessageWithId, updateMessage, appendToMessage, setProcessing, setContext, clearMessages, setFirstMessage } = useChat()
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

  // Helper to take screenshot without sending chat message, returns base64 if successful
  const takeScreenshotForCheck = async (): Promise<string | null> => {
    try {
      console.log('Taking screenshot for check...');
      const screenshotPath = await onTakeScreenshot();
      if (!screenshotPath) return null;

      const screenshotDataUrl = await onGetImagePreview(screenshotPath);
      if (!screenshotDataUrl) return null;

      const base64Data = screenshotDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

      // Set context temporarily for the check
      setContext({
        screenshot: {
          path: screenshotPath,
          base64: base64Data,
          preview: screenshotDataUrl,
          timestamp: new Date()
        }
      });
      return base64Data;
    } catch (error) {
      console.error('Screenshot for check error:', error);
      return null;
    }
  }

  const handleSendMessage = async (message: string) => {
    if (!chatModelRef.current) {
      addMessage({
        role: 'assistant',
        content: 'Error: AI model not available',
        status: 'error'
      })
      return
    }

    let currentMessageContext = state.currentContext;

    if (state.isFirstMessage) {
      console.log('First message, checking if screenshot is required...');
      const tempScreenshotBase64 = await takeScreenshotForCheck();

      if (tempScreenshotBase64 && chatModelRef.current) {
        const screenshotNeeded = await chatModelRef.current.isScreenshotRequired(message, tempScreenshotBase64);
        if (screenshotNeeded) {
          console.log('Screenshot IS required by the model.');
          // Screenshot is already in context due to takeScreenshotForCheck, just keep it.
          // Send a message to inform the user that the screenshot will be used.
          addMessage({
            role: 'assistant',
            content: '📸 Screenshot captured and will be used for this query.',
            status: 'complete'
          });
          currentMessageContext = state.currentContext; // Ensure currentMessageContext has the screenshot
        } else {
          console.log('Screenshot is NOT required by the model.');
          // Clear the context if screenshot is not needed
          setContext(undefined);
          currentMessageContext = undefined;
        }
      } else {
        console.log('Could not take screenshot for check or model not available.');
      }
      setFirstMessage(false); // Mark first message as processed
    }

    // Add user message
    addMessage({
      role: 'user',
      content: message,
      context: currentMessageContext, // Use potentially updated context
      status: 'complete'
    })

    setProcessing(true)

    // Show different processing message if image is included
    if (currentMessageContext?.screenshot) {
      addMessage({
        role: 'assistant',
        content: '🖼️ Screenshot included. Analyzing image and processing your request...',
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
        currentMessageContext, // Use potentially updated context
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
            hasImageAnalysis: !!currentMessageContext?.screenshot // Use potentially updated context
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
      // Clear context after use ONLY if it wasn't cleared by the screenshot check logic
      if (!state.isFirstMessage || (state.isFirstMessage && currentMessageContext?.screenshot)) {
         // If it was the first message and screenshot was kept, it will be cleared here.
         // If it was not the first message, clear context as usual.
         // If it was the first message and screenshot was NOT kept, it's already cleared.
        setContext(undefined)
      }
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
      const newContextData: ContextData = {
        screenshot: {
          path: screenshotPath,
          base64: base64Data,
          preview: screenshotDataUrl,
          timestamp: new Date()
        }
      };
      setContext(newContextData);

      addMessage({
        role: 'assistant',
        content: '📸 Screenshot captured! It will be analyzed with your next message, or you can clear it.',
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
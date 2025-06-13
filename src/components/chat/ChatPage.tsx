import React, { useEffect, useRef, useState } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ContextData, IChatModel } from '../../types/chat'
import { useModel } from '../../contexts/ModelContext'
import ModelPicker from '../chat/ModelPicker'
import { getChatModel } from '../../models/ModelManager'

interface ChatPageProps {
  onTakeScreenshot: () => Promise<string>
  onGetImagePreview: (path: string) => Promise<string>
}

export function ChatPage({ onTakeScreenshot, onGetImagePreview }: ChatPageProps) {
  const { state, addMessage, addMessageWithId, updateMessage, appendToMessage, setProcessing, setContext, clearMessages, setFirstMessage } = useChat()
  const { selectedModelId } = useModel();
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatModelRef = useRef<IChatModel | null>(null)
  const welcomeMessageAddedRef = useRef<boolean>(false)

  // New state for controlling the 'Analyzing' message
  const [isFirstMessageAnalyzing, setIsFirstMessageAnalyzing] = useState(false);

  // Initialize chat model (only once)
  useEffect(() => {
    const initializeModel = async () => {
      try {
        chatModelRef.current = await getChatModel(selectedModelId);
        console.log(`Chat model initialized successfully with model: ${selectedModelId}`)
      } catch (error) {
        console.error('Failed to initialize chat model:', error)
        addMessage({
          role: 'assistant',
          content: '❌ Error: Could not initialize AI model. Please ensure your API key is correctly set in the .env file for the selected model provider and restart the application.',
          status: 'error'
        })
      }
    }
    
    initializeModel()
  }, [selectedModelId]) // Re-initialize when selectedModelId changes

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

  // Helper to take screenshot without sending chat message, returns ContextData if successful
  const takeScreenshotForCheck = async (): Promise<ContextData | null> => {
    try {
      console.log('Taking screenshot for check...');
      const screenshotPath = await onTakeScreenshot();
      if (!screenshotPath) return null;

      const screenshotDataUrl = await onGetImagePreview(screenshotPath);
      if (!screenshotDataUrl) return null;

      const base64Data = screenshotDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

      const newContextData: ContextData = {
        screenshot: {
          path: screenshotPath,
          base64: base64Data,
          preview: screenshotDataUrl,
          timestamp: new Date()
        }
      };
      // Do NOT set context here, only return it
      return newContextData;
    } catch (error) {
      console.error('Screenshot for check error:', error);
      // Ensure context is cleared if any error occurs during screenshot process
      setContext(undefined); 
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

    // Add user message immediately
    addMessage({
      role: 'user',
      content: message,
      status: 'complete'
    })

    let currentMessageContext = state.currentContext;

    if (state.isFirstMessage) {
      console.log('First message, checking if screenshot is required...');
      setIsFirstMessageAnalyzing(true); // Start showing analyzing message
      const checkedContextData = await takeScreenshotForCheck();

      if (checkedContextData && checkedContextData.screenshot && chatModelRef.current) {
        const screenshotNeeded = await chatModelRef.current.isScreenshotRequired(message, checkedContextData.screenshot.base64);
        if (screenshotNeeded) {
          console.log('Screenshot IS required by the model.');
          // Set context here only if screenshot is required
          setContext(checkedContextData);
          // Update the user message with the screenshot context
          updateMessage(state.messages[state.messages.length - 1].id, {
            context: checkedContextData
          });
          currentMessageContext = checkedContextData;
          // Only show screenshot captured message after we know it's needed
          addMessage({
            role: 'assistant',
            content: '📸 Screenshot detected and will be used for this query.',
            status: 'complete'
          });
        } else {
          console.log('Screenshot is NOT required by the model.');
          // Clear context if it was set by takeScreenshotForCheck (not used)
          setContext(undefined);
          currentMessageContext = undefined;
        }
      } else {
        console.log('Could not take screenshot for check, or model not available, or screenshot data missing.');
        // Ensure context is cleared if takeScreenshotForCheck failed or didn't provide data
        setContext(undefined);
        currentMessageContext = undefined;
      }
      setFirstMessage(false);
      setIsFirstMessageAnalyzing(false); // Stop showing analyzing message after check
    }

    setProcessing(true)

    // Show processing message if image is included
    if (currentMessageContext?.screenshot) {
      addMessage({
        role: 'assistant',
        content: '🖼️ Analyzing image and processing your request...',
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
        model: selectedModelId,
        hasImageAnalysis: !!currentMessageContext?.screenshot
      }
    }
    
    addMessageWithId(streamingMessage)

    try {
      // Send to AI model with streaming
      const response = await chatModelRef.current!.sendMessageStream(
        message,
        currentMessageContext,
        state.messages,
        (chunk: string) => {
          appendToMessage(streamingMessageId, chunk)
        }
      )

      if (response.success) {
        updateMessage(streamingMessageId, {
          status: 'complete',
          metadata: {
            model: selectedModelId,
            tokenUsage: response.usage,
            hasImageAnalysis: !!currentMessageContext?.screenshot
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
      setContext(undefined);
    }
  }

  const handleResetChat = () => {
    clearMessages()
    setFirstMessage(true) // Reset the first message flag
    setContext(undefined) // Clear any existing context like a screenshot
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
      
      // Extract base64 data from data URL
      const base64Data = screenshotDataUrl.replace(/^data:image\/[a-z]+;base64,/, '')
      
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

      // Don't show the screenshot captured message here anymore
      // It will be shown after detection if needed
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
            <ModelPicker />
          </div>
        </div>
        {isFirstMessageAnalyzing && (
          <div className="wagoo-context-indicator mt-1">
            <span className="wagoo-status-dot animate-pulse"></span>
            Analyzing...
          </div>
        )}
        {state.currentContext?.screenshot && !isFirstMessageAnalyzing && (
          <div className="wagoo-context-indicator mt-1">
            <span className="wagoo-status-dot"></span>
            Screenshot ready
          </div>
        )}
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
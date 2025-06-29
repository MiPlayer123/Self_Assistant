import React, { useEffect, useRef, useState } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ContextData, IChatModel } from '../../types/chat'
import { useModel } from '../../contexts/ModelContext'
import ModelPicker, { ModelPickerRef } from '../chat/ModelPicker'
import { getChatModel } from '../../models/ModelManager'
import { LocalModelSettings } from './LocalModelSettings'
import { isMacOS } from '../../utils/platform'
import { Tooltip } from '../ui/Tooltip'
// Removed UsageLimitModal import - using inline upgrade prompt instead

interface ChatPageProps {
  onTakeScreenshot: () => Promise<string>
  onGetImagePreview: (path: string) => Promise<string>
  onLogoClick?: () => void
  onMessageSent?: () => Promise<{ success: boolean; error?: string; code?: string; details?: any }> // Callback when user sends a message
  usageStats?: {
    userTier: string
    remaining: { chat_messages_count: number }
  }
}

export function ChatPage({ onTakeScreenshot, onGetImagePreview, onLogoClick, onMessageSent, usageStats }: ChatPageProps) {
  const { state, addMessage, addMessageWithId, updateMessage, appendToMessage, setProcessing, setContext, clearMessages, setFirstMessage } = useChat()
  const { 
    selectedModelId, 
    setSelectedModelId, 
    isModelLoading, 
    setIsModelLoading, 
    modelLoadingProgress, 
    setModelLoadingProgress,
    modelLoadingMessage,
    setModelLoadingMessage
  } = useModel()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef<boolean>(true)
  const chatModelRef = useRef<IChatModel | null>(null)
  const welcomeMessageAddedRef = useRef<boolean>(false)
  const modelPickerRef = useRef<ModelPickerRef>(null)

  // New state for controlling the 'Analyzing' message
  const [isFirstMessageAnalyzing, setIsFirstMessageAnalyzing] = useState(false)
  // New state for controlling the 'Searching' message
  const [isSearching, setIsSearching] = useState(false)
  // State for toggling local model settings visibility
  const [showLocalModelSettings, setShowLocalModelSettings] = useState(false)
  // Removed usage limit modal - using inline upgrade prompt instead

  // Platform-specific shortcuts for tooltips
  const resetShortcut = isMacOS ? 'Ctrl+R' : 'Alt+R'

  // Handler for selecting a local model
  const handleSelectLocalModel = (modelFilename: string) => {
    setSelectedModelId(`local-${modelFilename}`); // Prepend 'local-' to distinguish local models
  };

  // Handler for when a model is downloaded - refresh the ModelPicker
  const handleModelDownloaded = () => {
    modelPickerRef.current?.refreshLocalModels();
  };

  // Toggle local model settings visibility
  const toggleLocalModelSettings = () => {
    setShowLocalModelSettings(prev => !prev);
  };

  // Set up listeners for model loading progress
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.addListener) {
      const removeProgressListener = (window as any).electronAPI.addListener('modelLoadingProgress', (data: any) => {
        setModelLoadingProgress(data.progress)
        setModelLoadingMessage(data.message)
      });

      return () => {
        if (removeProgressListener) {
          removeProgressListener();
        }
      };
    }
  }, []);

  // Track previous model to handle cleanup when switching
  const previousModelIdRef = useRef<string | null>(null)

  // Initialize chat model (only once)
  useEffect(() => {
    const initializeModel = async () => {
      try {
        const previousModelId = previousModelIdRef.current
        const isCurrentLocal = selectedModelId.startsWith('local-')
        const wasPreviousLocal = previousModelId?.startsWith('local-')

        console.log(`Attempting to initialize chat model with ID: ${selectedModelId}`)
        
        // Cleanup previous local model when switching to cloud model
        if (wasPreviousLocal && !isCurrentLocal && previousModelId) {
          console.log('Switching from local to cloud model - unloading local model...')
          try {
            const result = await (window as any).electronAPI?.cleanupLocalModel?.()
            if (result?.success) {
              console.log('✅ Local model unloaded successfully')
            } else {
              console.warn('⚠️ Failed to unload local model:', result?.error)
            }
          } catch (error) {
            console.error('❌ Error unloading local model:', error)
          }
        }
        
        // Set loading state for local models
        if (isCurrentLocal) {
          setIsModelLoading(true)
          setModelLoadingProgress(0)
          setModelLoadingMessage('Initializing local model...')
        }
        
        chatModelRef.current = await getChatModel(selectedModelId)
        console.log(`Chat model initialized successfully with model: ${selectedModelId}`)
        
        // Update previous model tracking
        previousModelIdRef.current = selectedModelId
        
        // Clear loading state
        if (isCurrentLocal) {
          setModelLoadingProgress(100)
          setModelLoadingMessage('Model ready!')
          setTimeout(() => {
            setIsModelLoading(false)
            setModelLoadingProgress(0)
            setModelLoadingMessage('')
          }, 500)
        }
      } catch (error) {
        console.error('Failed to initialize chat model:', error)
        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          selectedModelId: selectedModelId,
          stack: error instanceof Error ? error.stack : undefined
        })
        
        // Clear loading state on error
        setIsModelLoading(false)
        setModelLoadingProgress(0)
        setModelLoadingMessage('')
        
        addMessage({
          role: 'assistant',
          content:
            `❌ Error: Could not initialize AI model (${selectedModelId}). Please ensure your API key is correctly set in the .env file for the selected model provider and restart the application. Error: ${error instanceof Error ? error.message : String(error)}`,
          status: 'error'
        })
      }
    }

    initializeModel()
  }, [selectedModelId]) // Re-initialize when selectedModelId changes

  // Check if user is near bottom of chat
  const checkIfAtBottom = () => {
    const container = messagesContainerRef.current
    if (!container) return false
    
    const threshold = 100 // pixels from bottom
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    shouldAutoScrollRef.current = isAtBottom
    return isAtBottom
  }

  // Add scroll listener to detect if user scrolls away from bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      checkIfAtBottom()
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-scroll to bottom only if user is at bottom
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // Check if the last message is from user for immediate scroll
      const lastMessage = state.messages[state.messages.length - 1]
      const isUserMessage = lastMessage?.role === 'user'
      
      if (isUserMessage) {
        // Immediate scroll for user messages
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      } else {
        // Small delay for assistant messages to ensure DOM is updated
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 50)
      }
    }
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

  // Listen for screenshot button trigger from global shortcut
  useEffect(() => {
    const cleanup = (window as any).electronAPI?.onTriggerScreenshotButton?.(() => {
      handleTakeScreenshot()
    })
    
    return cleanup
  }, [])

  // Listen for reset trigger from global shortcut
  useEffect(() => {
    const cleanup = (window as any).electronAPI?.onReset?.(() => {
      handleResetChat()
    })
    
    return cleanup
  }, [])

  // Helper to take screenshot without sending chat message, returns ContextData if successful
  const takeScreenshotForCheck = async (): Promise<ContextData | null> => {
    try {
      console.log('Taking screenshot for check...')
      const screenshotPath = await onTakeScreenshot()
      if (!screenshotPath) return null

      const screenshotDataUrl = await onGetImagePreview(screenshotPath)
      if (!screenshotDataUrl) return null

      const base64Data = screenshotDataUrl.replace(/^data:image\/[a-z]+;base64,/, '')

      const newContextData: ContextData = {
        screenshot: {
          path: screenshotPath,
          base64: base64Data,
          preview: screenshotDataUrl,
          timestamp: new Date()
        }
      }
      // Do NOT set context here, only return it
      return newContextData
    } catch (error) {
      console.error('Screenshot for check error:', error)
      // Ensure context is cleared if any error occurs during screenshot process
      setContext(undefined)
      return null
    }
  }

  const handleSendMessage = async (message: string) => {
    // Prevent sending if model is loading
    if (isModelLoading) {
      return
    }
    
    if (!chatModelRef.current) {
      addMessage({
        role: 'assistant',
        content: 'Error: AI model not available',
        status: 'error'
      })
      return
    }

    // Track usage - this will check daily limits for free users
    const trackingResult = await onMessageSent?.()
    
    // If daily limit exceeded, just return (upgrade prompt will show above input)
    if (trackingResult && !trackingResult.success && trackingResult.code === 'DAILY_LIMIT_EXCEEDED') {
      // Don't send message, upgrade prompt will show above input
      return
    }
    
    // Ensure we scroll to bottom when user sends a message
    shouldAutoScrollRef.current = true
    
    addMessage({
      role: 'user',
      content: message,
      status: 'complete'
    })

    let currentMessageContext = state.currentContext

    if (state.isFirstMessage) {
      console.log('First message, checking if screenshot is required...')
      setIsFirstMessageAnalyzing(true) // Start showing analyzing message
      const checkedContextData = await takeScreenshotForCheck()

      if (checkedContextData && checkedContextData.screenshot && chatModelRef.current) {
        const screenshotNeeded = await chatModelRef.current.isScreenshotRequired(
          message,
          checkedContextData.screenshot.base64
        )
        if (screenshotNeeded) {
          console.log('Screenshot IS required by the model.')
          // Set context here only if screenshot is required
          setContext(checkedContextData)
          // Update the user message with the screenshot context
          updateMessage(state.messages[state.messages.length - 1].id, {
            context: checkedContextData
          })
          currentMessageContext = checkedContextData
          // Screenshot detection message removed
        } else {
          console.log('Screenshot is NOT required by the model.')
          // Clear context if it was set by takeScreenshotForCheck (not used)
          setContext(undefined)
          currentMessageContext = undefined
        }
      } else {
        console.log(
          'Could not take screenshot for check, or model not available, or screenshot data missing.'
        )
        // Ensure context is cleared if takeScreenshotForCheck failed or didn't provide data
        setContext(undefined)
        currentMessageContext = undefined
      }
      setFirstMessage(false)
      setIsFirstMessageAnalyzing(false) // Stop showing analyzing message after check
    }

    setProcessing(true)

    // Image processing message removed

    // Generate a unique ID for the streaming message
    const streamingMessageId = `streaming-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`

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
        },
        (searching: boolean) => {
          setIsSearching(searching)
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
      setContext(undefined)
    }
  }

  const handleResetChat = async () => {
    // If using a local model, reset the chat session on the backend
    if (selectedModelId.startsWith('local-')) {
      try {
        console.log('Resetting local model chat session...')
        const result = await (window as any).electronAPI?.resetLocalModelChat?.()
        if (result?.success) {
          console.log('Local model chat session reset successfully')
        } else {
          console.warn('Failed to reset local model chat session:', result?.error)
        }
      } catch (error) {
        console.error('Error resetting local model chat session:', error)
      }
    }
    
    // Reset the frontend state
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
      }
      setContext(newContextData)

      // Don't show the screenshot captured message here anymore
      // It will be shown after detection if needed
    } catch (error: any) {
      console.error('Screenshot error:', error)
      addMessage({
        role: 'assistant',
        content:
          '❌ Error: Could not capture screenshot. Please ensure the app has screen recording permissions.',
        status: 'error'
      })
      setContext(undefined) // Clear context on error
    }
  }

  // Show upgrade prompts based on usage
  const showLowUsageWarning = usageStats?.userTier === 'free' && usageStats?.remaining.chat_messages_count === 1
  const showOutOfCreditsUpgrade = usageStats?.userTier === 'free' && usageStats?.remaining.chat_messages_count === 0

  const handleUpgrade = () => {
    // Use the existing IPC handler to open wagoo.ai
    if (window.electronAPI?.openSubscriptionPortal) {
      window.electronAPI.openSubscriptionPortal({ id: 'temp', email: 'temp' })
    } else {
      // Fallback for web version
      window.open('https://wagoo.ai', '_blank')
    }
  }

  console.log('ChatPage rendering...')
  
  return (
    <div className="wagoo-chat-container wagoo-fade-in">
      {/* Progress Bar */}
      {isModelLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 h-1">
          <div 
            className="h-full bg-blue-400 transition-all duration-300 ease-out"
            style={{ width: `${modelLoadingProgress}%` }}
          />
        </div>
      )}
      
      {/* Chat header */}
      <div className="wagoo-chat-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Wagoo Logo - not clickable */}
            <div className="wagoo-logo">
              <img
                src="W-logo.png"
                alt="Wagoo Logo"
                className="w-8 h-8 rounded-lg object-contain"
              />
            </div>
            {/* Wagoo Brand */}
            <h1 className="text-xl font-semibold wagoo-text-primary">Wagoo</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content={`Reset chat history • ${resetShortcut}`}>
              <button
                onClick={handleResetChat}
                className="p-1 rounded-md hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                aria-label="Reset Chat History"
              >
                <span className="text-lg">↺</span>
              </button>
            </Tooltip>
            <ModelPicker ref={modelPickerRef} usageStats={usageStats} />
            {selectedModelId.startsWith('local-') && (
              <button
                onClick={toggleLocalModelSettings}
                className="p-1 rounded-md hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                aria-label="Local Model Settings"
                title="Local Model Settings"
              >
                <div className="w-4 h-4 flex items-center justify-center text-white/70 hover:text-white/90 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
              </button>
            )}
            {/* 3-dots menu button */}
            <button 
              onClick={onLogoClick}
              className="p-1 rounded-md hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Open user menu"
              title="User menu"
            >
              <div className="w-4 h-4 flex items-center justify-center text-white/70 hover:text-white/90 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </div>
            </button>
          </div>
        </div>
        {isModelLoading && (
          <div className="wagoo-context-indicator mt-1">
            <span className="wagoo-status-dot animate-pulse"></span>
            {modelLoadingMessage}
          </div>
        )}
        {isFirstMessageAnalyzing && !isModelLoading && (
          <div className="wagoo-context-indicator mt-1">
            <span className="wagoo-status-dot animate-pulse"></span>
            Analyzing...
          </div>
        )}
        {isSearching && !isModelLoading && !isFirstMessageAnalyzing && (
          <div className="wagoo-context-indicator mt-1">
            <span className="wagoo-status-dot animate-pulse"></span>
            Searching web...
          </div>
        )}
        {state.currentContext?.screenshot && !isFirstMessageAnalyzing && !isModelLoading && !isSearching && (
          <div className="wagoo-context-indicator mt-1">
            <span className="wagoo-status-dot"></span>
            Screenshot ready
          </div>
        )}
      </div>

      {/* Local Model Settings */}
      {selectedModelId.startsWith('local-') && showLocalModelSettings && (
        <div className="flex-none p-2 border-b border-zinc-700">
          <LocalModelSettings 
            onSelectLocalModel={handleSelectLocalModel} 
            onModelDownloaded={handleModelDownloaded}
          />
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="wagoo-chat-messages">
        <div className="space-y-1 py-1">
          {state.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        {/* Out of credits - upgrade prompt */}
        {showOutOfCreditsUpgrade && (
          <div className="flex items-center justify-center py-4 px-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-t border-blue-500/20">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">🚀</span>
                <h3 className="text-lg font-semibold text-white">Ready for unlimited messages?</h3>
              </div>
              <p className="text-gray-300 text-sm mb-3">You've used all 5 free messages today. Upgrade to Pro for unlimited access!</p>
              <button
                onClick={handleUpgrade}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}
        
        {/* Low usage warning (1 message left) */}
        {showLowUsageWarning && !showOutOfCreditsUpgrade && (
          <div className="flex items-center justify-center py-2 px-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-t border-amber-500/20">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-amber-400">⚠️ Last message remaining!</span>
              <button
                onClick={handleUpgrade}
                className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium"
              >
                Upgrade for unlimited
              </button>
            </div>
          </div>
        )}
        <ChatInput
          onSendMessage={handleSendMessage}
          onTakeScreenshot={handleTakeScreenshot}
          isProcessing={state.isProcessing || isModelLoading}
          hasScreenshot={!!state.currentContext?.screenshot}
          disabled={usageStats?.userTier === 'free' && usageStats?.remaining.chat_messages_count === 0}
        />
      </div>

      {/* Usage limit handling moved to inline prompt above input */}
    </div>
  )
} 
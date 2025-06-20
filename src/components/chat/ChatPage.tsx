import React, { useEffect, useRef, useState } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ContextData, IChatModel } from '../../types/chat'
import { useModel } from '../../contexts/ModelContext'
import ModelPicker, { ModelPickerRef } from '../chat/ModelPicker'
import { getChatModel } from '../../models/ModelManager'
import { LocalModelSettings } from './LocalModelSettings'

interface ChatPageProps {
  onTakeScreenshot: () => Promise<string>
  onGetImagePreview: (path: string) => Promise<string>
}

export function ChatPage({ onTakeScreenshot, onGetImagePreview }: ChatPageProps) {
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
  const chatModelRef = useRef<IChatModel | null>(null)
  const welcomeMessageAddedRef = useRef<boolean>(false)
  const modelPickerRef = useRef<ModelPickerRef>(null)

  // New state for controlling the 'Analyzing' message
  const [isFirstMessageAnalyzing, setIsFirstMessageAnalyzing] = useState(false)
  // State for toggling local model settings visibility
  const [showLocalModelSettings, setShowLocalModelSettings] = useState(false);

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

    // Add user message immediately
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
            <ModelPicker ref={modelPickerRef} />
            {selectedModelId.startsWith('local-') && (
              <button
                onClick={toggleLocalModelSettings}
                className="p-1 rounded-md hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Local Model Settings"
                title="Local Model Settings"
              >
                <span className="text-lg">⚙️</span> {/* Gear icon */}
              </button>
            )}
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
        {state.currentContext?.screenshot && !isFirstMessageAnalyzing && !isModelLoading && (
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
          isProcessing={state.isProcessing || isModelLoading}
          hasScreenshot={!!state.currentContext?.screenshot}
        />
      </div>
    </div>
  )
} 
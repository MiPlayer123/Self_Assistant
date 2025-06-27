import React, { useState } from 'react'
import { useAudioRecording } from '../../hooks/useAudioRecording'
import { transcribeAudio } from '../../services/audioTranscription'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onTakeScreenshot: () => void
  isProcessing: boolean
  hasScreenshot: boolean
  disabled?: boolean
}

export function ChatInput({
  onSendMessage,
  onTakeScreenshot,
  isProcessing,
  hasScreenshot,
  disabled = false
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  
  // Audio recording functionality
  const { 
    recordingState, 
    startRecording, 
    stopRecording, 
    error: recordingError, 
    clearError 
  } = useAudioRecording()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Send if there's text OR if there's a screenshot, and not processing, and not disabled
    if ((message.trim() || hasScreenshot) && !isProcessing && !disabled) {
      onSendMessage(message.trim()) // Send the message (can be empty if only screenshot)
      setMessage('')
      // Reset textarea height and border radius
      if (textareaRef.current) {
        textareaRef.current.style.height = '32px'
        textareaRef.current.style.borderRadius = '12px'
      }
    }
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    
    // Auto-resize textarea with dynamic border radius (both grow and shrink)
    if (textareaRef.current) {
      // Reset height first to get accurate scrollHeight measurement
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 32), 120)
      textareaRef.current.style.height = `${newHeight}px`
      
      // Adjust border radius based on height - less rounding for taller text areas
      const borderRadius = newHeight <= 34 ? '12px' : `${Math.max(8, 12 - (newHeight - 34) / 10)}px`
      textareaRef.current.style.borderRadius = borderRadius
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Listen for send button trigger from global shortcut
  React.useEffect(() => {
    const cleanup = (window as any).electronAPI?.onTriggerSendButton?.(() => {
      // Create a synthetic event and trigger handleSubmit
      const syntheticEvent = { preventDefault: () => {} } as React.FormEvent
      handleSubmit(syntheticEvent)
    })
    
    return cleanup
  }, [message, isProcessing, hasScreenshot])

  const handleMicrophoneClick = async () => {
    if (isProcessing) return
    
    try {
      if (recordingState === 'idle') {
        // Start recording
        await startRecording()
      } else if (recordingState === 'recording') {
        // Stop recording and transcribe
        const audioBlob = await stopRecording()
        
        if (audioBlob) {
          const result = await transcribeAudio(audioBlob)
          
          if (result.success && result.text) {
            // Add transcribed text to the current message
            const newText = message ? `${message} ${result.text}` : result.text
            setMessage(newText)
            
            // Auto-resize textarea with dynamic border radius
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto'
              const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 32), 120)
              textareaRef.current.style.height = `${newHeight}px`
              
              // Adjust border radius based on height
              const borderRadius = newHeight <= 34 ? '12px' : `${Math.max(8, 12 - (newHeight - 34) / 10)}px`
              textareaRef.current.style.borderRadius = borderRadius
            }
          } else {
            console.error('Transcription failed:', result.error)
            // You could show an error toast here if desired
          }
        }
      }
    } catch (error) {
      console.error('Microphone error:', error)
    }
  }

  const handleUpgrade = () => {
    // Use the existing IPC handler to open wagoo.vercel.app
    if (window.electronAPI?.openSubscriptionPortal) {
      window.electronAPI.openSubscriptionPortal({ id: 'temp', email: 'temp' })
    } else {
      // Fallback for web version
      window.open('https://wagoo.vercel.app', '_blank')
    }
  }

  return (
    <div className="wagoo-chat-input-container flex items-center justify-center py-3 px-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full max-w-2xl">
        {/* Screenshot button */}
        <button
          type="button"
          onClick={onTakeScreenshot}
          disabled={isProcessing}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors
            ${hasScreenshot ? 'text-white' : 'text-gray-300 hover:text-white'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
          style={{
            backgroundColor: hasScreenshot 
              ? 'var(--wagoo-accent-primary)' 
              : 'var(--wagoo-bg-tertiary)',
            border: '1px solid var(--wagoo-border-secondary)'
          }}
          title={hasScreenshot ? 'Screenshot attached' : 'Take screenshot'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5zm0-5c-0.83 0-1.5 0.67-1.5 1.5s0.67 1.5 1.5 1.5 1.5-0.67 1.5-1.5-0.67-1.5-1.5-1.5z"/>
            <path d="M20 4h-3.17l-1.24-1.35c-0.37-0.41-0.91-0.65-1.47-0.65h-4.24c-0.56 0-1.1 0.24-1.47 0.65l-1.24 1.35h-3.17c-1.1 0-2 0.9-2 2v12c0 1.1 0.9 2 2 2h16c1.1 0 2-0.9 2-2v-12c0-1.1-0.9-2-2-2zm0 14h-16v-12h16v12z"/>
          </svg>
        </button>

        {/* Message input */}
        <div className="flex-1 flex items-center">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Daily message limit reached" : "Ask Wagoo anything..."}
            disabled={isProcessing || recordingState === 'processing' || disabled}
            className="wagoo-input disabled:opacity-50 disabled:cursor-not-allowed w-full"
            rows={1}
            style={{
              minHeight: '32px',
              maxHeight: '120px',
              height: 'auto',
              resize: 'none',
              borderRadius: '12px' // Dynamic border radius handled in JS
            }}
          />
        </div>

        {/* Microphone button */}
        <button
          type="button"
          onClick={handleMicrophoneClick}
          disabled={isProcessing}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors
            ${recordingState === 'recording' 
              ? 'text-white animate-pulse' 
              : recordingState === 'processing'
              ? 'text-white'
              : 'text-gray-300 hover:text-white'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
          style={{
            backgroundColor: recordingState === 'recording' 
              ? 'var(--wagoo-accent-error)' 
              : recordingState === 'processing'
              ? 'var(--wagoo-accent-warning)'
              : 'var(--wagoo-bg-tertiary)',
            border: '1px solid var(--wagoo-border-secondary)'
          }}
          title={
            recordingState === 'recording' 
              ? 'Stop recording' 
              : recordingState === 'processing'
              ? 'Processing...'
              : 'Start voice recording'
          }
        >
          {recordingState === 'processing' ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2s-2-.9-2-2V4c0-1.1.9-2 2-2zm0 12c-2.2 0-4-1.8-4-4v-1H6v1c0 3.3 2.7 6 6 6s6-2.7 6-6v-1h-2v1c0 2.2-1.8 4-4 4zm-1 2v2h2v-2h-1z"/>
            </svg>
          )}
        </button>

        {/* Send button */}
        <button
          type="submit"
          disabled={(!message.trim() && !hasScreenshot) || isProcessing}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          style={{
            backgroundColor: 'var(--wagoo-accent-primary)',
            border: '1px solid var(--wagoo-border-secondary)'
          }}
          title="Send message"
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            '↑'
          )}
        </button>
      </form>
    </div>
  )
} 
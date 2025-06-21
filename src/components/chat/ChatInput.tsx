import React, { useState } from 'react'
import { useAudioRecording } from '../../hooks/useAudioRecording'
import { transcribeAudio } from '../../services/audioTranscription'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onTakeScreenshot: () => void
  isProcessing: boolean
  hasScreenshot: boolean
}

export function ChatInput({
  onSendMessage,
  onTakeScreenshot,
  isProcessing,
  hasScreenshot
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
    if (message.trim() && !isProcessing) {
      onSendMessage(message.trim())
      setMessage('')
      // Reset textarea height and border radius
      if (textareaRef.current) {
        textareaRef.current.style.height = '38px'
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
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 38), 120)
      textareaRef.current.style.height = `${newHeight}px`
      
      // Adjust border radius based on height - less rounding for taller text areas
      const borderRadius = newHeight <= 40 ? '12px' : `${Math.max(8, 12 - (newHeight - 40) / 10)}px`
      textareaRef.current.style.borderRadius = borderRadius
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

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
              const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 38), 120)
              textareaRef.current.style.height = `${newHeight}px`
              
              // Adjust border radius based on height
              const borderRadius = newHeight <= 40 ? '12px' : `${Math.max(8, 12 - (newHeight - 40) / 10)}px`
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

  // Adjust the opacity of the bottom bar
  const inputBarStyle = {
    opacity: 0.7, // Reduce this to 0.2-0.3
    // ... other styles ...
  };

  return (
    <div className="wagoo-chat-input-container flex items-center justify-center py-2 px-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full max-w-2xl">
        {/* Screenshot button */}
        <button
          type="button"
          onClick={onTakeScreenshot}
          disabled={isProcessing}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors
            ${hasScreenshot ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
          title={hasScreenshot ? 'Screenshot attached' : 'Take screenshot'}
        >
          📸
        </button>

        {/* Message input */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Wagoo anything..."
            disabled={isProcessing || recordingState === 'processing'}
            className="wagoo-input disabled:opacity-50 disabled:cursor-not-allowed focus:ring-0 focus:border-transparent"
            rows={1}
            style={{
              minHeight: '38px',
              maxHeight: '120px',
              height: 'auto',
              resize: 'none',
              padding: '8px 12px',
              borderRadius: '12px', // Less rounded, will adjust dynamically
              border: '1px solid var(--wagoo-border-secondary)',
              backgroundColor: 'var(--wagoo-bg-tertiary)',
              color: 'var(--wagoo-text-primary)',
              marginBottom: '-5px', // Bring text box down to align with buttons
            }}
          />
        </div>

        {/* Microphone button */}
        <button
          type="button"
          onClick={handleMicrophoneClick}
          disabled={isProcessing}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors
            ${recordingState === 'recording' 
              ? 'bg-red-500 text-white animate-pulse' 
              : recordingState === 'processing'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
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
            '🎤'
          )}
        </button>

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim() || isProcessing}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
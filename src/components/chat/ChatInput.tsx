import React, { useState } from 'react'

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !isProcessing) {
      onSendMessage(message.trim())
      setMessage('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px'
      }
    }
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        {/* Screenshot button */}
        <button
          type="button"
          onClick={onTakeScreenshot}
          disabled={isProcessing}
          className={`flex-shrink-0 w-10 h-10 rounded-lg border-2 border-dashed transition-colors ${
            hasScreenshot
              ? 'border-green-400 bg-green-50 text-green-600'
              : 'border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-600'
          } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
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
            disabled={isProcessing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
              height: '40px'
            }}
          />
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim() || isProcessing}
          className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          title="Send message"
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            '↑'
          )}
        </button>
      </form>

      {/* Context indicator */}
      {hasScreenshot && (
        <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Screenshot ready - AI will use it for visual context if needed
        </div>
      )}
    </div>
  )
} 
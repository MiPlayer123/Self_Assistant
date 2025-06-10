import React from 'react'
import { ChatMessage as ChatMessageType } from '../../types/chat'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message bubble */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
          
          {/* Screenshot preview if available */}
          {message.context?.screenshot && (
            <div className="mt-3">
              <div className="text-xs opacity-75 mb-2">
                📸 Screenshot included
              </div>
              <img
                src={message.context.screenshot.preview}
                alt="Screenshot"
                className="max-w-full max-h-64 h-auto rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  // Open screenshot in new window for full view
                  const newWindow = window.open()
                  if (newWindow && message.context?.screenshot) {
                    newWindow.document.write(`<img src="${message.context.screenshot.preview}" style="max-width:100%;height:auto;" />`)
                  }
                }}
              />
              <div className="text-xs opacity-60 mt-1">
                Click to view full size
              </div>
            </div>
          )}
        </div>

        {/* Timestamp and status */}
        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
          {message.status === 'sending' && (
            <span className="ml-1">
              <div className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            </span>
          )}
          {message.status === 'error' && (
            <span className="ml-1 text-red-500">Failed</span>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
        isUser 
          ? 'bg-blue-500 text-white order-1 mr-3' 
          : 'bg-gray-300 text-gray-700 order-2 ml-3'
      }`}>
        {isUser ? 'U' : 'W'}
      </div>
    </div>
  )
} 
import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { ChatMessage, ChatState, ContextData } from '../types/chat'
import { v4 as uuidv4 } from 'uuid'

// Actions
type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: Omit<ChatMessage, 'id' | 'timestamp'> }
  | { type: 'ADD_MESSAGE_WITH_ID'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'APPEND_TO_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_CONTEXT'; payload: ContextData | undefined }
  | { type: 'SET_MODEL'; payload: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_FIRST_MESSAGE'; payload: boolean }

// Initial state
const initialState: ChatState & { isFirstMessage: boolean } = {
  messages: [],
  isProcessing: false,
  selectedModel: 'gpt-4o',
  currentContext: undefined,
  isFirstMessage: true
}

// Reducer
function chatReducer(
  state: ChatState & { isFirstMessage: boolean },
  action: ChatAction
): ChatState & { isFirstMessage: boolean } {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            ...action.payload,
            id: uuidv4(),
            timestamp: new Date()
          }
        ]
      }

    case 'ADD_MESSAGE_WITH_ID':
      return {
        ...state,
        messages: [
          ...state.messages,
          action.payload
        ]
      }

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      }

    case 'APPEND_TO_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? { ...msg, content: msg.content + action.payload.content }
            : msg
        )
      }

    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload
      }

    case 'SET_CONTEXT':
      return {
        ...state,
        currentContext: action.payload
      }

    case 'SET_MODEL':
      return {
        ...state,
        selectedModel: action.payload
      }

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: []
      }

    case 'SET_FIRST_MESSAGE':
      return {
        ...state,
        isFirstMessage: action.payload
      }

    default:
      return state
  }
}

// Context
interface ChatContextType {
  state: ChatState & { isFirstMessage: boolean }
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  addMessageWithId: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  appendToMessage: (id: string, content: string) => void
  setProcessing: (isProcessing: boolean) => void
  setContext: (context: ContextData | undefined) => void
  setModel: (model: string) => void
  clearMessages: () => void
  setFirstMessage: (isFirst: boolean) => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

// Provider
interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [state, dispatch] = useReducer(chatReducer, initialState)

  const contextValue: ChatContextType = {
    state,
    addMessage: (message) => dispatch({ type: 'ADD_MESSAGE', payload: message }),
    addMessageWithId: (message) => dispatch({ type: 'ADD_MESSAGE_WITH_ID', payload: message }),
    updateMessage: (id, updates) => dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } }),
    appendToMessage: (id, content) => dispatch({ type: 'APPEND_TO_MESSAGE', payload: { id, content } }),
    setProcessing: (isProcessing) => dispatch({ type: 'SET_PROCESSING', payload: isProcessing }),
    setContext: (context) => dispatch({ type: 'SET_CONTEXT', payload: context }),
    setModel: (model) => dispatch({ type: 'SET_MODEL', payload: model }),
    clearMessages: () => dispatch({ type: 'CLEAR_MESSAGES' }),
    setFirstMessage: (isFirst) => dispatch({ type: 'SET_FIRST_MESSAGE', payload: isFirst })
  }

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  )
}

// Hook
export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}

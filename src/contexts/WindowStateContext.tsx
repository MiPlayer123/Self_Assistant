import React, { createContext, useContext, useEffect, useState } from 'react'

interface WindowStateContextType {
  isChatVisible: boolean
  isButtonVisible: boolean
  setChatVisible: (visible: boolean) => void
  setButtonVisible: (visible: boolean) => void
  toggleChatWindow: () => void
  toggleButtonVisibility: () => void
}

const WindowStateContext = createContext<WindowStateContextType | undefined>(undefined)

interface WindowStateProviderProps {
  children: React.ReactNode
}

export const WindowStateProvider: React.FC<WindowStateProviderProps> = ({ children }) => {
  const [isChatVisible, setIsChatVisible] = useState(true)
  const [isButtonVisible, setIsButtonVisible] = useState(true)

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedChatVisible = localStorage.getItem('wagoo-chat-visible')
    const savedButtonVisible = localStorage.getItem('wagoo-button-visible')
    
    if (savedChatVisible !== null) {
      setIsChatVisible(savedChatVisible === 'true')
    }
    
    if (savedButtonVisible !== null) {
      setIsButtonVisible(savedButtonVisible === 'true')
    }
  }, [])

  // Save state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('wagoo-chat-visible', isChatVisible.toString())
  }, [isChatVisible])

  useEffect(() => {
    localStorage.setItem('wagoo-button-visible', isButtonVisible.toString())
  }, [isButtonVisible])

  // Listen for keyboard shortcuts from Electron
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubscribeToggleWindow = window.electronAPI.onKeyboardToggleWindow(() => {
      toggleChatWindow()
    })

    const unsubscribeToggleButton = window.electronAPI.onKeyboardToggleButton(() => {
      toggleButtonVisibility()
    })

    return () => {
      unsubscribeToggleWindow?.()
      unsubscribeToggleButton?.()
    }
  }, [isChatVisible, isButtonVisible])

  const setChatVisible = (visible: boolean) => {
    setIsChatVisible(visible)
  }

  const setButtonVisible = (visible: boolean) => {
    setIsButtonVisible(visible)
  }

  const toggleChatWindow = () => {
    // Only toggle chat window, button stays visible
    setIsChatVisible(!isChatVisible)
  }

  const toggleButtonVisibility = () => {
    // Only toggle button visibility, never affect chat
    setIsButtonVisible(!isButtonVisible)
  }

  return (
    <WindowStateContext.Provider
      value={{
        isChatVisible,
        isButtonVisible,
        setChatVisible,
        setButtonVisible,
        toggleChatWindow,
        toggleButtonVisibility
      }}
    >
      {children}
    </WindowStateContext.Provider>
  )
}

export const useWindowState = () => {
  const context = useContext(WindowStateContext)
  if (context === undefined) {
    throw new Error('useWindowState must be used within a WindowStateProvider')
  }
  return context
} 
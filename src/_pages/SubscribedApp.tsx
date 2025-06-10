// file: src/components/SubscribedApp.tsx
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import Queue from "../_pages/Queue"
import Solutions from "../_pages/Solutions"
import { useToast } from "../contexts/toast"
import { ChatPage } from "../components/chat/ChatPage"
import { SimpleChatPage } from "../components/chat/SimpleChatPage"
import { ChatProvider } from "../contexts/ChatContext"

interface SubscribedAppProps {
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}

const SubscribedApp: React.FC<SubscribedAppProps> = ({
  credits,
  currentLanguage,
  setLanguage
}) => {
  const queryClient = useQueryClient()
  const [view, setView] = useState<"queue" | "solutions" | "debug" | "chat">("chat")
  const containerRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  // Debug logging
  console.log('SubscribedApp render - current view:', view)

  // Let's ensure we reset queries etc. if some electron signals happen
  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      queryClient.invalidateQueries({
        queryKey: ["screenshots"]
      })
      queryClient.invalidateQueries({
        queryKey: ["problem_statement"]
      })
      queryClient.invalidateQueries({
        queryKey: ["solution"]
      })
      queryClient.invalidateQueries({
        queryKey: ["new_solution"]
      })
      setView("queue")
    })

    return () => {
      cleanup()
    }
  }, [])

  // Dynamically update the window size
  useEffect(() => {
    if (!containerRef.current) return

    const updateDimensions = () => {
      if (!containerRef.current) return
      const height = containerRef.current.scrollHeight
      const width = containerRef.current.scrollWidth
      window.electronAPI?.updateContentDimensions({ width, height })
    }

    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(containerRef.current)

    // Also watch DOM changes
    const mutationObserver = new MutationObserver(updateDimensions)
    mutationObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    })

    // Initial dimension update
    updateDimensions()

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [view])

  // Listen for events that might switch views or show errors
  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onSolutionStart(() => {
        setView("solutions")
      }),
      window.electronAPI.onUnauthorized(() => {
        queryClient.removeQueries({
          queryKey: ["screenshots"]
        })
        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["problem_statement"]
        })
        setView("queue")
      }),
      window.electronAPI.onResetView(() => {
        queryClient.removeQueries({
          queryKey: ["screenshots"]
        })
        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["problem_statement"]
        })
        setView("queue")
      }),
      window.electronAPI.onResetView(() => {
        queryClient.setQueryData(["problem_statement"], null)
      }),
      window.electronAPI.onProblemExtracted((data: any) => {
        if (view === "queue") {
          queryClient.invalidateQueries({
            queryKey: ["problem_statement"]
          })
          queryClient.setQueryData(["problem_statement"], data)
        }
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Error", error, "error")
      })
    ]
    return () => cleanupFunctions.forEach((fn) => fn())
  }, [view])

  // Screenshot handlers for chat
  const handleTakeScreenshot = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Set up listener for screenshot taken event
      const cleanup = window.electronAPI?.onScreenshotTaken((data) => {
        cleanup()
        resolve(data.path)
      })

      // Trigger screenshot
      window.electronAPI?.triggerScreenshot()
        .then((result) => {
          if (!result.success) {
            cleanup()
            reject(new Error(result.error || 'Failed to take screenshot'))
          }
        })
        .catch((error) => {
          cleanup()
          reject(error)
        })
    })
  }

  const handleGetImagePreview = async (path: string): Promise<string> => {
    // Use the existing IPC handler to get image preview
    try {
      return await window.electronAPI.getImagePreview(path)
    } catch (error) {
      console.error('Failed to get image preview:', error)
      throw error
    }
  }

  return (
    <div ref={containerRef} className="h-screen w-full">
      {view === "queue" ? (
        <Queue
          setView={setView}
          credits={credits}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : view === "solutions" ? (
        <Solutions
          setView={setView}
          credits={credits}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
              ) : view === "chat" ? (
          <ChatProvider>
            <ChatPage
              onTakeScreenshot={handleTakeScreenshot}
              onGetImagePreview={handleGetImagePreview}
            />
          </ChatProvider>
        ) : null}
    </div>
  )
}

export default SubscribedApp

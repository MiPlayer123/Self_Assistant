declare global {
  interface Window {
    electron?: {
      app: {
        getVersion: () => string
      }
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>
        on: (channel: string, listener: Function) => void
        removeListener: (channel: string, listener: Function) => void
        removeAllListeners: (channel: string) => void
      }
    }
    electronAPI?: {
      getCurrentUser: () => Promise<{ data: { user: any }, error: any }>
      getSubscription: (userId: string) => Promise<{ data: any, error: any }>
      onSubscriptionChange: (callback: (data: any) => void) => () => void
      updateSubscription: (data: any) => Promise<{ data: any, error: any }>
      onScreenshotTaken: (callback: (data: any) => void) => () => void
      triggerScreenshot: () => Promise<{ success: boolean, error?: string }>
      getImagePreview: (path: string) => Promise<string>
      triggerLocalModelProcess: (prompt: string, model: string, options?: any) => Promise<{ success: boolean, id?: string, error?: string }>
      stopLocalModelProcess: (id: string) => Promise<{ success: boolean, error?: string }>
      onLocalModelChunk: (callback: (data: any) => void) => () => void
      onLocalModelComplete: (callback: (data: any) => void) => () => void
      onLocalModelError: (callback: (data: any) => void) => () => void
      triggerLocalWhisperTranscription: (audioPath: string, options?: any) => Promise<{ success: boolean, id?: string, error?: string }>
      onLocalWhisperChunk: (callback: (data: any) => void) => () => void
      onLocalWhisperComplete: (callback: (data: any) => void) => () => void
      onLocalWhisperError: (callback: (data: any) => void) => () => void
    }
  }
}

export {} 
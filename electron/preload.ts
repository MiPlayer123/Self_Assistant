const isDev = process.env.NODE_ENV !== 'production';
if (!isDev) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}

console.log("Preload script starting...")
import { contextBridge, ipcRenderer } from "electron"
const { shell } = require("electron")

// Types for the exposed Electron API
interface ElectronAPI {
  openSubscriptionPortal: (authData: {
    id: string
    email: string
  }) => Promise<{ success: boolean; error?: string }>
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  clearStore: () => Promise<{ success: boolean; error?: string }>
  getScreenshots: () => Promise<{
    success: boolean
    previews?: Array<{ path: string; preview: string }> | null
    error?: string
  }>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  openExternal: (url: string) => void
  getEnvVar: (varName: string) => Promise<string | undefined>
  getImagePreview: (path: string) => Promise<string>
  toggleMainWindow: () => Promise<{ success: boolean; error?: string }>
  triggerScreenshot: () => Promise<{ success: boolean; error?: string }>
  triggerProcessScreenshots: () => Promise<{ success: boolean; error?: string }>
  triggerReset: () => Promise<{ success: boolean; error?: string }>
  triggerMoveLeft: () => Promise<{ success: boolean; error?: string }>
  triggerMoveRight: () => Promise<{ success: boolean; error?: string }>
  triggerMoveUp: () => Promise<{ success: boolean; error?: string }>
  triggerMoveDown: () => Promise<{ success: boolean; error?: string }>
  onSubscriptionUpdated: (callback: () => void) => () => void
  onSubscriptionPortalClosed: (callback: () => void) => () => void
  onKeyboardToggleWindow: (callback: () => void) => () => void
  onKeyboardToggleButton: (callback: () => void) => () => void
  onTriggerScreenshotButton: (callback: () => void) => () => void
  onTriggerSendButton: (callback: () => void) => () => void
  startUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => void
  onUpdateAvailable: (callback: (info: any) => void) => () => void
  onUpdateDownloaded: (callback: (info: any) => void) => () => void
  onDownloadProgress: (callback: (progress: any) => void) => () => void
  onCheckSubscriptionValidity: (callback: () => void) => () => void
  getAppVersion: () => Promise<string>

  getPlatform: () => string
  sampleBackgroundColor: (x: number, y: number) => Promise<{ 
    success: boolean
    isLight?: boolean
    r?: number
    g?: number
    b?: number
    error?: string 
  }>
  // Local model methods
  invokeLocalChatModel: (method: string, args: any) => Promise<any>
  getAvailableLocalModels: () => Promise<{ success: boolean; data?: string[]; error?: string }>
  loadLocalModel: (args: { modelPath: string }) => Promise<{ success: boolean; error?: string }>
  isModelLoaded: (args: { modelPath: string }) => Promise<{ success: boolean; data?: boolean; error?: string }>
  resetLocalModelChat: () => Promise<{ success: boolean; data?: string; error?: string }>
  cleanupLocalModel: () => Promise<{ success: boolean; data?: string; error?: string }>
  // Local Whisper methods
  invokeLocalWhisper: (method: string, args: any) => Promise<any>
  getAvailableWhisperModels: () => Promise<{ success: boolean; data?: string[]; error?: string }>
  isLocalWhisperLoaded: () => Promise<{ success: boolean; data?: boolean; error?: string }>
  // Generic listener methods for streaming support
  addListener: (channel: string, callback: (data: any) => void) => () => void
  removeListener: (channel: string, callback: (data: any) => void) => void
  relaunchApp: () => void
  isUpdateAvailable: () => Promise<boolean>
  downloadUpdate: () => Promise<void>
  openExternalUrl: (url: string) => Promise<void>
  // Wayland screen-capture utility
  getScreenSources: () => Promise<{ success: boolean; data?: string[]; error?: string }>
  // Microphone permission check
  checkMicrophonePermission: () => Promise<{ status: string; granted: boolean }>
  // Deep link handler
  onDeepLink: (callback: (url: string) => void) => () => void
}

export const PROCESSING_EVENTS = {
  //global states
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",
  OUT_OF_CREDITS: "out-of-credits",

  //states for generating the initial solution
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",
  RESET: "reset",

  //states for processing the debugging
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

// At the top of the file
console.log("Preload script is running")

const electronAPI = {
  openSubscriptionPortal: async (authData: { id: string; email: string }) => {
    return ipcRenderer.invoke("open-subscription-portal", authData)
  },
  openSettingsPortal: () => ipcRenderer.invoke("open-settings-portal"),
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  clearStore: () => ipcRenderer.invoke("clear-store"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),
  toggleMainWindow: async () => {
    console.log("toggleMainWindow called from preload")
    try {
      const result = await ipcRenderer.invoke("toggle-window")
      console.log("toggle-window result:", result)
      return result
    } catch (error) {
      console.error("Error in toggleMainWindow:", error)
      throw error
    }
  },
  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription)
    }
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => {
      ipcRenderer.removeListener("reset-view", subscription)
    }
  },
  onSolutionStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription)
    }
  },
  onDebugStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, subscription)
    }
  },
  onDebugSuccess: (callback: (data: any) => void) => {
    ipcRenderer.on("debug-success", (_event, data) => callback(data))
    return () => {
      ipcRenderer.removeListener("debug-success", (_event, data) =>
        callback(data)
      )
    }
  },
  onDebugError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    }
  },
  onSolutionError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        subscription
      )
    }
  },
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    }
  },

  onProblemExtracted: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.PROBLEM_EXTRACTED,
        subscription
      )
    }
  },
  onSolutionSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SOLUTION_SUCCESS,
        subscription
      )
    }
  },
  onUnauthorized: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    }
  },
  openExternal: (url: string) => shell.openExternal(url),
  getEnvVar: (varName: string) => ipcRenderer.invoke("get-env-var", varName),
  getImagePreview: (path: string) => ipcRenderer.invoke("get-image-preview", path),
  triggerScreenshot: () => ipcRenderer.invoke("trigger-screenshot"),
  triggerProcessScreenshots: () =>
    ipcRenderer.invoke("trigger-process-screenshots"),
  triggerReset: () => ipcRenderer.invoke("trigger-reset"),
  triggerMoveLeft: () => ipcRenderer.invoke("trigger-move-left"),
  triggerMoveRight: () => ipcRenderer.invoke("trigger-move-right"),
  triggerMoveUp: () => ipcRenderer.invoke("trigger-move-up"),
  triggerMoveDown: () => ipcRenderer.invoke("trigger-move-down"),
  onSubscriptionUpdated: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("subscription-updated", subscription)
    return () => {
      ipcRenderer.removeListener("subscription-updated", subscription)
    }
  },
  onSubscriptionPortalClosed: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("subscription-portal-closed", subscription)
    return () => {
      ipcRenderer.removeListener("subscription-portal-closed", subscription)
    }
  },
  onKeyboardToggleWindow: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("keyboard-toggle-window", subscription)
    return () => {
      ipcRenderer.removeListener("keyboard-toggle-window", subscription)
    }
  },
  onKeyboardToggleButton: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("keyboard-toggle-button", subscription)
    return () => {
      ipcRenderer.removeListener("keyboard-toggle-button", subscription)
    }
  },
  onTriggerScreenshotButton: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("trigger-screenshot-button", subscription)
    return () => {
      ipcRenderer.removeListener("trigger-screenshot-button", subscription)
    }
  },
  onTriggerSendButton: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("trigger-send-button", subscription)
    return () => {
      ipcRenderer.removeListener("trigger-send-button", subscription)
    }
  },
  onReset: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.RESET, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.RESET, subscription)
    }
  },
  startUpdate: () => ipcRenderer.invoke("start-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateAvailable: (callback: (info: any) => void) => {
    const subscription = (_: any, info: any) => callback(info)
    ipcRenderer.on("update-available", subscription)
    return () => {
      ipcRenderer.removeListener("update-available", subscription)
    }
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const subscription = (_: any, info: any) => callback(info)
    ipcRenderer.on("update-downloaded", subscription)
    return () => {
      ipcRenderer.removeListener("update-downloaded", subscription)
    }
  },
  onDownloadProgress: (callback: (progress: any) => void) => {
    const subscription = (_: any, progress: any) => callback(progress)
    ipcRenderer.on("download-progress", subscription)
    return () => {
      ipcRenderer.removeListener("download-progress", subscription)
    }
  },
  onCheckSubscriptionValidity: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("check-subscription-validity", subscription)
    return () => {
      ipcRenderer.removeListener("check-subscription-validity", subscription)
    }
  },

  getPlatform: () => process.platform,
  sampleBackgroundColor: async (x: number, y: number) => {
    return ipcRenderer.invoke("sample-background-color", x, y)
  },
  // Local model methods
  invokeLocalChatModel: async (method: string, args: any) => {
    return ipcRenderer.invoke("invokeLocalChatModel", { method, args })
  },
  getAvailableLocalModels: () => ipcRenderer.invoke("getAvailableLocalModels"),
  loadLocalModel: (args: { modelPath: string }) => 
    ipcRenderer.invoke("loadLocalModel", args),
  isModelLoaded: (args: { modelPath: string }) => 
    ipcRenderer.invoke("isModelLoaded", args),
  resetLocalModelChat: () => 
    ipcRenderer.invoke("resetLocalModelChat"),
  cleanupLocalModel: () => 
    ipcRenderer.invoke("cleanupLocalModel"),
  // Local Whisper methods
  invokeLocalWhisper: async (method: string, args: any) => {
    return ipcRenderer.invoke("invokeLocalWhisper", { method, args })
  },
  getAvailableWhisperModels: () => ipcRenderer.invoke("getAvailableWhisperModels"),
  isLocalWhisperLoaded: () => ipcRenderer.invoke("isLocalWhisperLoaded"),
  // Generic listener methods for streaming support
  addListener: (channel: string, callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  removeListener: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
  relaunchApp: () => ipcRenderer.send('relaunch-app'),
  isUpdateAvailable: () => ipcRenderer.invoke('is-update-available'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  // App version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // Wayland screen-capture utility
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  // Microphone permission check
  checkMicrophonePermission: () => ipcRenderer.invoke('check-microphone-permission'),
  // Deep link handler
  onDeepLink: (callback: (url: string) => void) => {
    console.log('[preload] setting up deep-link listener');
    const subscription = (_: any, url: string) => {
      console.log('[preload] received deep-link IPC message:', url);
      callback(url);
    };
    ipcRenderer.on('deep-link', subscription);
    return () => {
      console.log('[preload] removing deep-link listener');
      ipcRenderer.removeListener('deep-link', subscription);
    };
  }
} as ElectronAPI

// Expose the API to the renderer process
try {
contextBridge.exposeInMainWorld("electronAPI", electronAPI)
  console.log("✅ electronAPI exposed to window successfully")
} catch (error) {
  console.error("❌ Failed to expose electronAPI:", error)
}

// Add this focus restoration handler
ipcRenderer.on("restore-focus", () => {
  // Try to focus the active element if it exists
  const activeElement = document.activeElement as HTMLElement
  if (activeElement && typeof activeElement.focus === "function") {
    activeElement.focus()
  }
})

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    on: (channel: string, func: (...args: any[]) => void) => {
      if (channel === "auth-callback") {
        ipcRenderer.on(channel, (event, ...args) => func(...args))
      }
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      if (channel === "auth-callback") {
        ipcRenderer.removeListener(channel, (event, ...args) => func(...args))
      }
    }
  }
})

// ipcHandlers.ts

import { ipcMain, shell, app } from "electron"
// import { createClient } from "@supabase/supabase-js" // Temporarily disabled
import { randomBytes } from "crypto"
import { IIpcHandlerDeps } from "./main"

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  console.log("Initializing IPC handlers")

  // Credits handlers
  ipcMain.handle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // Set the credits in a way that ensures atomicity
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      console.error("Error setting initial credits:", error)
      throw error
    }
  })



  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path)
  })

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path)
  })

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    await deps.processingHelper?.processScreenshots()
  })

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = []
      const currentView = deps.getView()

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue()
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      } else {
        const extraQueue = deps.getExtraScreenshotQueue()
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      }

      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot()
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        console.error("Error triggering screenshot:", error)
        return { error: "Failed to trigger screenshot" }
      }
    }
    return { error: "No main window available" }
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      const preview = await deps.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      return { error: "Failed to take screenshot" }
    }
  })

  // Pixel sampling handler for button background detection
  ipcMain.handle("sample-background-color", async (event, x: number, y: number) => {
    try {
      const screenshotHelper = deps.getScreenshotHelper()
      if (!screenshotHelper) {
        return { error: "Screenshot helper not available" }
      }
      
      const colorData = await screenshotHelper.samplePixelsAtPosition(x, y)
      return { success: true, ...colorData }
    } catch (error) {
      console.error("Error sampling background color:", error)
      return { error: "Failed to sample background color" }
    }
  })

  // Auth related handlers
  ipcMain.handle("get-pkce-verifier", () => {
    return randomBytes(32).toString("base64url")
  })

  ipcMain.handle("open-external-url", (event, url) => {
    if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
      shell.openExternal(url)
    }
  })

  // Subscription handlers
  ipcMain.handle("open-settings-portal", () => {
    shell.openExternal("https://wagoo.ai")
  })
  ipcMain.handle("open-subscription-portal", async (_event, authData) => {
    try {
      const url = "https://wagoo.ai"
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error("Error opening subscription page:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to open subscription page"
      }
    }
  })

  // Environment variable handler
  ipcMain.handle("get-env-var", (event, varName: string) => {
    console.log(`[IPC] Request for env var: ${varName}, value: ${process.env[varName] ? "Exists" : "Missing"}`);
    return process.env[varName]
  })

  // Microphone permission handler
  ipcMain.handle("check-microphone-permission", async () => {
    if (process.platform === 'darwin') {
      try {
        const { systemPreferences } = require('electron')
        const status = systemPreferences.getMediaAccessStatus('microphone')
        
        console.log('[IPC] Current microphone status:', status)
        
        if (status === 'not-determined' || status === 'denied') {
          console.log('[IPC] Requesting microphone access...')
          const granted = await systemPreferences.askForMediaAccess('microphone')
          console.log('[IPC] Microphone access granted:', granted)
          return { 
            status: granted ? 'granted' : 'denied',
            granted 
          }
        }
        
        return { 
          status,
          granted: status === 'granted' 
        }
      } catch (error) {
        console.error('[IPC] Error checking microphone permission:', error)
        return {
          status: 'denied',
          granted: false,
          error: error.message
        }
      }
    }
    
    // For non-macOS platforms, assume granted
    return { 
      status: 'granted',
      granted: true 
    }
  })

  // App version handler
  ipcMain.handle("get-app-version", () => {
    return app.getVersion()
  })

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      console.error("Error toggling window:", error)
      return { error: "Failed to toggle window" }
    }
  })

  // New window state management handlers
  ipcMain.handle("set-window-state", (event, state: 'full' | 'button-only' | 'hidden') => {
    try {
      const mainWindow = deps.getMainWindow()
      if (!mainWindow) return { error: "No main window available" }

      switch (state) {
        case 'full':
          if (mainWindow.isVisible()) {
            mainWindow.show()
          }
          break
        case 'button-only':
          // For button-only mode, we don't actually hide the window in Electron
          // The UI handles this by only showing the floating button
          break
        case 'hidden':
          mainWindow.hide()
          break
      }

      // Send state update to renderer
      mainWindow.webContents.send("window-state-changed", state)
      return { success: true }
    } catch (error) {
      console.error("Error setting window state:", error)
      return { error: "Failed to set window state" }
    }
  })

  ipcMain.handle("hide-floating-button", () => {
    try {
      const mainWindow = deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send("hide-floating-button")
      }
      return { success: true }
    } catch (error) {
      console.error("Error hiding floating button:", error)
      return { error: "Failed to hide floating button" }
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      console.error("Error resetting queues:", error)
      return { error: "Failed to reset queues" }
    }
  })

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      await deps.processingHelper?.processScreenshots()
      return { success: true }
    } catch (error) {
      console.error("Error processing screenshots:", error)
      return { error: "Failed to process screenshots" }
    }
  })

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests()

      // Clear all queues immediately
      deps.clearQueues()

      // Reset view to queue
      deps.setView("queue")

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }

      return { success: true }
    } catch (error) {
      console.error("Error triggering reset:", error)
      return { error: "Failed to trigger reset" }
    }
  })

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      console.error("Error moving window left:", error)
      return { error: "Failed to move window left" }
    }
  })

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      console.error("Error moving window right:", error)
      return { error: "Failed to move window right" }
    }
  })

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      console.error("Error moving window up:", error)
      return { error: "Failed to move window up" }
    }
  })

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      console.error("Error moving window down:", error)
      return { error: "Failed to move window down" }
    }
  })
}

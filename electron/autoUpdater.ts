import { autoUpdater } from "electron-updater"
import { BrowserWindow, ipcMain, app } from "electron"
import log from "electron-log"

export function initAutoUpdater() {
  console.log("Initializing auto-updater...")

  if (app.isPackaged) {
    log.transports.file.level = 'warn'
    log.transports.console.level = false
  }

  // Development mode - allow detection but skip actual updates
  const isDev = !app.isPackaged
  
  if (isDev) {
    console.log("Development mode detected: Will check for updates but skip downloading/installing")
  }

  if (!process.env.VITE_GH_TOKEN) {
    console.warn(
      "VITE_GH_TOKEN environment variable is not set – updater will use anonymous GitHub requests"
    )
  }

  // Configure auto updater to use public releases repository
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "MiPlayer123",
    repo: "wagoo-releases",
    private: false
  })

  // Configure auto updater
  autoUpdater.autoDownload = !isDev  // Don't auto-download in dev mode
  autoUpdater.autoInstallOnAppQuit = !isDev  // Don't auto-install in dev mode
  autoUpdater.allowDowngrade = true
  autoUpdater.allowPrerelease = true

  // Enable more verbose logging
  autoUpdater.logger = log
  log.transports.file.level = "debug"
  console.log(
    "Auto-updater logger configured with level:",
    log.transports.file.level
  )

  // Log all update events
  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for updates...")
  })

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info)
    
    if (isDev) {
      console.log("[DEV MODE] Update detected but skipping download. Version info:", {
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        releaseDate: info.releaseDate,
        releaseName: info.releaseName
      })
    }
    
    // Notify renderer process about available update
    BrowserWindow.getAllWindows().forEach((window) => {
      console.log("Sending update-available to window")
      window.webContents.send("update-available", info)
    })
  })

  autoUpdater.on("update-not-available", (info) => {
    console.log("Update not available:", info)
  })

  autoUpdater.on("download-progress", (progressObj) => {
    console.log("Download progress:", progressObj)
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("download-progress", progressObj)
    })
  })

  autoUpdater.on("update-downloaded", (info) => {
    console.log("Update downloaded:", info)
    // Notify renderer process that update is ready to install
    BrowserWindow.getAllWindows().forEach((window) => {
      console.log("Sending update-downloaded to window")
      window.webContents.send("update-downloaded", info)
    })
  })

  autoUpdater.on("error", (err) => {
    console.error("Auto updater error:", err)
  })

  // Check for updates immediately
  console.log("Checking for updates...")
  if (isDev) {
    console.log("[DEV MODE] Checking GitHub releases at: https://github.com/MiPlayer123/wagoo-releases/releases")
  }
  autoUpdater
    .checkForUpdates()
    .then((result) => {
      console.log("Update check result:", result)
      if (isDev && result) {
        console.log("[DEV MODE] Update check completed. Current version:", app.getVersion())
      }
    })
    .catch((err) => {
      console.error("Error checking for updates:", err)
      if (isDev) {
        console.error("[DEV MODE] This might be due to missing releases or network issues")
      }
    })

  // Set up update checking interval (every 1 hour)
  setInterval(() => {
    console.log("Checking for updates (interval)...")
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        console.log("Update check result (interval):", result)
      })
      .catch((err) => {
        console.error("Error checking for updates (interval):", err)
      })

    // Also check subscription validity periodically
    console.log("Checking subscription validity (interval)...")
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("check-subscription-validity")
    })
  }, 60 * 60 * 1000)

  // Handle IPC messages from renderer
  ipcMain.handle("start-update", async () => {
    console.log("Start update requested")
    
    if (isDev) {
      console.log("[DEV MODE] Simulating update download (no actual download)")
      // Simulate download progress in dev mode
      setTimeout(() => {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send("download-progress", {
            bytesPerSecond: 1000000,
            percent: 50,
            transferred: 50000000,
            total: 100000000
          })
        })
      }, 1000)
      
      setTimeout(() => {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send("download-progress", {
            bytesPerSecond: 1000000,
            percent: 100,
            transferred: 100000000,
            total: 100000000
          })
          window.webContents.send("update-downloaded", { version: "dev-test" })
        })
      }, 2000)
      
      return { success: true }
    }
    
    try {
      await autoUpdater.downloadUpdate()
      console.log("Update download completed")
      return { success: true }
    } catch (error) {
      console.error("Failed to start update:", error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle("install-update", () => {
    console.log("Install update requested")
    
    if (isDev) {
      console.log("[DEV MODE] Update installation requested but skipping (would quit and install in production)")
      return
    }
    
    autoUpdater.quitAndInstall()
  })
}

import { app, BrowserWindow, screen, shell, ipcMain, session } from "electron"
import path from "path"
import fs from "fs"
import { initializeIpcHandlers } from "./ipcHandlers"
import { initializeLocalModelIpcHandlers } from "./localModelIpcHandlers"
import { initializeLocalWhisperIpcHandlers } from "./localWhisperIpcHandlers"
import { LocalProcessingHelper } from "./LocalProcessingHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { initAutoUpdater } from "./autoUpdater"
import * as dotenv from "dotenv"



// Constants
const isDev = !app.isPackaged

// Performance optimization: Disable console logging in production
if (!isDev) {
  const noop = () => {}
  console.log = noop
  console.warn = noop
  console.info = noop
  console.debug = noop
  console.trace = noop
  console.time = noop
  console.timeEnd = noop
  console.group = noop
  console.groupEnd = noop
  console.groupCollapsed = noop
  console.count = noop
  console.countReset = noop
  console.clear = noop
  // Keep console.error for debugging critical issues
}

// Application State
const state = {
  // Window management properties
  mainWindow: null as BrowserWindow | null,
  buttonWindow: null as BrowserWindow | null,
  isWindowVisible: false,
  isButtonVisible: true,
  windowPosition: null as { x: number; y: number } | null,
  windowSize: null as { width: number; height: number } | null,
  screenWidth: 0,
  screenHeight: 0,
  step: 0,
  currentX: 0,
  currentY: 0,

  // Application helpers
  screenshotHelper: null as ScreenshotHelper | null,
  shortcutsHelper: null as ShortcutsHelper | null,
  processingHelper: null as LocalProcessingHelper | null,

  // View and state management
  view: "queue" as "queue" | "solutions" | "debug",
  problemInfo: null as any,
  hasDebugged: false,

  // Processing events
  PROCESSING_EVENTS: {
    UNAUTHORIZED: "processing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",
    OUT_OF_CREDITS: "out-of-credits",
    API_KEY_INVALID: "processing-api-key-invalid",
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const
}

// -------------- deep-link patch START --------------
/**
 * Registers wagoo:// so Windows re-launches THE SAME
 * command that npm run dev started (electron.exe <main.js> …)
 */
function registerWagooProtocol() {
  app.removeAsDefaultProtocolClient("wagoo");
  const exe   = process.execPath;
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
  
  if (process.platform === "win32") {
    // Set explicit AppUserModelID to avoid conflicts with old installations
    app.setAppUserModelId("com.wagoo.app");
    
    // Clear any old UserChoice association in development
    if (process.defaultApp) {
      try {
        const { execSync } = require('child_process');
        execSync('reg delete "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\wagoo\\UserChoice" /f 2>nul', { stdio: 'ignore' });
        console.log("[deep-link] cleared old UserChoice association");
      } catch (error) {
        // Ignore errors if key doesn't exist
      }
    }
    
    // Windows: Electron automatically adds "%1" for us, so don't include it manually
    const ok = process.defaultApp
      ? app.setAsDefaultProtocolClient("wagoo", exe, [entry])
      : app.setAsDefaultProtocolClient("wagoo");
    console.log("[deep-link] protocol registered?", ok,
                "\n         exe :", exe,
                "\n         arg :", entry,
                "\n         appId: com.wagoo.app");
  } else if (process.platform === "darwin") {
    // macOS: just use the protocol name
    const ok = app.setAsDefaultProtocolClient("wagoo");
    console.log("[deep-link] protocol registered?", ok,
                "\n         exe :", exe,
                "\n         arg :", entry);
  } else {
    // Linux or other: Electron automatically adds "%1" for us
    const ok = app.setAsDefaultProtocolClient("wagoo", exe, [entry]);
    console.log("[deep-link] protocol registered?", ok,
                "\n         exe :", exe,
                "\n         arg :", entry);
  }
}

/** Pull first wagoo:// link from any argv list */
function extractLink(argv: string[]): string | null {
  console.log("[deep-link] extractLink called with argv:", argv);
  const link = argv.find(a => a.startsWith("wagoo://")) || null;
  if (link) {
    console.log("[deep-link] extracted link:", link);
  } else {
    console.log("[deep-link] no wagoo:// link found in argv");
  }
  return link;
}

// Single instance lock for deep linking
console.log("[deep-link] requesting single instance lock...");
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log("[deep-link] single instance lock failed, quitting...");
  app.quit();
  process.exit();
}
console.log("[deep-link] single instance lock acquired successfully");

// [deep-link] TOP-LEVEL: process.argv on launch:
console.log("[deep-link] TOP-LEVEL: process.argv:", process.argv);

console.log("[deep-link] checking process.argv for startup deep links...");
let deepLinkOnLaunch = extractLink(process.argv);

app.on("second-instance", (_event, argv) => {
  console.log("[deep-link] second-instance event fired. argv:", argv);
  const link = extractLink(argv);
  if (link && state.mainWindow) {
    console.log("[deep-link] sending to renderer:", link);
    // Wait for window to be ready before sending deep link
    if (state.mainWindow.webContents.isLoading()) {
      console.log("[deep-link] window still loading, waiting...");
      state.mainWindow.webContents.once('did-finish-load', () => {
        console.log("[deep-link] window finished loading, now sending deep link");
        state.mainWindow?.webContents.send("deep-link", link);
        state.mainWindow?.restore();
        state.mainWindow?.focus();
      });
    } else {
      state.mainWindow.webContents.send("deep-link", link);
      state.mainWindow.restore();
      state.mainWindow.focus();
    }
  } else if (link && !state.mainWindow) {
    console.log("[deep-link] deep link found but mainWindow is null");
  } else if (!link) {
    console.log("[deep-link] no deep link found in second-instance argv");
  }
});

// macOS specific handler
app.on("open-url", (event, url) => {
  console.log("[deep-link] open-url event received:", url);
  event.preventDefault();
  if (url && url.startsWith("wagoo://")) {
    console.log("[deep-link] handling wagoo:// URL via open-url:", url);
    if (state.mainWindow) {
      // Wait for window to be ready before sending deep link
      if (state.mainWindow.webContents.isLoading()) {
        console.log("[deep-link] window still loading, waiting...");
        state.mainWindow.webContents.once('did-finish-load', () => {
          console.log("[deep-link] window finished loading, now sending deep link");
          state.mainWindow?.webContents.send("deep-link", url);
          state.mainWindow?.restore();
          state.mainWindow?.focus();
        });
      } else {
        state.mainWindow.webContents.send("deep-link", url);
        state.mainWindow.restore();
        state.mainWindow.focus();
      }
    } else {
      console.log("[deep-link] mainWindow not ready, storing URL for later");
      deepLinkOnLaunch = url;
    }
  }
});
// -------------- deep-link patch END --------------

// Add interfaces for helper classes
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  getView: () => "queue" | "solutions" | "debug"
  setView: (view: "queue" | "solutions" | "debug") => void
  getProblemInfo: () => any
  setProblemInfo: (info: any) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  clearQueues: () => void
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  setHasDebugged: (value: boolean) => void
  getHasDebugged: () => boolean
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null
  getButtonWindow: () => BrowserWindow | null
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: LocalProcessingHelper | null
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  isVisible: () => boolean
  toggleMainWindow: () => void
  toggleButtonWindow: () => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

export interface IIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null
  getButtonWindow: () => BrowserWindow | null
  setWindowDimensions: (width: number, height: number) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: LocalProcessingHelper | null
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
  takeScreenshot: () => Promise<string>
  getView: () => "queue" | "solutions" | "debug"
  getScreenshotHelper: () => ScreenshotHelper | null
  toggleMainWindow: () => void
  toggleButtonWindow: () => void
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

// Initialize helpers
function initializeHelpers() {
  state.screenshotHelper = new ScreenshotHelper(state.view)
  state.processingHelper = new LocalProcessingHelper({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getProblemInfo,
    setProblemInfo,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    getImagePreview,
    deleteScreenshot,
    setHasDebugged,
    getHasDebugged,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS
  } as IProcessingHelperDeps)
  state.shortcutsHelper = new ShortcutsHelper({
    getMainWindow,
    getButtonWindow,
    takeScreenshot,
    getImagePreview,
    processingHelper: state.processingHelper,
    clearQueues,
    setView,
    isVisible: () => state.isWindowVisible,
    toggleMainWindow,
    toggleButtonWindow,
    moveWindowLeft: () =>
      moveWindowHorizontal((x) =>
        Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
      ),
    moveWindowRight: () =>
      moveWindowHorizontal((x) =>
        Math.min(
          state.screenWidth - (state.windowSize?.width || 0) / 2,
          x + state.step
        )
      ),
    moveWindowUp: () => moveWindowVertical((y) => y - state.step),
    moveWindowDown: () => moveWindowVertical((y) => y + state.step)
  } as IShortcutsHelperDeps)
}

// Auth callback handler





async function handleAuthCallback(url: string, win: BrowserWindow | null) {
  try {
    console.log("=== AUTH CALLBACK HANDLER ===")
    console.log("Auth callback received:", url)
    console.log("Target window:", win ? "exists" : "null")
    
    const urlObj = new URL(url)
    console.log("Parsed URL:", urlObj.toString())
    console.log("URL search params:", urlObj.searchParams.toString())
    
    // Handle both the old format (wagoo://auth/callback?code=...) and new format (wagoo://auth?code=...)
    const code = urlObj.searchParams.get("code")
    console.log("Extracted code:", code ? "exists" : "null")

    if (!code) {
      console.error("Missing code in callback URL")
      console.log("Available search params:", Array.from(urlObj.searchParams.entries()))
      return
    }

    console.log("Code extracted from URL, sending to renderer...")
    
    if (win) {
      // Check if window is ready to receive messages
      if (win.webContents.isLoading()) {
        console.log("Window is still loading, waiting...")
        win.webContents.once('did-finish-load', () => {
          console.log("Window finished loading, now sending auth callback")
          win.webContents.send("auth-callback", { code })
        })
      } else {
        // Send the code to the renderer for PKCE exchange
        win.webContents.send("auth-callback", { code })
        console.log("Auth callback sent to renderer process")
      }
    } else {
      console.error("No window available to send auth callback")
    }
  } catch (error) {
    console.error("Error handling auth callback:", error)
    console.error("Error details:", error instanceof Error ? error.message : error)
  }
}

// Window management functions
async function createWindow(): Promise<void> {
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore()
    state.mainWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  state.screenWidth = workArea.width
  state.screenHeight = workArea.height
  state.step = 60
  
  // Position window at bottom-right corner, but leave space for button window
  const windowWidth = 450
  const windowHeight = 600
  const margin = 20 // Margin from screen edges
  const buttonSpace = 68 + 20 // Button size + extra margin
  state.currentX = workArea.width - windowWidth - margin - buttonSpace
  state.currentY = workArea.height - windowHeight - margin

  const windowSettings: Electron.BrowserWindowConstructorOptions = {
    width: windowWidth,
    height: windowHeight,
    minWidth: 400,
    minHeight: 300,
    x: state.currentX,
    y: state.currentY,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, "../dist-electron/preload.js")
        : path.join(__dirname, "preload.js"),
      scrollBounce: true,
      // Performance optimizations
      spellcheck: true, // Disable spellcheck for better performance
      enableWebSQL: false, // Disable WebSQL for security and performance
      experimentalFeatures: false, // Disable experimental features
      // Enable hardware acceleration
      webgl: true,
      plugins: false, // Disable plugins for security and performance
    },
    show: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    focusable: true,
    skipTaskbar: true,
    type: "panel",
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true,
    resizable: true
  }

  state.mainWindow = new BrowserWindow(windowSettings)

  // Add more detailed logging for window events
  state.mainWindow.webContents.on("did-finish-load", () => {
    console.log("Window finished loading")
  })
  state.mainWindow.webContents.on(
    "did-fail-load",
    async (event, errorCode, errorDescription) => {
      console.error("Window failed to load:", errorCode, errorDescription)
      if (isDev) {
        // In development, retry loading after a short delay
        console.log("Retrying to load development server...")
        setTimeout(() => {
          state.mainWindow?.loadURL("http://localhost:54321").catch((error) => {
            console.error("Failed to load dev server on retry:", error)
          })
        }, 1000)
      }
    }
  )

  if (isDev) {
    // In development, load from the dev server
    state.mainWindow.loadURL("http://localhost:54321").catch((error) => {
      console.error("Failed to load dev server:", error)
    })
  } else {
    // In production, load from the built files
    console.log(
      "Loading production build:",
      path.join(__dirname, "../dist/index.html")
    )
    state.mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
  }

  // Configure window behavior
  state.mainWindow.webContents.setZoomFactor(1)
  if (isDev) {
    state.mainWindow.webContents.openDevTools()
  }
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Attempting to open URL:", url)
    if (url.includes("google.com") || url.includes("supabase.co")) {
      shell.openExternal(url)
      return { action: "deny" }
    }
    return { action: "allow" }
  })

  // Enhanced screen capture resistance
  // TEMPORARY: Disable for screenshot visibility testing
  state.mainWindow.setContentProtection(true)

  state.mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  })
  state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1)

  // Additional screen capture resistance settings
  if (process.platform === "darwin") {
    // Prevent window from being captured in screenshots
    state.mainWindow.setHiddenInMissionControl(true)
    state.mainWindow.setWindowButtonVisibility(false)
    state.mainWindow.setBackgroundColor("#00000000")

    // Prevent window from being included in window switcher
    state.mainWindow.setSkipTaskbar(true)

    // Disable window shadow
    state.mainWindow.setHasShadow(false)
  }

  // Performance optimization: Enable background throttling in production for better performance
  // Only disable in development for debugging
  if (isDev) {
    state.mainWindow.webContents.setBackgroundThrottling(true)
    state.mainWindow.webContents.setFrameRate(60)
  } else {
    // In production, enable throttling for better performance
    state.mainWindow.webContents.setBackgroundThrottling(true)
    // Don't force high frame rate in production
  }

  // Set up window listeners
  state.mainWindow.on("move", handleWindowMove)
  state.mainWindow.on("resize", handleWindowResize)
  state.mainWindow.on("closed", handleWindowClosed)

  // Initialize window state
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.windowSize = { width: bounds.width, height: bounds.height }
  state.currentX = bounds.x
  state.currentY = bounds.y
  state.isWindowVisible = true
}

function handleWindowMove(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.currentX = bounds.x
  state.currentY = bounds.y
}

function handleWindowResize(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowSize = { width: bounds.width, height: bounds.height }
}

function handleWindowClosed(): void {
  state.mainWindow = null
  state.isWindowVisible = false
  state.windowPosition = null
  state.windowSize = null
}

// Window visibility functions
function hideMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    const bounds = state.mainWindow.getBounds()
    state.windowPosition = { x: bounds.x, y: bounds.y }
    state.windowSize = { width: bounds.width, height: bounds.height }
    state.mainWindow.setIgnoreMouseEvents(true, { forward: true })
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1)
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true
    })
    state.mainWindow.setOpacity(0)
    state.mainWindow.hide()
    state.isWindowVisible = false
  }
}

function showMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    if (state.windowPosition && state.windowSize) {
      state.mainWindow.setBounds({
        ...state.windowPosition,
        ...state.windowSize
      })
    }
    state.mainWindow.setIgnoreMouseEvents(false)
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1)
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true
    })
    // TEMPORARY: Disable for screenshot visibility testing
    state.mainWindow.setContentProtection(true)
    state.mainWindow.setOpacity(0)
    state.mainWindow.showInactive()
    state.mainWindow.setOpacity(1)
    state.isWindowVisible = true
  }
}

function toggleMainWindow(): void {
  state.isWindowVisible ? hideMainWindow() : showMainWindow()
}

// Window movement functions
function moveWindowHorizontal(updateFn: (x: number) => number): void {
  if (!state.mainWindow) return
  state.currentX = updateFn(state.currentX)
  state.mainWindow.setPosition(
    Math.round(state.currentX),
    Math.round(state.currentY)
  )
}

function moveWindowVertical(updateFn: (y: number) => number): void {
  if (!state.mainWindow) return

  const newY = updateFn(state.currentY)
  // Allow window to go 2/3 off screen in either direction
  const maxUpLimit = (-(state.windowSize?.height || 0) * 2) / 3
  const maxDownLimit =
    state.screenHeight + ((state.windowSize?.height || 0) * 2) / 3

  // Log the current state and limits
  console.log({
    newY,
    maxUpLimit,
    maxDownLimit,
    screenHeight: state.screenHeight,
    windowHeight: state.windowSize?.height,
    currentY: state.currentY
  })

  // Only update if within bounds
  if (newY >= maxUpLimit && newY <= maxDownLimit) {
    state.currentY = newY
    state.mainWindow.setPosition(
      Math.round(state.currentX),
      Math.round(state.currentY)
    )
  }
}

// Window dimension functions (disabled for chat view to prevent resizing interference)
function setWindowDimensions(width: number, height: number): void {
  if (!state.mainWindow?.isDestroyed()) {
    // Skip automatic dimension updates to allow manual resizing
    // This prevents interference with user-initiated window resizing
    console.log('setWindowDimensions called but skipped to preserve manual resizing')
    return
  }
}

// Environment setup
function loadEnvVariables() {
  let envPath: string

  if (isDev) {
    envPath = path.join(process.cwd(), ".env")
    console.log("Looking for .env file at:", envPath)
  } else {
    envPath = path.join(process.resourcesPath, ".env")
    console.log("Looking for .env file in production at:", envPath)
  }

  if (fs.existsSync(envPath)) {
    console.log(".env file found. Loading variables.")
    dotenv.config({ path: envPath })
  } else {
    console.error(
      "FATAL: .env file not found at",
      envPath,
      "Please ensure it is correctly placed."
    )
    // In a production environment, you might want to handle this more gracefully
    // or quit the app, as essential configurations might be missing.
    if (!isDev) {
      app.quit()
    }
  }

  console.log("Loaded environment variables:", {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? "exists" : "missing",
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
      ? "exists"
      : "missing",
    VITE_OPENAI_API_KEY: process.env.VITE_OPENAI_API_KEY ? "exists" : "missing",
    VITE_ANTHROPIC_API_KEY: process.env.VITE_ANTHROPIC_API_KEY ? "exists" : "missing",
    VITE_GOOGLE_API_KEY: process.env.VITE_GOOGLE_API_KEY ? "exists" : "missing"
  })
}

// Initialize application
async function initializeApp() {
  try {
    // Set app name and version for Windows
    if (process.platform === "win32") {
      app.setAppUserModelId("com.chunginlee.wagoo")
      app.setName("Wagoo")
    }
    
    loadEnvVariables()
    initializeHelpers()
    
    // Handle microphone permissions
    app.commandLine.appendSwitch('enable-speech-dispatcher')
    
    // macOS-specific microphone permission request
    if (process.platform === 'darwin') {
      const { systemPreferences } = require('electron')
      const microphoneStatus = systemPreferences.getMediaAccessStatus('microphone')
      
      if (microphoneStatus !== 'granted') {
        // In production, be more proactive about requesting permissions
        try {
          const granted = await systemPreferences.askForMediaAccess('microphone')
          if (!granted && !isDev) {
            console.error('[Wagoo] Microphone access denied by user')
          } else if (granted) {
            console.log('[Wagoo] Microphone access granted')
          }
        } catch (error) {
          if (!isDev) {
            console.error('[Wagoo] Failed to request microphone access:', error)
          }
        }
      } else {
        console.log('[Wagoo] Microphone access already granted')
      }
    }
    
    // Set up permission handler for microphone access
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      // Always grant microphone permissions
      if (permission === 'media') {
        callback(true)
        return
      }
      
      // Grant other necessary permissions
      if (['notifications', 'fullscreen', 'pointerLock'].includes(permission)) {
        callback(true)
        return
      }
      
      // Deny other permissions by default
      callback(false)
    })
    initializeIpcHandlers({
      getMainWindow,
      getButtonWindow,
      setWindowDimensions,
      getScreenshotQueue,
      getExtraScreenshotQueue,
      deleteScreenshot,
      getImagePreview,
      processingHelper: state.processingHelper,
      PROCESSING_EVENTS: state.PROCESSING_EVENTS,
      takeScreenshot,
      getView,
      getScreenshotHelper,
      toggleMainWindow,
      toggleButtonWindow,
      clearQueues,
      setView,
      moveWindowLeft: () =>
        moveWindowHorizontal((x) =>
          Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
        ),
      moveWindowRight: () =>
        moveWindowHorizontal((x) =>
          Math.min(
            state.screenWidth - (state.windowSize?.width || 0) / 2,
            x + state.step
          )
        ),
      moveWindowUp: () => moveWindowVertical((y) => y - state.step),
      moveWindowDown: () => moveWindowVertical((y) => y + state.step)
    })
    await initializeLocalModelIpcHandlers()
    await initializeLocalWhisperIpcHandlers()
    await createWindow()
    await createButtonWindow()
    state.shortcutsHelper?.registerGlobalShortcuts()

    // Handle deep links that arrived before window was ready
    if (deepLinkOnLaunch && state.mainWindow) {
      console.log("[deep-link] processing stored deep link:", deepLinkOnLaunch);
      // Wait for window to be ready before sending deep link
      if (state.mainWindow.webContents.isLoading()) {
        console.log("[deep-link] window still loading, waiting...");
        state.mainWindow.webContents.once('did-finish-load', () => {
          console.log("[deep-link] window finished loading, now sending deep link");
          state.mainWindow?.webContents.send("deep-link", deepLinkOnLaunch);
        });
      } else {
        state.mainWindow.webContents.send("deep-link", deepLinkOnLaunch);
      }
      deepLinkOnLaunch = null;
    }
    
    // Handle startup deep links (when app is launched with wagoo:// URL)
    const startupDeepLink = extractLink(process.argv);
    if (startupDeepLink && state.mainWindow) {
      console.log("[deep-link] processing startup deep link:", startupDeepLink);
      // Wait for window to be ready before sending deep link
      if (state.mainWindow.webContents.isLoading()) {
        console.log("[deep-link] window still loading, waiting...");
        state.mainWindow.webContents.once('did-finish-load', () => {
          console.log("[deep-link] window finished loading, now sending startup deep link");
          state.mainWindow?.webContents.send("deep-link", startupDeepLink);
        });
      } else {
        state.mainWindow.webContents.send("deep-link", startupDeepLink);
      }
    }

    // Initialize auto-updater regardless of environment
    initAutoUpdater()
    console.log(
      "Auto-updater initialized in",
      isDev ? "development" : "production",
      "mode"
    )
  } catch (error) {
    console.error("Failed to initialize application:", error)
    app.quit()
  }
}



// Window lifecycle handlers
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
    state.mainWindow = null
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Button window functions
async function createButtonWindow(): Promise<void> {
  if (state.buttonWindow) {
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  
  // Small window for just the button (68x68 pixels)
  const buttonSize = 68
  const margin = 10
  
  const windowSettings: Electron.BrowserWindowConstructorOptions = {
    width: buttonSize,
    height: buttonSize,
    x: workArea.width - buttonSize - margin,
    y: workArea.height - buttonSize - 10, // Position very close to bottom of screen
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, "../dist-electron/preload.js")
        : path.join(__dirname, "preload.js"),
              scrollBounce: true
    },
    show: state.isButtonVisible,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    focusable: false,
    skipTaskbar: true,
    type: "panel",
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    resizable: false,
    movable: false
  }

  state.buttonWindow = new BrowserWindow(windowSettings)

  // Load the button-specific route
  if (isDev) {
    state.buttonWindow.loadURL("http://localhost:54321/?button=true").catch((error) => {
      console.error("Failed to load button window:", error)
    })
  } else {
    // For production, load the main page with a query parameter to identify it as button window
    state.buttonWindow.loadFile(path.join(__dirname, "../dist/index.html"))
    // Add the button parameter after loading
    state.buttonWindow.webContents.once('did-finish-load', () => {
      state.buttonWindow?.webContents.executeJavaScript(`
        window.history.replaceState({}, '', '/?button=true');
      `)
    })
  }

  // Configure button window behavior with screen capture resistance
  state.buttonWindow.webContents.setZoomFactor(1)
  if (isDev) {
    // Don't open dev tools for button window to keep it clean
  }
  
  // Enhanced screen capture resistance
  // TEMPORARY: Disable for screenshot visibility testing
  state.buttonWindow.setContentProtection(true)
  
  state.buttonWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  })
  state.buttonWindow.setAlwaysOnTop(true, "screen-saver", 2) // Higher level than main window

  // Additional screen capture resistance settings
  if (process.platform === "darwin") {
    // Prevent window from being captured in screenshots
    state.buttonWindow.setHiddenInMissionControl(true)
    state.buttonWindow.setWindowButtonVisibility(false)

    // Prevent window from being included in window switcher
    state.buttonWindow.setSkipTaskbar(true)

    // Disable window shadow
    state.buttonWindow.setHasShadow(false)
  }

  // Performance optimization: Enable background throttling for button window
  if (isDev) {
    state.buttonWindow.webContents.setBackgroundThrottling(false)
    state.buttonWindow.webContents.setFrameRate(60)
  } else {
    // Button window doesn't need high performance, enable throttling
    state.buttonWindow.webContents.setBackgroundThrottling(true)
  }

  state.buttonWindow.on("closed", () => {
    state.buttonWindow = null
  })

  // The button click handling is done in the React component via IPC
}

function getButtonWindow(): BrowserWindow | null {
  return state.buttonWindow
}

function showButtonWindow(): void {
  if (state.buttonWindow && !state.buttonWindow.isDestroyed()) {
    state.buttonWindow.show()
    state.isButtonVisible = true
  }
}

function hideButtonWindow(): void {
  if (state.buttonWindow && !state.buttonWindow.isDestroyed()) {
    state.buttonWindow.hide()
    state.isButtonVisible = false
  }
}

function toggleButtonWindow(): void {
  if (state.isButtonVisible) {
    hideButtonWindow()
  } else {
    showButtonWindow()
  }
}

// State getter/setter functions
function getMainWindow(): BrowserWindow | null {
  return state.mainWindow
}

function getView(): "queue" | "solutions" | "debug" {
  return state.view
}

function setView(view: "queue" | "solutions" | "debug"): void {
  state.view = view
  state.screenshotHelper?.setView(view)
}

function getScreenshotHelper(): ScreenshotHelper | null {
  return state.screenshotHelper
}

function getProblemInfo(): any {
  return state.problemInfo
}

function setProblemInfo(problemInfo: any): void {
  state.problemInfo = problemInfo
}

function getScreenshotQueue(): string[] {
  return state.screenshotHelper?.getScreenshotQueue() || []
}

function getExtraScreenshotQueue(): string[] {
  return state.screenshotHelper?.getExtraScreenshotQueue() || []
}

function clearQueues(): void {
  state.screenshotHelper?.clearQueues()
  state.problemInfo = null
  setView("queue")
}

async function takeScreenshot(): Promise<string> {
  if (!state.mainWindow) throw new Error("No main window available")
  // Since window is invisible to screenshots, use noop functions
  const noop = () => {}
  return (
    state.screenshotHelper?.takeScreenshot(noop, noop) || ""
  )
}

async function getImagePreview(filepath: string): Promise<string> {
  return state.screenshotHelper?.getImagePreview(filepath) || ""
}

async function deleteScreenshot(
  path: string
): Promise<{ success: boolean; error?: string }> {
  return (
    state.screenshotHelper?.deleteScreenshot(path) || {
      success: false,
      error: "Screenshot helper not initialized"
    }
  )
}

function setHasDebugged(value: boolean): void {
  state.hasDebugged = value
}

function getHasDebugged(): boolean {
  return state.hasDebugged
}

// Export state and functions for other modules
export {
  state,
  createWindow,
  createButtonWindow,
  hideMainWindow,
  showMainWindow,
  toggleMainWindow,
  getButtonWindow,
  showButtonWindow,
  hideButtonWindow,
  toggleButtonWindow,
  setWindowDimensions,
  moveWindowHorizontal,
  moveWindowVertical,
  handleAuthCallback,
  getMainWindow,
  getView,
  setView,
  getScreenshotHelper,
  getProblemInfo,
  setProblemInfo,
  getScreenshotQueue,
  getExtraScreenshotQueue,
  clearQueues,
  takeScreenshot,
  getImagePreview,
  deleteScreenshot,
  setHasDebugged,
  getHasDebugged
}

// -------------- deep-link patch START --------------
// Initialize the app when ready
console.log("[deep-link] setting up app.whenReady() handler...");
app.whenReady().then(() => {
  console.log("[deep-link] app.whenReady() called, registering protocol...");
  
  // Register the protocol handler
  registerWagooProtocol();
  
  console.log("[deep-link] initializing app...");
  initializeApp();
}).catch((error) => {
  console.error("[deep-link] error in app.whenReady():", error);
});
// -------------- deep-link patch END --------------


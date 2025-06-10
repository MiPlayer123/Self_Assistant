// LocalProcessingHelper.ts - Local AI processing using OpenAI API
import fs from "node:fs"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import { BrowserWindow } from "electron"
import { ModelManager, initializeModelManager, getOpenAIApiKey } from "../src/models"

export class LocalProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private modelManager: ModelManager | null = null

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    const screenshotHelper = deps.getScreenshotHelper()
    if (!screenshotHelper) {
      throw new Error('ScreenshotHelper is required')
    }
    this.screenshotHelper = screenshotHelper
    this.initializeModel()
  }

  private async initializeModel() {
    try {
      // For Electron main process, use process.env directly
      const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OpenAI API key not found in environment variables')
      }
      
      this.modelManager = initializeModelManager({
        provider: 'openai',
        config: {
          apiKey,
          model: 'gpt-4o',
          temperature: 0.1,
          maxTokens: 4000,
          timeout: 300000
        }
      })
      console.log('Local model manager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize model manager:', error)
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Local mode has unlimited credits

    try {
      await this.waitForInitialization(mainWindow)
      const credits = await mainWindow.webContents.executeJavaScript(
        "window.__CREDITS__"
      )

      if (
        typeof credits !== "number" ||
        credits === undefined ||
        credits === null
      ) {
        console.warn("Credits not properly initialized, using default")
        return 999
      }

      return credits
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999
    }
  }

  private async getLanguage(): Promise<string> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return "python"

    try {
      await this.waitForInitialization(mainWindow)
      const language = await mainWindow.webContents.executeJavaScript(
        "window.__LANGUAGE__"
      )

      if (
        typeof language !== "string" ||
        language === undefined ||
        language === null
      ) {
        console.warn("Language not properly initialized")
        return "python"
      }

      return language
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    if (!this.modelManager) {
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        "Model manager not initialized. Please check your OpenAI API key."
      )
      return
    }

    // Check if we have any credits left (in local mode, always has credits)
    const credits = await this.getCredits()
    if (credits < 1) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.OUT_OF_CREDITS)
      return
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)
      
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        const screenshots = await Promise.all(
          screenshotQueue.map(async (path) => ({
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: fs.readFileSync(path).toString("base64")
          }))
        )

        const result = await this.processScreenshotsHelper(screenshots, signal)

        if (!result.success) {
          console.log("Processing failed:", result.error)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            result.error
          )
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error")
          this.deps.setView("queue")
          return
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing")
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error.message || "Processing error. Please try again."
        )
        console.error("Processing error:", error)
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue = this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)
      
      if (extraScreenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }
      
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        const screenshots = await Promise.all(
          extraScreenshotQueue.map(async (path) => ({
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: fs.readFileSync(path).toString("base64")
          }))
        )

        const result = await this.processExtraScreenshotsHelper(screenshots, signal)

        if (result.success) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
          this.deps.setHasDebugged(true)
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
          error.message || "Debug processing error. Please try again."
        )
        console.error("Debug processing error:", error)
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    if (!this.modelManager) {
      return { success: false, error: "Model manager not initialized" }
    }

    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data)
      const mainWindow = this.deps.getMainWindow()
      const language = await this.getLanguage()

      // Check if aborted
      if (signal.aborted) {
        return { success: false, error: "Processing was canceled by the user." }
      }

      // First step - extract problem info
      console.log("Extracting problem information...")
      const problemResult = await this.modelManager.extractProblem(imageDataList, language)

      if (!problemResult.success) {
        throw new Error(problemResult.error || "Failed to extract problem information")
      }

      console.log("Problem extracted successfully:", problemResult.data)
      
      // Store problem info in AppState
      this.deps.setProblemInfo(problemResult.data)

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemResult.data
        )

        // Check if aborted before generating solutions
        if (signal.aborted) {
          return { success: false, error: "Processing was canceled by the user." }
        }

        // Generate solutions after successful extraction
        console.log("Generating solutions...")
        const solutionsResult = await this.modelManager.generateSolutions(problemResult.data!)
        
        if (solutionsResult.success) {
          console.log("Solutions generated successfully")
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue()
          return { success: true, data: solutionsResult.data }
        } else {
          throw new Error(solutionsResult.error || "Failed to generate solutions")
        }
      }

      return { success: false, error: "Main window not available" }
    } catch (error: any) {
      console.error("Local processing error:", error)
      return { success: false, error: error.message || "Processing failed" }
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    if (!this.modelManager) {
      return { success: false, error: "Model manager not initialized" }
    }

    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data)
      const problemInfo = this.deps.getProblemInfo()

      if (!problemInfo) {
        throw new Error("No problem info available")
      }

      // Check if aborted
      if (signal.aborted) {
        return { success: false, error: "Processing was canceled by the user." }
      }

      console.log("Debugging code...")
      const debugResult = await this.modelManager.debugCode(problemInfo, imageDataList)

      if (debugResult.success) {
        console.log("Debug completed successfully")
        return { success: true, data: debugResult.data }
      } else {
        throw new Error(debugResult.error || "Failed to debug code")
      }
    } catch (error: any) {
      console.error("Local debug processing error:", error)
      return { success: false, error: error.message || "Debug processing failed" }
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    // Reset hasDebugged flag
    this.deps.setHasDebugged(false)

    // Clear any pending state
    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      // Send a clear message that processing was cancelled
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
} 
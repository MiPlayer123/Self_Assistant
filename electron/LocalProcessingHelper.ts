// LocalProcessingHelper.ts - Local AI processing using OpenAI API
import fs from "node:fs"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import { BrowserWindow } from "electron"
import { ModelManager, initializeModelManager, getApiKey } from "../src/models/ModelManager"

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
      const apiKey = await getApiKey('openai')
      
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

        const result = await this.modelManager.extractProblem(screenshots.map(s => s.data), await this.getLanguage());

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

        const result = await this.modelManager.debugCode(this.deps.getProblemInfo()!, screenshots.map(s => s.data))

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
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.modelManager) {
      return { success: false, error: "Model manager not initialized." };
    }
    const language = await this.getLanguage();
    const problemInfoResult = await this.modelManager.extractProblem(screenshots.map(s => s.data), language);

    if (!problemInfoResult.success || !problemInfoResult.data) {
      return { success: false, error: problemInfoResult.error || "Failed to extract problem." };
    }

    this.deps.setProblemInfo(problemInfoResult.data);
    const generatedSolutionsResult = await this.modelManager.generateSolutions(problemInfoResult.data);

    if (!generatedSolutionsResult.success) {
      return { success: false, error: generatedSolutionsResult.error || "Failed to generate solutions." };
    }

    return { success: true, data: generatedSolutionsResult.data };
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.modelManager) {
      return { success: false, error: "Model manager not initialized." };
    }
    const problemInfo = this.deps.getProblemInfo();
    if (!problemInfo) {
      return { success: false, error: "No current problem info found for debugging." };
    }

    const debugInfoResult = await this.modelManager.debugCode(problemInfo, screenshots.map(s => s.data));

    if (!debugInfoResult.success) {
      return { success: false, error: debugInfoResult.error || "Failed to debug code." };
    }

    return { success: true, data: debugInfoResult.data };
  }

  public cancelOngoingRequests(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      console.log("Canceled ongoing processing request.");
    }
    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      console.log("Canceled ongoing extra processing request.");
    }
  }
} 
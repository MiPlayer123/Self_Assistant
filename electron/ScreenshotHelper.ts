// ScreenshotHelper.ts

import path from "node:path"
import fs from "node:fs"
import { app } from "electron"
import { v4 as uuidv4 } from "uuid"
import { execFile } from "child_process"
import { promisify } from "util"
import { PNG } from "pngjs"

const execFileAsync = promisify(execFile)

export class ScreenshotHelper {
  private screenshotQueue: string[] = []
  private extraScreenshotQueue: string[] = []
  private readonly MAX_SCREENSHOTS = 2

  private readonly screenshotDir: string
  private readonly extraScreenshotDir: string

  private view: "queue" | "solutions" | "debug" = "queue"

  constructor(view: "queue" | "solutions" | "debug" = "queue") {
    this.view = view

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    )

    // Create directories if they don't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir)
    }
    if (!fs.existsSync(this.extraScreenshotDir)) {
      fs.mkdirSync(this.extraScreenshotDir)
    }
  }

  public getView(): "queue" | "solutions" | "debug" {
    return this.view
  }

  public setView(view: "queue" | "solutions" | "debug"): void {
    console.log("Setting view in ScreenshotHelper:", view)
    console.log(
      "Current queues - Main:",
      this.screenshotQueue,
      "Extra:",
      this.extraScreenshotQueue
    )
    this.view = view
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue
  }

  public getExtraScreenshotQueue(): string[] {
    console.log("Getting extra screenshot queue:", this.extraScreenshotQueue)
    return this.extraScreenshotQueue
  }

  public clearQueues(): void {
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot at ${screenshotPath}:`, err)
      })
    })
    this.screenshotQueue = []

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err
          )
      })
    })
    this.extraScreenshotQueue = []
  }

  private async captureScreenshotMac(): Promise<Buffer> {
    const tmpPath = path.join(app.getPath("temp"), `${uuidv4()}.png`)
    await execFileAsync("screencapture", ["-x", tmpPath])
    const buffer = await fs.promises.readFile(tmpPath)
    await fs.promises.unlink(tmpPath)
    return buffer
  }

  private async captureScreenshotWindows(): Promise<Buffer> {
    // Using PowerShell's native screenshot capability
    const tmpPath = path.join(app.getPath("temp"), `${uuidv4()}.png`)
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size)
      $bitmap.Save('${tmpPath.replace(/\\/g, "\\\\")}')
      $graphics.Dispose()
      $bitmap.Dispose()
    `
    await execFileAsync("powershell", ["-command", script])
    const buffer = await fs.promises.readFile(tmpPath)
    await fs.promises.unlink(tmpPath)
    return buffer
  }

  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string> {
    console.log("Taking screenshot in view:", this.view)
    hideMainWindow()
    await new Promise((resolve) => setTimeout(resolve, 100))

    let screenshotPath = ""
    try {
      // Get screenshot buffer using native methods
      const screenshotBuffer =
        process.platform === "darwin"
          ? await this.captureScreenshotMac()
          : await this.captureScreenshotWindows()

      // Save and manage the screenshot based on current view
      if (this.view === "queue") {
        screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`)
        await fs.promises.writeFile(screenshotPath, screenshotBuffer)
        console.log("Adding screenshot to main queue:", screenshotPath)
        this.screenshotQueue.push(screenshotPath)
        if (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.screenshotQueue.shift()
          if (removedPath) {
            try {
              await fs.promises.unlink(removedPath)
              console.log(
                "Removed old screenshot from main queue:",
                removedPath
              )
            } catch (error) {
              console.error("Error removing old screenshot:", error)
            }
          }
        }
      } else {
        // In solutions view, only add to extra queue
        screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`)
        await fs.promises.writeFile(screenshotPath, screenshotBuffer)
        console.log("Adding screenshot to extra queue:", screenshotPath)
        this.extraScreenshotQueue.push(screenshotPath)
        if (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.extraScreenshotQueue.shift()
          if (removedPath) {
            try {
              await fs.promises.unlink(removedPath)
              console.log(
                "Removed old screenshot from extra queue:",
                removedPath
              )
            } catch (error) {
              console.error("Error removing old screenshot:", error)
            }
          }
        }
      }
    } catch (error) {
      console.error("Screenshot error:", error)
      throw error
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 50))
      showMainWindow()
    }

    return screenshotPath
  }

  public async getImagePreview(filepath: string): Promise<string> {
    try {
      const data = await fs.promises.readFile(filepath)
      return `data:image/png;base64,${data.toString("base64")}`
    } catch (error) {
      console.error("Error reading image:", error)
      throw error
    }
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(path)
      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (p) => p !== path
        )
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (p) => p !== path
        )
      }
      return { success: true }
    } catch (error) {
      console.error("Error deleting screenshot:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  /**
   * Samples the color of a region by capturing it and analyzing the average color.
   * This is the most reliable method.
   * @param x - Center X coordinate
   * @param y - Center Y coordinate
   * @param size - The width/height of the square area to sample.
   * @returns An object with the lightness and average RGB values.
   */
  public async samplePixelsAtPosition(
    x: number,
    y: number,
    size: number = 10 // Sample a 10x10 area by default for stability
  ): Promise<{ isLight: boolean; r: number; g: number; b: number }> {
    try {
      const halfSize = Math.floor(size / 2)
      const captureX = Math.max(0, x - halfSize)
      const captureY = Math.max(0, y - halfSize)

      const tmpPath = path.join(app.getPath("temp"), `region-sample-${uuidv4()}.png`)

      if (process.platform === "darwin") {
        await execFileAsync("screencapture", [
          "-x",
          "-R",
          `${captureX},${captureY},${size},${size}`,
          tmpPath
        ])
      } else {
        // Windows implementation
        const script = `
          Add-Type -AssemblyName System.Windows.Forms
          Add-Type -AssemblyName System.Drawing
          $bitmap = New-Object System.Drawing.Bitmap ${size}, ${size}
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen(${captureX}, ${captureY}, 0, 0, $bitmap.Size)
          $bitmap.Save('${tmpPath.replace(/\\/g, "\\\\")}')
          $graphics.Dispose()
          $bitmap.Dispose()
        `
        await execFileAsync("powershell", ["-command", script])
      }

      const buffer = await fs.promises.readFile(tmpPath)
      await fs.promises.unlink(tmpPath)

      return this.getAverageColorFromPng(buffer)
    } catch (error) {
      console.error("Error sampling pixel color region:", error)
      return { isLight: false, r: 0, g: 0, b: 0 } // Default to dark on error
    }
  }

  /**
   * Uses pngjs to parse a PNG buffer and calculate the average color.
   * @param buffer - The PNG image data.
   * @returns A promise resolving to the color analysis.
   */
  private getAverageColorFromPng(
    buffer: Buffer
  ): Promise<{ isLight: boolean; r: number; g: number; b: number }> {
    return new Promise((resolve, reject) => {
      new PNG().parse(buffer, (err, data) => {
        if (err) {
          console.error("PNG parsing error:", err)
          return reject(err)
        }

        let totalR = 0,
          totalG = 0,
          totalB = 0
        const pixelCount = data.width * data.height

        for (let y = 0; y < data.height; y++) {
          for (let x = 0; x < data.width; x++) {
            const idx = (data.width * y + x) << 2
            totalR += data.data[idx]
            totalG += data.data[idx + 1]
            totalB += data.data[idx + 2]
          }
        }

        const avgR = totalR / pixelCount
        const avgG = totalG / pixelCount
        const avgB = totalB / pixelCount

        const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255
        resolve({ isLight: luminance > 0.5, r: avgR, g: avgG, b: avgB })
      })
    })
  }

  public clearExtraScreenshotQueue(): void {
    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err
          )
      })
    })
    this.extraScreenshotQueue = []
  }
}

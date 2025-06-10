import { globalShortcut, app } from "electron"
import { IShortcutsHelperDeps } from "./main"

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps
  private shortcutsRegistered: boolean = false

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps
  }

  private getModifierKey(): string {
    // Use Ctrl on Mac instead of Cmd, Alt on Windows/Linux
    return process.platform === "darwin" ? "Ctrl" : "Alt"
  }

  private getWindowMovementModifier(): string {
    // Use Cmd on Mac for window movement, Alt on Windows/Linux
    return process.platform === "darwin" ? "Cmd" : "Alt"
  }

  private isWindowHidden(): boolean {
    return !this.deps.isVisible()
  }

  private executeIfWindowVisible(callback: () => void | Promise<void>): void {
    if (this.isWindowHidden()) {
      console.log("Shortcut ignored - window is hidden")
      return
    }
    callback()
  }

  public registerGlobalShortcuts(): void {
    if (this.shortcutsRegistered) {
      this.unregisterShortcuts()
    }

    const modifier = this.getModifierKey()
    const windowMovementModifier = this.getWindowMovementModifier()

    // Screenshot shortcut
    globalShortcut.register(`${modifier}+H`, async () => {
      this.executeIfWindowVisible(async () => {
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow) {
          console.log("Taking screenshot...")
          try {
            const screenshotPath = await this.deps.takeScreenshot()
            const preview = await this.deps.getImagePreview(screenshotPath)
            mainWindow.webContents.send("screenshot-taken", {
              path: screenshotPath,
              preview
            })
          } catch (error) {
            console.error("Error capturing screenshot:", error)
          }
        }
      })
    })

    // Process screenshots shortcut
    globalShortcut.register(`${modifier}+Enter`, async () => {
      this.executeIfWindowVisible(async () => {
        await this.deps.processingHelper?.processScreenshots()
      })
    })

    // Reset shortcut
    globalShortcut.register(`${modifier}+R`, () => {
      this.executeIfWindowVisible(() => {
        console.log(`${modifier} + R pressed. Canceling requests and resetting queues...`)

        // Cancel ongoing API requests
        this.deps.processingHelper?.cancelOngoingRequests()

        // Clear both screenshot queues
        this.deps.clearQueues()

        console.log("Cleared queues.")

        // Update the view state to 'queue'
        this.deps.setView("queue")

        // Notify renderer process to switch view to 'queue'
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view")
          mainWindow.webContents.send("reset")
        }
      })
    })

    // Window movement shortcuts
    globalShortcut.register(`${windowMovementModifier}+Left`, () => {
      this.executeIfWindowVisible(() => {
        console.log(`${windowMovementModifier} + Left pressed. Moving window left.`)
        this.deps.moveWindowLeft()
      })
    })

    globalShortcut.register(`${windowMovementModifier}+Right`, () => {
      this.executeIfWindowVisible(() => {
        console.log(`${windowMovementModifier} + Right pressed. Moving window right.`)
        this.deps.moveWindowRight()
      })
    })

    globalShortcut.register(`${windowMovementModifier}+Down`, () => {
      this.executeIfWindowVisible(() => {
        console.log(`${windowMovementModifier} + Down pressed. Moving window down.`)
        this.deps.moveWindowDown()
      })
    })

    globalShortcut.register(`${windowMovementModifier}+Up`, () => {
      this.executeIfWindowVisible(() => {
        console.log(`${windowMovementModifier} + Up pressed. Moving window up.`)
        this.deps.moveWindowUp()
      })
    })

    // Toggle window visibility shortcut (this one should work even when hidden)
    globalShortcut.register(`${modifier}+B`, () => {
      console.log(`${modifier} + B pressed. Toggling window visibility.`)
      this.deps.toggleMainWindow()
    })

    this.shortcutsRegistered = true

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      this.unregisterShortcuts()
    })
  }

  public unregisterShortcuts(): void {
    if (this.shortcutsRegistered) {
      globalShortcut.unregisterAll()
      this.shortcutsRegistered = false
      console.log("All shortcuts unregistered")
    }
  }
}

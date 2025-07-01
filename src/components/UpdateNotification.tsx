import React, { useEffect, useState } from "react"
import { Dialog, DialogContent } from "./ui/dialog"
import { Button } from "./ui/button"
import { useToast } from "../contexts/toast"

export const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    console.log("UpdateNotification: Setting up event listeners")

    if (!window.electronAPI) {
      console.log("UpdateNotification: electronAPI not available")
      return
    }

    const unsubscribeAvailable = window.electronAPI.onUpdateAvailable(
      (info) => {
        console.log("UpdateNotification: Update available received", info)
        setUpdateAvailable(true)
        setIsDownloading(true)
        showToast(
          "Update Available",
          "A new version is downloading in the background.",
          "neutral"
        )
      }
    )

    const unsubscribeDownloaded = window.electronAPI.onUpdateDownloaded(
      (info) => {
        console.log("UpdateNotification: Update downloaded received", info)
        setUpdateDownloaded(true)
        setIsDownloading(false)
        setDownloadProgress(100)
      }
    )

    const unsubscribeProgress = window.electronAPI.onDownloadProgress(
      (progress: { percent?: number }) => {
        console.log("UpdateNotification: Download progress", progress)
        if (typeof progress?.percent === "number") {
          setDownloadProgress(progress.percent)
        }
      }
    )

    return () => {
      console.log("UpdateNotification: Cleaning up event listeners")
      unsubscribeAvailable()
      unsubscribeDownloaded()
      unsubscribeProgress()
    }
  }, [])

  const handleStartUpdate = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      await window.electronAPI?.startUpdate()
    } catch (err) {
      setIsDownloading(false)
      showToast("Error", "Failed to start update", "error")
    }
  }

  const handleInstallUpdate = () => {
    console.log("UpdateNotification: Installing update")
    if (window.electronAPI) {
    window.electronAPI.installUpdate()
    }
  }

  console.log("UpdateNotification: Render state", {
    updateAvailable,
    updateDownloaded,
    isDownloading,
    isDismissed
  })
  if ((!updateDownloaded) || isDismissed) return null

  return (
    <Dialog open={true}>
      <DialogContent
        className="bg-black/90 text-white border-white/20"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">
            {"Update Ready to Install"}
          </h2>
          <p className="text-sm text-white/70 mb-6">
            {"The update has been downloaded and will be installed when you restart the app."}
          </p>
          {isDownloading && (
            <div className="w-full h-2 bg-white/20 rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${downloadProgress ?? 10}%` }}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {updateDownloaded ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsDismissed(true)}
                  className="border-white/20 hover:bg-white/10"
                >
                  Update Later
                </Button>
                <Button
                  variant="outline"
                  onClick={handleInstallUpdate}
                  className="border-white/20 hover:bg-white/10"
                >
                  Restart and Install
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsDismissed(true)}
                  className="border-white/20 hover:bg-white/10"
                >
                  Update Later
                </Button>
                {!isDownloading && (
                  <Button
                    variant="outline"
                    onClick={handleStartUpdate}
                    className="border-white/20 hover:bg-white/10"
                  >
                    Download Update
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

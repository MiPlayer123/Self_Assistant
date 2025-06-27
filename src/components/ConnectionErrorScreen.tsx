import React, { useState } from 'react'

export function ConnectionErrorScreen() {
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    // Simple retry - reload the page
    window.location.reload()
  }

  const handleWorkOffline = () => {
    // Set offline mode flag and reload
    localStorage.setItem('wagoo_force_offline', 'true')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-md px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          No Internet Connection
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          Wagoo requires an internet connection for first-time setup and subscription verification.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRetrying ? "Checking..." : "Try Again"}
          </button>
          
          <p className="text-gray-500 text-xs">
            If you were previously logged in with an active subscription, you can work offline once connection is restored.
          </p>
        </div>
      </div>
    </div>
  )
} 
import React, { useState } from 'react'
import { useOfflineMode } from '../hooks/useOfflineMode'

interface ConnectionErrorScreenProps {
  onContinueOffline?: () => void
}

export function ConnectionErrorScreen({ onContinueOffline }: ConnectionErrorScreenProps = {}) {
  const [isRetrying, setIsRetrying] = useState(false)
  const { canUseOffline, reason, subscriptionStatus } = useOfflineMode()

  const handleRetry = async () => {
    setIsRetrying(true)
    // Simple retry - reload the page
    window.location.reload()
  }

  const handleContinueOffline = () => {
    if (onContinueOffline) {
      onContinueOffline()
    } else {
      // Set offline mode flag and reload to trigger app routing
      localStorage.setItem('wagoo_force_offline', 'true')
      window.location.reload()
    }
  }

  const handleUpgrade = async () => {
    // Open subscription portal when user wants to upgrade
    try {
      if (window.electronAPI?.openSubscriptionPortal) {
        await window.electronAPI.openSubscriptionPortal({ id: 'temp', email: 'temp' })
      } else {
        // Fallback for web version
        window.open('https://wagoo.vercel.app', '_blank')
      }
    } catch (error) {
      console.log('Electron method failed, using fallback...')
      window.open('https://wagoo.vercel.app', '_blank')
    }
  }

  const getTitle = () => {
    if (canUseOffline) {
      return "You're Offline"
    }
    return "No Internet Connection"
  }

  const getMessage = () => {
    if (canUseOffline) {
      return "You can continue using Wagoo with your local models while offline."
    }
    
    if (subscriptionStatus?.tier === 'free') {
      return "Go online to use Wagoo, or upgrade to Pro for offline access with local models."
    }
    
    if (subscriptionStatus && subscriptionStatus.status !== 'active') {
      return "Your subscription has expired. Go online to renew and regain offline access."
    }
    
    return "Wagoo requires an internet connection for first-time setup and subscription verification."
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-md px-6 text-center">
        {/* Status icon */}
        <div className="mb-6 flex justify-center">
          {canUseOffline ? (
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-blue-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-red-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
              </svg>
            </div>
          )}
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">
          {getTitle()}
        </h2>
        
        <p className="text-gray-400 text-sm mb-2">
          {getMessage()}
        </p>

        {/* Additional context */}
        <p className="text-gray-500 text-xs mb-8">
          {reason}
        </p>
        
        <div className="space-y-3">
          {/* Primary action button */}
          {canUseOffline ? (
            <button
              onClick={handleContinueOffline}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              Continue Offline
            </button>
          ) : subscriptionStatus?.tier === 'free' ? (
            <button
              onClick={handleUpgrade}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-colors"
            >
              Upgrade for Offline Access
            </button>
          ) : (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetrying ? "Checking..." : "Try Again"}
            </button>
          )}

          {/* Secondary action */}
          {canUseOffline || subscriptionStatus?.tier === 'free' ? (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full px-4 py-3 border border-white/20 text-white rounded-xl font-medium hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetrying ? "Checking..." : "Try Again"}
            </button>
          ) : null}
          
          {/* Show subscription info if available */}
          {subscriptionStatus && (
            <div className="mt-4 p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-gray-400">
                Current Plan: <span className="text-white font-medium capitalize">{subscriptionStatus.tier}</span>
                {subscriptionStatus.status !== 'active' && (
                  <span className="text-red-400 ml-2">({subscriptionStatus.status})</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
import React, { useState, useEffect } from 'react'
import { useOfflineMode } from '../hooks/useOfflineMode'

interface OfflineNotificationProps {
  onDismiss?: () => void
  autoHideDelay?: number // in milliseconds, default 4000 (4 seconds)
}

export function OfflineNotification({ 
  onDismiss, 
  autoHideDelay = 4000 
}: OfflineNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)
  const [hasBeenShown, setHasBeenShown] = useState(false)
  const { isOnline, canUseOffline, subscriptionStatus } = useOfflineMode()

  // Show notification when user goes offline (if they have subscription) and only once
  useEffect(() => {
    if (!isOnline && canUseOffline && subscriptionStatus && !hasBeenShown) {
      setIsVisible(true)
      setIsAnimatingOut(false)
      setHasBeenShown(true)
    } else if (isOnline) {
      // Reset when coming back online
      setHasBeenShown(false)
      if (isVisible) {
        handleHide()
      }
    }
  }, [isOnline, canUseOffline, subscriptionStatus, hasBeenShown])

  // Auto-hide timer
  useEffect(() => {
    if (isVisible && !isAnimatingOut) {
      const timer = setTimeout(() => {
        handleHide()
      }, autoHideDelay)

      return () => clearTimeout(timer)
    }
  }, [isVisible, isAnimatingOut, autoHideDelay])

  const handleHide = () => {
    if (isVisible && !isAnimatingOut) {
      setIsAnimatingOut(true)
      setTimeout(() => {
        setIsVisible(false)
        setIsAnimatingOut(false)
        onDismiss?.()
      }, 300) // Animation duration
    }
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleHide()
  }

  if (!isVisible) {
    return null
  }

  const getNotificationMessage = () => {
    if (subscriptionStatus?.tier === 'enterprise') {
      return "You're offline but all features remain available with your Enterprise plan."
    } else if (subscriptionStatus?.tier === 'pro') {
      return "You're offline but can continue using local models with your Pro plan."
    }
    return "You're offline but can continue using local models."
  }

  const getIcon = () => (
    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
      <svg 
        className="w-4 h-4 text-blue-400" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M13 10V3L4 14h7v7l9-11h-7z" 
        />
      </svg>
    </div>
  )

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <div 
        className={`
          max-w-sm bg-black/90 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl p-4 pointer-events-auto
          transform transition-all duration-300 ease-in-out
          ${isAnimatingOut 
            ? 'translate-x-full opacity-0 scale-95' 
            : 'translate-x-0 opacity-100 scale-100'
          }
        `}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          {getIcon()}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-medium text-white mb-1">
                  Offline Mode Active
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {getNotificationMessage()}
                </p>
              </div>
              
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1 -m-1 cursor-pointer"
                aria-label="Dismiss notification"
                type="button"
              >
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </button>
            </div>
            
            {/* Subscription tier badge */}
            {subscriptionStatus && (
              <div className="mt-2 inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                <span className="text-xs text-blue-300 font-medium capitalize">
                  {subscriptionStatus.tier} Plan
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Progress bar for auto-hide */}
        <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-400 rounded-full ease-linear"
            style={{ 
              width: isVisible && !isAnimatingOut ? '0%' : '100%',
              transition: isVisible && !isAnimatingOut ? `width ${autoHideDelay}ms linear` : 'width 0ms'
            }}
          />
        </div>
      </div>
    </div>
  )
}

// Hook for easy integration with components
export function useOfflineNotification() {
  const [showNotification, setShowNotification] = useState(false)
  const { isOnline, canUseOffline } = useOfflineMode()

  useEffect(() => {
    // Show notification when going offline with valid subscription
    if (!isOnline && canUseOffline) {
      setShowNotification(true)
    }
  }, [isOnline, canUseOffline])

  const hideNotification = () => {
    setShowNotification(false)
  }

  return {
    showNotification,
    hideNotification,
    NotificationComponent: showNotification ? (
      <OfflineNotification onDismiss={hideNotification} />
    ) : null
  }
} 
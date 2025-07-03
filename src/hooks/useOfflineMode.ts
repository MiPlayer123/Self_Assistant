import { useState, useEffect } from 'react'
import { getCachedSubscription, isOfflineModeForced } from '../utils/offlineStorage'
import type { Subscription } from '../types/database'

interface OfflineMode {
  isOnline: boolean
  canUseOffline: boolean
  subscriptionStatus: Subscription | null
  reason: string
  offlineCapabilities: {
    localModels: boolean
    basicChat: boolean
    fullFeatures: boolean
  }
  refresh: () => void
}

type OfflineAccessReason = 
  | 'online' 
  | 'subscribed_offline' 
  | 'free_user' 
  | 'expired_subscription' 
  | 'no_cached_subscription' 
  | 'forced_offline'

export function useOfflineMode(): OfflineMode {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // Check if offline mode is forced for testing
    if (isOfflineModeForced()) {
      return false
    }
    return navigator.onLine
  })

  const [refreshCounter, setRefreshCounter] = useState(0)

  // Function to force a refresh of the offline mode state
  const refresh = () => {
    console.log('Forcing offline mode refresh...')
    setRefreshCounter(prev => prev + 1)
  }

  // Monitor network status changes
  useEffect(() => {
    const handleOnline = () => {
      if (!isOfflineModeForced()) {
        setIsOnline(true)
      }
    }
    
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Determine offline access permissions
  const getOfflinePermissions = (): { 
    canUse: boolean; 
    reason: OfflineAccessReason; 
    subscription: Subscription | null 
  } => {
    // If online, always allow access
    if (isOnline) {
      return { canUse: true, reason: 'online', subscription: null }
    }

    // Check for forced offline mode (testing)
    if (isOfflineModeForced()) {
      const cachedSub = getCachedSubscription()
      return { 
        canUse: !!cachedSub && cachedSub.tier !== 'free', 
        reason: 'forced_offline', 
        subscription: cachedSub 
      }
    }

    // Check cached subscription for offline access
    const cachedSubscription = getCachedSubscription()
    
    if (!cachedSubscription) {
      return { canUse: false, reason: 'no_cached_subscription', subscription: null }
    }

    // Check subscription tier and status
    if (cachedSubscription.tier === 'free') {
      return { canUse: false, reason: 'free_user', subscription: cachedSubscription }
    }

    // Allow offline access for valid paid statuses
    const validStatuses = ['active', 'cancelling']; // Add more statuses if needed
    const status = cachedSubscription.status || '';
    if (!validStatuses.includes(status)) {
      return { canUse: false, reason: 'expired_subscription', subscription: cachedSubscription }
    }

    // Subscribed user with valid cache - allow offline access
    return { canUse: true, reason: 'subscribed_offline', subscription: cachedSubscription }
  }

  // Re-evaluate permissions when refresh counter changes
  const { canUse: canUseOffline, reason: accessReason, subscription } = getOfflinePermissions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedPermissions = { canUseOffline, accessReason, subscription }
  // Force recalculation when refreshCounter changes
  const _ = refreshCounter // This ensures the hook re-runs when refresh is called

  // Determine available capabilities based on subscription and online status
  const getOfflineCapabilities = () => {
    if (isOnline) {
      return {
        localModels: true,
        basicChat: true,
        fullFeatures: true
      }
    }

    if (!canUseOffline) {
      return {
        localModels: false,
        basicChat: false,
        fullFeatures: false
      }
    }

    // Offline subscribed user capabilities
    return {
      localModels: true,
      basicChat: true,
      fullFeatures: subscription?.tier === 'enterprise' // Enterprise gets full offline features
    }
  }

  // Generate human-readable reason message
  const getReasonMessage = (reason: OfflineAccessReason): string => {
    switch (reason) {
      case 'online':
        return 'Connected to internet'
      case 'subscribed_offline':
        return 'Offline access available with subscription'
      case 'free_user':
        return 'Upgrade to Pro or Enterprise for offline access'
      case 'expired_subscription':
        return 'Subscription expired - go online to renew'
      case 'no_cached_subscription':
        return 'No cached subscription - go online for first-time setup'
      case 'forced_offline':
        return 'Forced offline mode for testing'
      default:
        return 'Unable to determine access status'
    }
  }

  return {
    isOnline,
    canUseOffline,
    subscriptionStatus: subscription,
    reason: getReasonMessage(accessReason),
    offlineCapabilities: getOfflineCapabilities(),
    refresh
  }
} 
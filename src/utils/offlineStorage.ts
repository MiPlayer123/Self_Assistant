import type { Subscription } from '../types/database'

interface CachedSubscription {
  subscription: Subscription
  cachedAt: number
  expiresAt: number
}

// Cache duration: 30 days in milliseconds
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000

// Local storage keys
const SUBSCRIPTION_CACHE_KEY = 'wagoo_subscription_cache'
const OFFLINE_MODE_KEY = 'wagoo_force_offline'

/**
 * Cache subscription data in localStorage with expiry timestamp
 */
export function cacheSubscription(subscription: Subscription): void {
  try {
    const cachedAt = Date.now()
    const expiresAt = cachedAt + CACHE_DURATION
    
    const cachedData: CachedSubscription = {
      subscription,
      cachedAt,
      expiresAt
    }
    
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(cachedData))
    console.log('Subscription cached successfully', { tier: subscription.tier, expiresAt: new Date(expiresAt) })
  } catch (error) {
    console.error('Failed to cache subscription:', error)
  }
}

/**
 * Retrieve cached subscription data if valid
 */
export function getCachedSubscription(): Subscription | null {
  try {
    const cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY)
    if (!cached) {
      return null
    }
    
    const cachedData: CachedSubscription = JSON.parse(cached)
    
    // Check if cache is expired
    if (Date.now() > cachedData.expiresAt) {
      console.log('Subscription cache expired, clearing')
      clearSubscriptionCache()
      return null
    }
    
    // Validate subscription structure
    if (!cachedData.subscription || !cachedData.subscription.tier) {
      console.warn('Invalid cached subscription structure')
      clearSubscriptionCache()
      return null
    }
    
    return cachedData.subscription
  } catch (error) {
    console.error('Failed to retrieve cached subscription:', error)
    clearSubscriptionCache()
    return null
  }
}

/**
 * Check if subscription cache is valid (exists and not expired)
 */
export function isSubscriptionCacheValid(): boolean {
  try {
    const cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY)
    if (!cached) {
      return false
    }
    
    const cachedData: CachedSubscription = JSON.parse(cached)
    return Date.now() <= cachedData.expiresAt && !!cachedData.subscription?.tier
  } catch (error) {
    console.error('Error checking subscription cache validity:', error)
    return false
  }
}

/**
 * Clear cached subscription data
 */
export function clearSubscriptionCache(): void {
  try {
    localStorage.removeItem(SUBSCRIPTION_CACHE_KEY)
    console.log('Subscription cache cleared')
  } catch (error) {
    console.error('Failed to clear subscription cache:', error)
  }
}

/**
 * Get cache metadata (when cached, when expires)
 */
export function getSubscriptionCacheInfo(): { cachedAt: Date | null; expiresAt: Date | null; isValid: boolean } {
  try {
    const cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY)
    if (!cached) {
      return { cachedAt: null, expiresAt: null, isValid: false }
    }
    
    const cachedData: CachedSubscription = JSON.parse(cached)
    const isValid = Date.now() <= cachedData.expiresAt
    
    return {
      cachedAt: new Date(cachedData.cachedAt),
      expiresAt: new Date(cachedData.expiresAt),
      isValid
    }
  } catch (error) {
    console.error('Error getting subscription cache info:', error)
    return { cachedAt: null, expiresAt: null, isValid: false }
  }
}

/**
 * Check if offline mode is forced (for testing)
 */
export function isOfflineModeForced(): boolean {
  return localStorage.getItem(OFFLINE_MODE_KEY) === 'true'
}

/**
 * Set forced offline mode (for testing)
 */
export function setOfflineModeForced(forced: boolean): void {
  if (forced) {
    localStorage.setItem(OFFLINE_MODE_KEY, 'true')
  } else {
    localStorage.removeItem(OFFLINE_MODE_KEY)
  }
} 
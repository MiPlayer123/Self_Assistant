import { useState, useCallback, useEffect } from 'react'
import { incrementUsage, checkDailyUsageLimit, getCurrentUsageStats } from '../lib/supabase'
import { useOfflineMode } from './useOfflineMode'
import { getCachedSubscription } from '../utils/offlineStorage'

type UsageType = 'chat_messages_count' | 'voice_transcriptions_count' | 'screen_context_requests'

interface UsageState {
  loading: boolean
  error: string | null
  usageStats?: {
    userTier: string
    date: string
    usage: Record<UsageType, number>
    limits: Record<UsageType, number>
    remaining: Record<UsageType, number>
  }
}

export const useUsageTracking = (userId?: string) => {
  const [state, setState] = useState<UsageState>({
    loading: false,
    error: null,
    usageStats: undefined
  })
  
  const { isOnline, canUseOffline, subscriptionStatus } = useOfflineMode()
  
  // Helper function to create offline usage stats for Pro/Enterprise users
  const createOfflineUsageStats = (tier: string) => {
    const today = new Date().toISOString().split('T')[0]
    
    if (tier === 'pro' || tier === 'enterprise') {
      return {
        userTier: tier,
        date: today,
        usage: {
          chat_messages_count: 0,
          voice_transcriptions_count: 0,
          screen_context_requests: 0
        },
        limits: {
          chat_messages_count: -1, // unlimited
          voice_transcriptions_count: -1,
          screen_context_requests: -1
        },
        remaining: {
          chat_messages_count: -1, // unlimited
          voice_transcriptions_count: -1,
          screen_context_requests: -1
        }
      }
    } else {
      // Free tier - show limits but no usage tracking when offline
      return {
        userTier: 'free',
        date: today,
        usage: {
          chat_messages_count: 0,
          voice_transcriptions_count: 0,
          screen_context_requests: 0
        },
        limits: {
          chat_messages_count: 5,
          voice_transcriptions_count: 10,
          screen_context_requests: -1 // unlimited screenshots for free users
        },
        remaining: {
          chat_messages_count: 5,
          voice_transcriptions_count: 10,
          screen_context_requests: -1 // unlimited screenshots for free users
        }
      }
    }
  }
  
  // Load usage stats when userId changes
  const loadUsageStats = useCallback(async () => {
    if (!userId) return
    
    // If offline and user can use offline features, use cached subscription data
    if (!isOnline && canUseOffline && subscriptionStatus) {
      const offlineStats = createOfflineUsageStats(subscriptionStatus.tier)
      setState(prev => ({ ...prev, usageStats: offlineStats, loading: false, error: null }))
      return
    }
    
    // If offline but no cached subscription, create basic free tier stats
    if (!isOnline && !canUseOffline) {
      const cachedSub = getCachedSubscription()
      const tier = cachedSub?.tier || 'free'
      const offlineStats = createOfflineUsageStats(tier)
      setState(prev => ({ ...prev, usageStats: offlineStats, loading: false, error: null }))
      return
    }
    
    // Online - fetch real usage stats
    if (isOnline) {
      try {
        const result = await getCurrentUsageStats(userId)
        if (result.success) {
          setState(prev => ({ ...prev, usageStats: result.data, loading: false, error: null }))
        }
      } catch (error) {
        console.error('Failed to load usage stats:', error)
        setState(prev => ({ ...prev, loading: false, error: 'Failed to load usage stats' }))
      }
    }
  }, [userId, isOnline, canUseOffline, subscriptionStatus])
  
  // Load stats when userId or offline mode changes
  useEffect(() => {
    loadUsageStats()
  }, [loadUsageStats])

  const trackUsage = useCallback(async (usageType: UsageType, incrementBy: number = 1) => {
    if (!userId) {
      console.warn('Cannot track usage: user not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // If offline and user has Pro/Enterprise, allow unlimited usage
    if (!isOnline && canUseOffline && subscriptionStatus) {
      if (subscriptionStatus.tier === 'pro' || subscriptionStatus.tier === 'enterprise') {
        console.log(`Offline ${subscriptionStatus.tier} user - unlimited usage allowed`)
        return { success: true, error: null }
      }
    }
    
    // If offline and user is free tier, deny usage
    if (!isOnline && !canUseOffline) {
      return { 
        success: false, 
        error: 'Offline access requires Pro or Enterprise subscription',
        code: 'OFFLINE_ACCESS_DENIED'
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const { error } = await incrementUsage(userId, usageType, incrementBy)
      
      if (error) {
        // Handle daily limit exceeded error specifically
        if (error && typeof error === 'object' && 'code' in error && error.code === 'DAILY_LIMIT_EXCEEDED') {
          setState(prev => ({ ...prev, loading: false, error: null }))
          return { 
            success: false, 
            error: 'Daily limit exceeded',
            code: 'DAILY_LIMIT_EXCEEDED',
            details: 'details' in error ? error.details : null
          }
        }
        throw error
      }

      // Reload usage stats after successful tracking
      await loadUsageStats()
      setState(prev => ({ ...prev, loading: false, error: null }))
      return { success: true, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to track usage'
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [userId, loadUsageStats, isOnline, canUseOffline, subscriptionStatus])

  const checkUsageLimit = useCallback(async (usageType: UsageType) => {
    if (!userId) {
      console.warn('Cannot check usage limit: user not authenticated')
      return { withinLimit: false, error: 'User not authenticated' }
    }

    // If offline and user has Pro/Enterprise, always within limit (unlimited)
    if (!isOnline && canUseOffline && subscriptionStatus) {
      if (subscriptionStatus.tier === 'pro' || subscriptionStatus.tier === 'enterprise') {
        return { 
          withinLimit: true, 
          error: null,
          currentCount: 0,
          maxLimit: -1,
          userTier: subscriptionStatus.tier,
          remaining: -1
        }
      }
    }
    
    // If offline and user is free tier, not within limit
    if (!isOnline && !canUseOffline) {
      return { 
        withinLimit: false, 
        error: 'Offline access requires Pro or Enterprise subscription',
        currentCount: 0,
        maxLimit: 0,
        userTier: 'free',
        remaining: 0
      }
    }

    setState({ loading: true, error: null })

    try {
      const { withinLimit, error } = await checkDailyUsageLimit(userId, usageType)
      
      if (error) {
        throw error
      }

      setState({ loading: false, error: null })
      return { withinLimit, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check usage limit'
      setState({ loading: false, error: errorMessage })
      return { withinLimit: false, error: errorMessage }
    }
  }, [userId, isOnline, canUseOffline, subscriptionStatus])

  // Convenience methods for specific usage types
  const trackChatMessage = useCallback(() => trackUsage('chat_messages_count'), [trackUsage])
  const trackVoiceTranscription = useCallback(() => trackUsage('voice_transcriptions_count'), [trackUsage])
  const trackScreenContext = useCallback(() => trackUsage('screen_context_requests'), [trackUsage])

  const checkChatMessageLimit = useCallback(() => checkUsageLimit('chat_messages_count'), [checkUsageLimit])
  const checkVoiceTranscriptionLimit = useCallback(() => checkUsageLimit('voice_transcriptions_count'), [checkUsageLimit])
  const checkScreenContextLimit = useCallback(() => checkUsageLimit('screen_context_requests'), [checkUsageLimit])

  return {
    ...state,
    trackUsage,
    checkUsageLimit,
    loadUsageStats,
    // Convenience methods
    trackChatMessage,
    trackVoiceTranscription,
    trackScreenContext,
    checkChatMessageLimit,
    checkVoiceTranscriptionLimit,
    checkScreenContextLimit
  }
} 
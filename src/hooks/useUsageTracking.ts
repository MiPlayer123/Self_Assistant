import { useState, useCallback } from 'react'
import { incrementUsage, checkDailyUsageLimit } from '../lib/supabase'

type UsageType = 'chat_messages_count' | 'voice_transcriptions_count' | 'screen_context_requests'

interface UsageState {
  loading: boolean
  error: string | null
}

export const useUsageTracking = (userId?: string) => {
  const [state, setState] = useState<UsageState>({
    loading: false,
    error: null
  })

  const trackUsage = useCallback(async (usageType: UsageType, incrementBy: number = 1) => {
    if (!userId) {
      console.warn('Cannot track usage: user not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    setState({ loading: true, error: null })

    try {
      const { error } = await incrementUsage(userId, usageType, incrementBy)
      
      if (error) {
        throw error
      }

      setState({ loading: false, error: null })
      return { success: true, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to track usage'
      setState({ loading: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }, [userId])

  const checkUsageLimit = useCallback(async (usageType: UsageType) => {
    if (!userId) {
      console.warn('Cannot check usage limit: user not authenticated')
      return { withinLimit: false, error: 'User not authenticated' }
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
  }, [userId])

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
    // Convenience methods
    trackChatMessage,
    trackVoiceTranscription,
    trackScreenContext,
    checkChatMessageLimit,
    checkVoiceTranscriptionLimit,
    checkScreenContextLimit
  }
} 
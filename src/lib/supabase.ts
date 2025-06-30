import { createClient } from "@supabase/supabase-js"
import type { Database } from '../types/database'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// Create and export the Supabase client with extended session configuration
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keep users logged in longer
    persistSession: true,
    detectSessionInUrl: true,
    // Automatically refresh tokens when they're about to expire
    autoRefreshToken: true,
    // Storage key for session data (optional customization)
    storageKey: 'wagoo-auth-token',
    // Flow type for OAuth flows
    flowType: 'pkce'
  }
})

// Helper functions for common operations
export const signInWithGoogle = async () => {
  console.log("Attempting Google OAuth sign-in...")
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    })
    
    if (error) {
      console.error("Google sign-in error:", error)
      throw error
    }
    
    console.log("Google OAuth initiated:", data)
    return { data, error: null }
  } catch (error) {
    console.error("Sign-in failed:", error)
    return { data: null, error }
  }
}

export const signOut = async () => {
  console.log("Signing out...")
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("Sign-out error:", error)
      throw error
    }
      return { error: null }
  } catch (error) {
    console.error("Sign-out failed:", error)
    return { error }
  }
}

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error("Get user error:", error)
      return { user: null, error }
    }
    return { user, error: null }
  } catch (error) {
    console.error("Get user failed:", error)
    return { user: null, error }
      }
}

export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error("Get profile error:", error)
      return { profile: null, error }
    }
    
    return { profile: data, error: null }
  } catch (error) {
    console.error("Get profile failed:", error)
    return { profile: null, error }
  }
}

export const getUserSubscription = async (userId: string) => {
  try {
    // Get subscription data from the profiles table since subscription info is stored there
    // Using type assertion to bypass outdated type definitions
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single() as any
    
    if (error) {
      console.error("Get subscription from profile error:", error)
      return { subscription: null, error }
    }
    
    // Transform profile data to subscription format
    const subscription = {
      id: `sub_${data.id}`,
      user_id: data.id,
      tier: data.subscription_tier || 'free',
      status: data.subscription_status || 'active',
      stripe_subscription_id: data.stripe_subscription_id,
      stripe_customer_id: data.stripe_customer_id,
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      created_at: data.created_at,
      updated_at: data.updated_at
    }
    
    return { subscription, error: null }
  } catch (error) {
    console.error("Get subscription failed:", error)
    return { subscription: null, error }
  }
}

export const createUserProfile = async (user: any) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        subscription_tier: 'free'
      })
      .select()
      .single()
    
    if (error) {
      console.error("Create profile error:", error)
      return { profile: null, error }
    }
    
    return { profile: data, error: null }
  } catch (error) {
    console.error("Create profile failed:", error)
    return { profile: null, error }
        }
}

export const createUserSubscription = async (userId: string, tier: 'free' | 'pro' | 'enterprise' = 'free') => {
  try {
    // Update the subscription info in the profiles table since that's where it's stored
    // Using type assertion to bypass outdated type definitions
    const { data, error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single() as any
    
    if (error) {
      console.error("Create subscription in profile error:", error)
      return { subscription: null, error }
    }
    
    // Transform profile data to subscription format
    const subscription = {
      id: `sub_${data.id}`,
      user_id: data.id,
      tier: data.subscription_tier || tier,
      status: data.subscription_status || 'active',
      stripe_subscription_id: data.stripe_subscription_id,
      stripe_customer_id: data.stripe_customer_id,
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      created_at: data.created_at,
      updated_at: data.updated_at
    }
    
    return { subscription, error: null }
  } catch (error) {
    console.error("Create subscription failed:", error)
    return { subscription: null, error }
  }
}

export const incrementUsage = async (userId: string, usageType: 'chat_messages_count' | 'voice_transcriptions_count' | 'screen_context_requests', incrementBy: number = 1) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // First, ensure a record exists for today
    const { error: upsertError } = await supabase
      .from('usage_tracking')
      .upsert({
        user_id: userId,
        date: today,
        chat_messages_count: 0,
        voice_transcriptions_count: 0,
        screen_context_requests: 0
      }, {
        onConflict: 'user_id,date',
        ignoreDuplicates: true
      })
    
    if (upsertError) {
      console.error("Upsert usage record error:", upsertError)
    }
    
    // Get current usage and subscription
    const [usageResult, subscriptionResult] = await Promise.all([
      supabase
        .from('usage_tracking')
        .select('chat_messages_count, voice_transcriptions_count, screen_context_requests')
        .eq('user_id', userId)
        .eq('date', today)
        .single(),
      supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single() as any
    ])
    
    const usage = usageResult.data
    const userTier = subscriptionResult.data?.subscription_tier || 'free'
    const currentCount = usage?.[usageType] || 0
    
    // Check limits for free users
    if (userTier === 'free') {
      const limits = {
        chat_messages_count: 5,
        voice_transcriptions_count: 3,
        screen_context_requests: 2
      }
      
      const maxLimit = limits[usageType]
      
      if (currentCount + incrementBy > maxLimit) {
        return { 
          error: {
            message: `Daily limit exceeded for ${usageType}`,
            code: 'DAILY_LIMIT_EXCEEDED',
            details: { currentCount, maxLimit, userTier }
        }
        }
      }
    }
    
    // Update the usage count
    const newValue = currentCount + incrementBy
    const { error } = await supabase
      .from('usage_tracking')
      .update({ 
        [usageType]: newValue,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('date', today)
    
    if (error) {
      console.error("Update usage error:", error)
      return { error }
    }
    
    return { error: null }
  } catch (error) {
    console.error("Increment usage failed:", error)
    return { error }
  }
}

export const checkDailyUsageLimit = async (userId: string, usageType: 'chat_messages_count' | 'voice_transcriptions_count' | 'screen_context_requests') => {
  try {
    // Get user's subscription and today's usage
    const today = new Date().toISOString().split('T')[0]
    
    // Get user's subscription tier
    const { data: subscription } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single() as any
    
    const userTier = subscription?.subscription_tier || 'free'
    
    // Set limits based on tier
    const limits = {
      free: {
        chat_messages_count: 5,
        voice_transcriptions_count: 3,
        screen_context_requests: 2
      },
      pro: {
        chat_messages_count: -1, // unlimited
        voice_transcriptions_count: -1,
        screen_context_requests: -1
      },
      enterprise: {
        chat_messages_count: -1, // unlimited
        voice_transcriptions_count: -1,
        screen_context_requests: -1
      }
    }
    
    const maxLimit = limits[userTier as keyof typeof limits]?.[usageType] || 0
    
    // If unlimited (pro/enterprise), always within limit
    if (maxLimit === -1) {
      return { 
        withinLimit: true, 
        error: null,
        currentCount: 0,
        maxLimit: -1,
        userTier,
        remaining: -1
      }
    }
    
    // Get today's usage
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('chat_messages_count, voice_transcriptions_count, screen_context_requests')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    
    const currentCount = usage?.[usageType] || 0
    const withinLimit = (currentCount + 1) <= maxLimit  // Check if adding one more would be within limit
    const remaining = Math.max(0, maxLimit - currentCount)
    
    return { 
      withinLimit, 
      error: null,
      currentCount,
      maxLimit,
      userTier,
      remaining
    }
  } catch (error) {
    console.error("Check usage limit failed:", error)
    return { 
      withinLimit: false, 
      error,
      currentCount: 0,
      maxLimit: 0,
      userTier: 'free',
      remaining: 0
  }
}
}

export const getCurrentUsageStats = async (userId: string) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Get user's subscription tier
    const { data: subscription } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single() as any
    
    const userTier = subscription?.subscription_tier || 'free'
    
    // Get today's usage
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('chat_messages_count, voice_transcriptions_count, screen_context_requests')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    
    const limits = {
      free: {
        chat_messages_count: 5,
        voice_transcriptions_count: 3,
        screen_context_requests: 2
      },
      pro: {
        chat_messages_count: -1,
        voice_transcriptions_count: -1,
        screen_context_requests: -1
      },
      enterprise: {
        chat_messages_count: -1,
        voice_transcriptions_count: -1,
        screen_context_requests: -1
      }
    }
    
    const tierLimits = limits[userTier as keyof typeof limits] || limits.free
    
    return {
      success: true,
      data: {
        userTier,
        date: today,
        usage: {
          chat_messages_count: usage?.chat_messages_count || 0,
          voice_transcriptions_count: usage?.voice_transcriptions_count || 0,
          screen_context_requests: usage?.screen_context_requests || 0
        },
        limits: tierLimits,
        remaining: {
          chat_messages_count: tierLimits.chat_messages_count === -1 ? -1 : Math.max(0, tierLimits.chat_messages_count - (usage?.chat_messages_count || 0)),
          voice_transcriptions_count: tierLimits.voice_transcriptions_count === -1 ? -1 : Math.max(0, tierLimits.voice_transcriptions_count - (usage?.voice_transcriptions_count || 0)),
          screen_context_requests: tierLimits.screen_context_requests === -1 ? -1 : Math.max(0, tierLimits.screen_context_requests - (usage?.screen_context_requests || 0))
        }
      }
    }
  } catch (error) {
    console.error("Get usage stats failed:", error)
    return {
      success: false,
      error
    }
  }
}

// Export all functions for easy access
export { supabase as default }

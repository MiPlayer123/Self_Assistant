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
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error) {
      console.error("Get subscription error:", error)
      return { subscription: null, error }
    }
    
    return { subscription: data, error: null }
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
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        tier,
        status: 'active'
      })
      .select()
      .single()
    
    if (error) {
      console.error("Create subscription error:", error)
      return { subscription: null, error }
            }
    
    return { subscription: data, error: null }
  } catch (error) {
    console.error("Create subscription failed:", error)
    return { subscription: null, error }
        }
}

export const incrementUsage = async (userId: string, usageType: 'chat_messages_count' | 'voice_transcriptions_count' | 'screen_context_requests', incrementBy: number = 1) => {
  try {
    const { error } = await supabase.rpc('increment_usage', {
      user_uuid: userId,
      usage_type: usageType,
      increment_by: incrementBy
    })
    
    if (error) {
      console.error("Increment usage error:", error)
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
    const { data, error } = await supabase.rpc('check_daily_usage_limit', {
      user_uuid: userId,
      usage_type: usageType
    })
    
    if (error) {
      console.error("Check usage limit error:", error)
      return { withinLimit: false, error }
    }
    
    return { withinLimit: data, error: null }
  } catch (error) {
    console.error("Check usage limit failed:", error)
    return { withinLimit: false, error }
  }
}

// Export all functions for easy access
export { supabase as default }

import { useState, useEffect, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { 
  supabase, 
  signInWithGoogle, 
  signOut, 
  getCurrentUser, 
  getUserProfile, 
  getUserSubscription,
  createUserProfile,
  createUserSubscription
} from '../lib/supabase'
import { cacheSubscription, clearSubscriptionCache, getCachedSubscription } from '../utils/offlineStorage'
import type { Profile, Subscription } from '../types/database'

interface AuthState {
  user: User | null
  profile: Profile | null
  subscription: Subscription | null
  session: Session | null
  loading: boolean
  error: string | null
}

export const useSupabaseAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    subscription: null,
    session: null,
    loading: true,
    error: null
  })
  
  const [isLoadingUserData, setIsLoadingUserData] = useState(false)

  // Helper function to check if we're online
  const isOnline = () => {
    return navigator.onLine
  }

  // Helper function to create a basic profile for offline use
  const createOfflineProfile = (user: User): Profile => {
    return {
      id: user.id,
      email: user.email || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      subscription_tier: null
    }
  }

  const loadUserData = useCallback(async (user: User) => {
    console.log('Starting loadUserData for user:', user.id, user.email)
    
    // Prevent concurrent calls
    if (isLoadingUserData) {
      console.log('Already loading user data, skipping...')
      return
    }
    
    setIsLoadingUserData(true)
    
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))

      // Check if we're offline
      if (!isOnline()) {
        console.log('Device is offline, using cached data and creating offline profile')
        
        // Get current session (this should work offline from local storage)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // Get cached subscription if available
        const cachedSubscription = getCachedSubscription()
        
        // Create a basic profile for offline use
        const offlineProfile = createOfflineProfile(user)
        
        console.log('Setting offline auth state with cached/basic data')
        setAuthState({
          user,
          profile: offlineProfile,
          subscription: cachedSubscription, // Could be null if no cache
          session: sessionError ? null : session,
          loading: false,
          error: null
        })
        
        setIsLoadingUserData(false)
        return
      }

      // Online flow - proceed with normal API calls
      console.log('Device is online, fetching user profile...')
      const { profile, error: profileError } = await getUserProfile(user.id)
      console.log('Profile fetch result:', { profile, profileError })
      
      let userProfile = profile

      // If the profile is not found, the new DB trigger should be creating it.
      // We can add a small delay and retry to give the trigger time to complete.
      if (profileError || !profile) {
        console.log('Profile not found, retrying after a short delay for DB trigger...')
        await new Promise(resolve => setTimeout(resolve, 1500)); // wait 1.5 seconds
        const { profile: refetchedProfile, error: refetchError } = await getUserProfile(user.id)

        if (refetchError || !refetchedProfile) {
           console.error('Failed to fetch profile even after retry:', refetchError)
           throw new Error('Could not retrieve user profile after sign-in.');
        }
        console.log('Profile found after retry:', refetchedProfile);
        userProfile = refetchedProfile
      }

      if (!userProfile) {
        throw new Error('User profile is missing and could not be created or fetched.')
      }

      // Get user subscription
      const { subscription, error: subscriptionError } = await getUserSubscription(user.id)
      
      let userSubscription = subscription

      // If subscription doesn't exist, create a free one
      if (subscriptionError || !subscription) {
        console.log('Subscription not found, creating new subscription...')
        const { subscription: newSubscription, error: createSubError } = await createUserSubscription(user.id, 'free')
        
        if (createSubError) {
          console.error('Failed to create subscription:', createSubError)
          throw createSubError
        }
        
        console.log('Subscription created successfully:', newSubscription)
        userSubscription = newSubscription
      } else {
        console.log('Subscription found:', userSubscription)
      }

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw sessionError
      }

      // Cache subscription data for offline access
      if (userSubscription) {
        console.log('Caching subscription data for offline access')
        cacheSubscription(userSubscription)
      }

      console.log('Setting final auth state with all user data loaded')
      setAuthState({
        user,
        profile: userProfile,
        subscription: userSubscription,
        session,
        loading: false,
        error: null
      })

    } catch (error) {
      console.error('Error loading user data:', error)
      
      // If we're offline or have connection issues, try using cached data
      if (!isOnline() || (error instanceof Error && error.message.includes('Failed to fetch'))) {
        console.log('Network error detected, falling back to offline mode')
        
        const cachedSubscription = getCachedSubscription()
        const offlineProfile = createOfflineProfile(user)
        
        setAuthState({
          user,
          profile: offlineProfile,
          subscription: cachedSubscription,
          session: null,
          loading: false,
          error: null
        })
      } else {
        setAuthState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load user data',
          loading: false
        }))
      }
    } finally {
      setIsLoadingUserData(false)
    }
  }, [isLoadingUserData])

  // Add a timeout for loading state to prevent infinite loading
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAuthState(prev => {
        if (prev.loading) {
          console.warn('Auth loading timeout - forcing to show auth form')
          return {
            ...prev,
            loading: false,
            error: 'Loading timeout - please try refreshing the page'
          }
        }
        return prev
      })
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeoutId)
  }, [])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw sessionError
        }

        if (session && session.user && mounted) {
          // User is authenticated, check if we need to load their data
          setAuthState(prev => {
            if (prev.user?.id === session.user.id && prev.profile && prev.subscription) {
              console.log('Initial auth: User data already loaded')
              return { ...prev, loading: false }
            }
            
            // Load user data for the first time or different user
            loadUserData(session.user)
            return prev
          })
        } else if (mounted) {
          // No authenticated user
          setAuthState(prev => ({
            ...prev,
            loading: false
          }))
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Authentication error',
            loading: false
          }))
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
    }
  }, [loadUserData])

  // Set up auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Check if we already have this user's data loaded to prevent redundant calls
          setAuthState(prev => {
            if (prev.user?.id === session.user.id && prev.profile && prev.subscription && !prev.loading) {
              console.log('User data already loaded, skipping loadUserData call')
              return { ...prev, session } // Just update session if needed
            }
            
            // Only load user data if we don't have it or it's for a different user
            loadUserData(session.user)
            return prev
          })
        } else if (event === 'SIGNED_OUT') {
          // User signed out, clear state and cached subscription
          console.log('User signed out, clearing auth state and subscription cache')
          clearSubscriptionCache()
          setAuthState({
            user: null,
            profile: null,
            subscription: null,
            session: null,
            loading: false,
            error: null
          })
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token was refreshed - for cross-origin auth, we need to load user data
          console.log('Token refreshed for user:', session.user.email)
          
          // Check if we already have user data loaded
          setAuthState(prev => {
            // First, always update the session and user from the refreshed token
            const updatedState = { 
              ...prev, 
              session,
              user: session.user // Important: set user from session immediately
            }
            
            if (prev.user?.id === session.user.id && prev.profile && prev.subscription && !prev.loading) {
              console.log('User data already loaded for token refresh')
              return updatedState
            }
            
            // Load profile and subscription data if we don't have it (happens with cross-origin auth)
            console.log('Loading user profile/subscription after token refresh (cross-origin auth)')
            loadUserData(session.user)
            return updatedState
          })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUserData])

  const handleSignInWithGoogle = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const { error } = await signInWithGoogle()
      
      if (error) {
        throw error
      }

      // The auth state listener will handle the rest
    } catch (error) {
      console.error('Google sign-in error:', error)
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sign-in failed',
        loading: false
      }))
    }
  }

  const handleSignOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const { error } = await signOut()
      
      if (error) {
        throw error
      }

      // The auth state listener will handle clearing the state
    } catch (error) {
      console.error('Sign-out error:', error)
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sign-out failed',
        loading: false
      }))
    }
  }

  const refreshUserData = async () => {
    if (authState.user) {
      await loadUserData(authState.user)
    }
  }

  // Set up periodic subscription validity check listener
  useEffect(() => {
    if (!window.electronAPI?.onCheckSubscriptionValidity) return

    const unsubscribe = window.electronAPI.onCheckSubscriptionValidity(() => {
      console.log('Periodic subscription validity check triggered')
      if (authState.user) {
        loadUserData(authState.user)
      }
    })

    return unsubscribe
  }, [authState.user, loadUserData])

  return {
    ...authState,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    refreshUserData,
    isAuthenticated: !!authState.user && !!authState.session
  }
} 
import { supabase } from "./lib/supabase"
import SubscribePage from "./_pages/SubscribePage"
import { UpdateNotification } from "./components/UpdateNotification"
import { ButtonWindow } from "./components/ui/ButtonWindow"
import { ConnectionErrorScreen } from "./components/ConnectionErrorScreen"
import { WagooChatApp } from "./components/WagooChatApp"
import { OfflineNotification } from "./components/OfflineNotification"
import { useSupabaseAuth } from "./hooks/useSupabaseAuth"
import { useUsageTracking } from "./hooks/useUsageTracking"
import { useOfflineMode } from "./hooks/useOfflineMode"

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient
} from "@tanstack/react-query"
import { useEffect, useState, useCallback, useMemo } from "react"
import { User } from "@supabase/supabase-js"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from "./components/ui/toast"
import { ToastContext } from "./contexts/toast"

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
})

// Root component that provides the QueryClient
function App() {
  // Memoize expensive button window check to avoid recalculating on every render
  const isButtonWindow = useMemo(() => {
    return new URLSearchParams(window.location.search).has('button') || 
           (window.innerWidth === 68 && window.innerHeight === 68)
  }, []) // Empty dependency array since this should only be calculated once

  // If this is the button window, render just the button
  if (isButtonWindow) {
    return (
      <QueryClientProvider client={queryClient}>
        <ButtonWindow />
      </QueryClientProvider>
    )
  }

  const [toastState, setToastState] = useState<{
    open: boolean
    title: string
    description: string
    variant: "neutral" | "success" | "error"
  }>({
    open: false,
    title: "",
    description: "",
    variant: "neutral"
  })
  const [credits, setCredits] = useState<number>(0)
  const [currentLanguage, setCurrentLanguage] = useState<string>("english")
  const [isInitialized, setIsInitialized] = useState(false)

  // Helper function to safely update credits


  // Helper function to safely update language
  const updateLanguage = useCallback((newLanguage: string) => {
    setCurrentLanguage(newLanguage)
  }, [])

  // Helper function to mark initialization complete
  const markInitialized = useCallback(() => {
    setIsInitialized(true)
  }, [])

  // Show toast method
  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        variant
      })
    },
    []
  )

  // Clean up any callback URLs to prevent routing errors
  useEffect(() => {
    // Remove any callback parameters from URL that might cause routing issues
    if (window.location.pathname.includes('/callback') || window.location.pathname.includes('/auth')) {
      console.log("Mock: Cleaning up callback URL to prevent routing errors")
      window.history.replaceState({}, document.title, window.location.origin)
    }
  }, [])

  // Listen for PKCE code callback
  useEffect(() => {
    let isProcessing = false // Prevent duplicate processing

    const handleAuthCallbackPKCE = async (data: { code: string }) => {
      console.log("🔐 AUTH: handleAuthCallbackPKCE called with data:", data);
      // Prevent duplicate processing
      if (isProcessing) {
        console.log("🔐 AUTH: Auth callback already being processed, ignoring duplicate")
        return
      }
      
      isProcessing = true
      console.log("🔐 AUTH: IPC: received auth callback:", data)
      
      try {
        const { code } = data || {}
        if (!code) {
          console.error("No code in callback data")
          return
        }

        // The 'code' from the web app is a Base64 encoded JSON string of the session.
        console.log("Attempting to decode Base64 session data...")
        const sessionDataString = atob(code)
        const sessionData = JSON.parse(sessionDataString)
        console.log("Parsed session data keys:", Object.keys(sessionData))

        if (sessionData.access_token && sessionData.refresh_token) {
          console.log("Session tokens found, implementing cross-origin auth...")

          // The key issue: tokens from the website domain won't work directly in Electron
          // We need to use the refresh token to get new tokens for this origin
          
          try {
            // First, clear any existing session locally only
            // Don't use signOut here as it might interfere with the new session
            const storageKey = 'wagoo-auth-token' // Matches the storageKey in supabase.ts
            localStorage.removeItem(storageKey)
            const supabaseKeys = Object.keys(localStorage).filter(key => 
              key.startsWith('sb-') || key.includes('supabase')
            )
            supabaseKeys.forEach(key => localStorage.removeItem(key))
            
            // Store the session in the format Supabase expects
            const sessionToStore = {
              currentSession: {
                access_token: sessionData.access_token,
                refresh_token: sessionData.refresh_token,
                expires_in: sessionData.expires_in,
                expires_at: sessionData.expires_at,
                token_type: sessionData.token_type,
                user: sessionData.user
              },
              expiresAt: sessionData.expires_at
            }
            
            localStorage.setItem(storageKey, JSON.stringify(sessionToStore))
            console.log("Stored session in localStorage")
            
            // Now immediately try to refresh the session
            // This will exchange the refresh token for new tokens valid for this origin
            console.log("Refreshing session to get origin-valid tokens...")
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
              refresh_token: sessionData.refresh_token
            })
            
            if (refreshError) {
              console.error("Session refresh failed:", refreshError)
              
              // Fallback: Try setting the session directly one more time
              console.log("Trying direct session set as fallback...")
              const { data: directSession, error: directError } = await supabase.auth.setSession({
                access_token: sessionData.access_token,
                refresh_token: sessionData.refresh_token
              })
              
              if (directError) {
                console.error("Direct session set also failed:", directError)
                
                // Final fallback: Manually trigger auth state change
                console.log("Manually triggering auth state change...")
                // Get the internal auth client and notify it of the session
                const authClient = (supabase.auth as any)
                if (authClient && authClient._notifyAllSubscribers) {
                  authClient._notifyAllSubscribers('SIGNED_IN', {
                    access_token: sessionData.access_token,
                    refresh_token: sessionData.refresh_token,
                    expires_in: sessionData.expires_in,
                    expires_at: sessionData.expires_at,
                    token_type: sessionData.token_type,
                    user: sessionData.user
                  })
                  console.log("Manually notified auth subscribers")
                }
              } else {
                console.log("Direct session set succeeded!")
              }
            } else {
              console.log("Session refresh succeeded! New session established:", {
                user: refreshData.session?.user?.email,
                expires_at: refreshData.session?.expires_at
              })
              
              // The auth state change should be triggered automatically
              // The useSupabaseAuth hook will pick this up
            }
            
          } catch (error) {
            console.error("Cross-origin auth implementation failed:", error)
          }
        } else {
          console.error("Missing required tokens in session data")
          console.error("Available keys:", Object.keys(sessionData))
        }
      } catch (err: unknown) {
        console.error("Error in auth callback:", err)
        if (err instanceof Error) {
          console.error("Error stack:", err.stack)
        }
      } finally {
        // Reset processing flag after a delay to allow for successful auth
        setTimeout(() => {
          isProcessing = false
        }, 2000)
      }
    }

    console.log("Setting up auth IPC listener")
    window.electron?.ipcRenderer?.on("auth-callback", handleAuthCallbackPKCE)

    // >>> deep-link start
    // Set up deep link handler
    console.log('Setting up deep link handler...');
    const cleanupDeepLink = window.electronAPI?.onDeepLink((url: string) => {
      console.log('🎯 RENDERER: Received deep link:', url);
      // Parse the URL and extract the code
      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        if (code) {
          console.log('🎯 RENDERER: Extracted code from deep link, processing...');
          handleAuthCallbackPKCE({ code });
        } else {
          console.error('🎯 RENDERER: No code found in deep link URL');
          console.log('🎯 RENDERER: Available search params:', Array.from(urlObj.searchParams.entries()));
        }
      } catch (error) {
        console.error('🎯 RENDERER: Error parsing deep link URL:', error);
      }
    });
    console.log('Deep link handler setup complete');
    // <<< deep-link end

    return () => {
      window.electron?.ipcRenderer?.removeListener(
        "auth-callback",
        handleAuthCallbackPKCE
      )
      // >>> deep-link start
      // Clean up deep link handler
      if (cleanupDeepLink) {
        cleanupDeepLink();
      }
      // <<< deep-link end
    }
  }, [])

  // Simple initialization
  useEffect(() => {
    // Just mark as initialized since auth is handled by the AppContent component
    markInitialized()
  }, [markInitialized])

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContext.Provider value={{ showToast }}>
          <AppContent isInitialized={isInitialized} />
          <UpdateNotification />
          <Toast
            open={toastState.open}
            onOpenChange={(open) =>
              setToastState((prev) => ({ ...prev, open }))
            }
            variant={toastState.variant}
            duration={3000}
          >
            <ToastTitle>{toastState.title}</ToastTitle>
            <ToastDescription>{toastState.description}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

function AuthForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleBrowserLogin() {
    setIsLoading(true)
    setError("")

    try {
      const loginUrl =
        "https://www.wagoo.ai/login?redirectTo=wagoo://auth/callback"

      const electronOpenExternalUrl = (window as any).electronAPI?.openExternalUrl
      const electronOpenExternal = (window as any).electronAPI?.openExternal

      // Prefer the async helper used elsewhere in the app, fall back to the sync shell helper
      if (typeof electronOpenExternalUrl === "function") {
        await electronOpenExternalUrl(loginUrl)
      } else if (typeof electronOpenExternal === "function") {
        electronOpenExternal(loginUrl)
      } else if (typeof window.open === "function") {
        // Fallback for the plain browser environment
        window.open(loginUrl, "_blank")
      } else {
        // Absolute last-resort fallback
        window.location.href = loginUrl
      }
    } catch (e) {
      console.error("Failed to open browser:", e)
      setError("Could not open browser. Please try again.")
      setIsLoading(false)
      return
    }

    // Keep spinner until deep-link returns or user navigates back.
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm px-4">
        <h2 className="text-2xl font-semibold text-white">Log in to Wagoo</h2>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={handleBrowserLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
          <span>
            {isLoading ? "Opening browser…" : "Click to log in with browser"}
          </span>
        </button>
        {/* Optional cancel button shown only while waiting for browser to open */}
        {isLoading && (
          <button
            type="button"
            onClick={() => {
              // Allow the user to abort the waiting state
              setIsLoading(false)
            }}
            className="mt-2 text-xs text-gray-400 hover:text-gray-200 underline focus:outline-none"
          >
            Cancel
          </button>
        )}
        <p className="text-xs text-white/40 text-center max-w-xs">
          We'll open your default browser so you can sign in with any method. Once
          finished, you'll be redirected back to the app automatically.
        </p>
      </div>
    </div>
  )
}

// Main App component that handles conditional rendering based on auth and subscription state
function AppContent({ isInitialized }: { isInitialized: boolean }) {
  const auth = useSupabaseAuth()
  const usageTracking = useUsageTracking(auth.user?.id)
  const [currentLanguage, setCurrentLanguage] = useState<string>("english")
  const [offlineAppAccess, setOfflineAppAccess] = useState(false)
  const queryClient = useQueryClient()
  const offlineMode = useOfflineMode()

  // Check subscription status whenever user changes
  useEffect(() => {
    const checkSubscriptionData = async () => {
      if (!auth.user?.id || !auth.subscription) {
        setCurrentLanguage("english")
        return
      }

      try {
        // Set language based on profile subscription tier
        // You can customize this logic based to your business rules
        setCurrentLanguage("english") // Default for now
      } catch (error) {
        console.error('Error checking subscription:', error)
      }
    }

    checkSubscriptionData()

    // Set up real-time subscription for subscription changes
    if (auth.user?.id) {
      const channel = supabase
        .channel(`subscription-${auth.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "subscriptions",
            filter: `user_id=eq.${auth.user.id}`
          },
          async (payload) => {
            console.log("Subscription event received:", {
              eventType: payload.eventType,
              old: payload.old,
              new: payload.new
            })

            // Refresh user data when subscription changes
            await auth.refreshUserData()
            await queryClient.invalidateQueries({ queryKey: ["user"] })
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    }
  }, [auth.user?.id, auth.subscription, queryClient])

  // Handle offline scenarios first, before auth checks
  const handleContinueOffline = () => {
    console.log('User chose to continue offline')
    setOfflineAppAccess(true)
  }

  // Show loading state while system initializes or auth is loading
  if (!isInitialized || auth.loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
          <p className="text-white/60 text-sm">
            {!isInitialized 
              ? "Initializing...If you see this screen for more than 10 seconds, please quit and restart the app."
              : "Loading user data..."
            }
          </p>
          {auth.loading && (
            <p className="text-white/40 text-xs">
              Connecting to database...
            </p>
          )}
        </div>
      </div>
    )
  }

  // Handle offline scenarios
  if (!offlineMode.isOnline) {
    // Check subscription tier for direct access
    const subscriptionTier = offlineMode.subscriptionStatus?.tier
    const isProOrEnterprise = subscriptionTier === 'pro' || subscriptionTier === 'enterprise'
    
    // Pro/Enterprise users go straight to chat app when offline
    if (offlineMode.canUseOffline && isProOrEnterprise) {
      // Create a mock auth state for offline access using cached subscription
      const offlineAuthState = {
        user: { id: 'offline-user', email: 'offline@wagoo.app' } as any,
        profile: null,
        subscription: offlineMode.subscriptionStatus,
        isAuthenticated: true,
        loading: false,
        error: null,
        refreshUserData: async () => {}
      }

      return (
        <>
          <WagooChatApp 
            user={offlineAuthState.user} 
            profile={offlineAuthState.profile}
            subscription={offlineAuthState.subscription} 
            usageTracking={usageTracking}
            currentLanguage={currentLanguage}
            setLanguage={setCurrentLanguage}
            refreshUserData={offlineAuthState.refreshUserData}
          />
          <OfflineNotification />
        </>
      )
    }
    
    // Free users need to explicitly grant offline access via connection error screen
    if (offlineMode.canUseOffline && !offlineAppAccess) {
      return <ConnectionErrorScreen onContinueOffline={handleContinueOffline} />
    }
    
    // If user granted access (free users who clicked continue), proceed to app
    if (offlineMode.canUseOffline && offlineAppAccess) {
      // Create a mock auth state for offline access using cached subscription
      const offlineAuthState = {
        user: { id: 'offline-user', email: 'offline@wagoo.app' } as any,
        profile: null,
        subscription: offlineMode.subscriptionStatus,
        isAuthenticated: true,
        loading: false,
        error: null,
        refreshUserData: async () => {}
      }

      return (
        <>
          <WagooChatApp 
            user={offlineAuthState.user} 
            profile={offlineAuthState.profile}
            subscription={offlineAuthState.subscription} 
            usageTracking={usageTracking}
            currentLanguage={currentLanguage}
            setLanguage={setCurrentLanguage}
            refreshUserData={offlineAuthState.refreshUserData}
          />
          <OfflineNotification />
        </>
      )
    }
    
    // If user cannot use offline, show connection error
    return <ConnectionErrorScreen />
  }

  // Online scenarios - handle auth errors and authentication
  if (auth.error) {
    return <ConnectionErrorScreen />
  }

  // Auth required - show existing AuthForm
  if (!auth.isAuthenticated) {
    return <AuthForm />
  }

  // Check if user needs subscription upgrade (optional)
  // For now, we'll assume all users can use the app
  // You can add subscription logic here based on your business rules
  
  // Ready - show the new chat-first app
  return (
    <>
      <WagooChatApp 
        user={auth.user!} 
        profile={auth.profile}
        subscription={auth.subscription} 
        usageTracking={usageTracking}
        currentLanguage={currentLanguage}
        setLanguage={setCurrentLanguage}
        refreshUserData={auth.refreshUserData}
      />
      {/* Show offline notification when transitioning to offline */}
      {!offlineMode.isOnline && offlineMode.canUseOffline && (
        <OfflineNotification />
      )}
    </>
  )
}

export default App

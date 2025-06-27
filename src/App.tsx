import { supabase } from "./lib/supabase"
import SubscribePage from "./_pages/SubscribePage"
import { UpdateNotification } from "./components/UpdateNotification"
import { ButtonWindow } from "./components/ui/ButtonWindow"
import { ConnectionErrorScreen } from "./components/ConnectionErrorScreen"
import { WagooChatApp } from "./components/WagooChatApp"
import { useSupabaseAuth } from "./hooks/useSupabaseAuth"
import { useUsageTracking } from "./hooks/useUsageTracking"

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient
} from "@tanstack/react-query"
import { useEffect, useState, useCallback } from "react"
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
  // Check if this is the button window by looking at the URL query parameter or window size
  const isButtonWindow = new URLSearchParams(window.location.search).has('button') || 
                         (window.innerWidth === 68 && window.innerHeight === 68)

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
    if (!import.meta.env.DEV) {
      const handleAuthCallbackPKCE = async (data: { code: string }) => {
        console.log("Production IPC: received code:", data)
        try {
          const { code } = data || {}
          if (!code) {
            console.error("No code in callback data")
            return
          }
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error("Error exchanging code for session:", error)
          } else {
            console.log("Production PKCE: Session exchanged successfully")
          }
        } catch (err) {
          console.error("Production PKCE: Error in auth callback:", err)
        }
      }

      console.log("PROD: Setting up PKCE-based IPC listener")
      window.electron?.ipcRenderer?.on("auth-callback", handleAuthCallbackPKCE)

      return () => {
        window.electron?.ipcRenderer?.removeListener(
          "auth-callback",
          handleAuthCallbackPKCE
        )
      }
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
            duration={1500}
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
  const auth = useSupabaseAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [shake, setShake] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)

  const validatePassword = (value: string) => {
    if (isSignUp && value.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return false
    }
    setPasswordError("")
    return true
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    if (value && isSignUp) validatePassword(value)
    else setPasswordError("")
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    if (isSignUp && !validatePassword(password)) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    setIsLoading(true)
    setError("")
    try {
      if (isSignUp) {
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              // Mock: disabled redirect for testing
              emailRedirectTo: window.location.origin
            }
          })
        if (signUpError) throw signUpError

        if (signUpData?.session) {
          await supabase.auth.setSession({
            access_token: signUpData.session.access_token,
            refresh_token: signUpData.session.refresh_token
          })
          return
        }

        // If no session (email confirmation required), show message and switch to sign in
        setError("Please check your email to confirm your account")
        setTimeout(() => {
          setIsSignUp(false)
        }, 2000)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setError("Invalid email or password")
          } else if (error.message.includes("Email not confirmed")) {
            setError("Please verify your email address")
          } else {
            setError(error.message)
          }
          setShake(true)
          setTimeout(() => setShake(false), 500)
          return
        }

        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          })
        }
      }
    } catch (error) {
      console.error(`Error ${isSignUp ? "signing up" : "signing in"}:`, error)
      setError("Something went wrong, try again later")
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleAuth() {
    setIsLoading(true)
    setError("")
    console.log("Starting Google authentication...")
    
    try {
      await auth.signInWithGoogle()
      // The auth state change will be handled by the useSupabaseAuth hook
      // So we don't need to do anything else here
    } catch (error) {
      console.error(`Error with Google auth:`, error)
      setError("Something went wrong with Google authentication")
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = async () => {
    if (!isSignUp) {
      // User wants to sign up - open wagoo.vercel.app in default browser
      try {
        if (window.electronAPI?.openSubscriptionPortal) {
          await window.electronAPI.openSubscriptionPortal({ id: 'temp', email: 'temp' })
        } else {
          // Fallback for web version or if electronAPI is not available
          window.open('https://wagoo.vercel.app', '_blank')
        }
      } catch (error) {
        console.log('Electron method failed, using fallback...')
        window.open('https://wagoo.vercel.app', '_blank')
      }
    } else {
      // User wants to switch back to sign in
      setIsSignUp(false)
      setError("")
      setPasswordError("")
      setEmail("")
      setPassword("")
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md space-y-8 p-4 sm:p-8">
          <div className="flex flex-col items-center justify-center space-y-6">
            <h2 className="text-2xl font-semibold text-white">
              {isSignUp ? "Create your account" : "Log in to Wagoo"}
            </h2>

            <div className="w-full max-w-sm space-y-4">
              <button
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1A1A1A] hover:bg-[#242424] text-white rounded-2xl border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-black px-2 text-[#989898]">
                    Or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="space-y-1">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-4 py-3 text-white rounded-2xl border focus:outline-none text-sm font-medium placeholder:text-[#989898] placeholder:font-medium transition-colors frosted-glass ${
                      error
                        ? "border-red-500 focus:border-red-500"
                        : "border-white/10 focus:border-white/20"
                    } ${shake ? "shake" : ""}`}
                    required
                  />
                  {error && (
                    <p className="text-sm text-red-500 px-1">{error}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-3 text-white rounded-2xl border focus:outline-none text-sm font-medium placeholder:text-[#989898] placeholder:font-medium transition-colors frosted-glass ${
                      passwordError
                        ? "border-red-500 focus:border-red-500"
                        : "border-white/10 focus:border-white/20"
                    } ${shake ? "shake" : ""}`}
                    required
                  />
                  {passwordError && (
                    <p className="text-sm text-red-500 px-1">{passwordError}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !email || !password || !!passwordError}
                  className="relative w-full px-4 py-3 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium auth-button"
                >
                  {isLoading
                    ? isSignUp
                      ? "Creating account..."
                      : "Signing in..."
                    : isSignUp
                    ? "Create account"
                    : "Sign in"}
                </button>
              </form>

              <button
                onClick={toggleMode}
                className="block w-full border border-white/10 rounded-2xl p-4 hover:bg-[#1A1A1A] transition-colors group"
              >
                <p className="text-center text-sm text-[#989898]">
                  {isSignUp
                    ? "Already have an account? Sign in →"
                    : "Don't have an account? Sign up →"}
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main App component that handles conditional rendering based on auth and subscription state
function AppContent({ isInitialized }: { isInitialized: boolean }) {
  const auth = useSupabaseAuth()
  const usageTracking = useUsageTracking(auth.user?.id)
  const [currentLanguage, setCurrentLanguage] = useState<string>("english")
  const queryClient = useQueryClient()

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

  // Show error if there's an auth error
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
    <WagooChatApp 
      user={auth.user!} 
      profile={auth.profile}
      subscription={auth.subscription} 
      usageTracking={usageTracking}
      currentLanguage={currentLanguage}
      setLanguage={setCurrentLanguage}
      refreshUserData={auth.refreshUserData}
    />
  )
}

export default App

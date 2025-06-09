// Mock Supabase implementation - temporarily disabled
// import { createClient } from "@supabase/supabase-js"

console.log("Supabase DISABLED - using mock implementation")

// Mock user object
const mockUser = {
  id: "mock-user-123",
  email: "mock@example.com",
  created_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  email_confirmed_at: new Date().toISOString(),
  phone_confirmed_at: null,
  last_sign_in_at: new Date().toISOString(),
  role: "authenticated",
  updated_at: new Date().toISOString(),
  identities: [],
  factors: [],
  user_metadata: {},
  app_metadata: {}
}

// Mock session object
const mockSession = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: "bearer",
  user: mockUser
}

// Mock subscription data - set as active with good credits
const mockSubscription = {
  id: "mock-subscription-123",
  user_id: mockUser.id,
  credits: 999, // Plenty of credits for testing
  preferred_language: "python",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

// Mock Supabase client
export const supabase = {
  auth: {
    // Mock authentication methods
    signInWithOAuth: async (options: any) => {
      console.log("Mock: signInWithOAuth called with options:", options)
      // Simulate immediate success without any redirects
      // Trigger the auth state change callback immediately
      setTimeout(() => {
        // Simulate successful OAuth sign-in
        console.log("Mock: Simulating successful OAuth sign-in")
      }, 100)
      return { data: { url: null, provider: options?.provider || "google" }, error: null }
    },
    
    signUp: async () => {
      console.log("Mock: signUp called")
      return { data: { user: mockUser, session: mockSession }, error: null }
    },
    
    signInWithPassword: async () => {
      console.log("Mock: signInWithPassword called")
      return { data: { user: mockUser, session: mockSession }, error: null }
    },
    
    signOut: async () => {
      console.log("Mock: signOut called")
      return { error: null }
    },
    
    getUser: async () => {
      console.log("Mock: getUser called - returning active user")
      return { data: { user: mockUser }, error: null }
    },
    
    getSession: async () => {
      console.log("Mock: getSession called")
      return { data: { session: mockSession }, error: null }
    },
    
    setSession: async () => {
      console.log("Mock: setSession called")
      return { data: { session: mockSession, user: mockUser }, error: null }
    },
    
    exchangeCodeForSession: async () => {
      console.log("Mock: exchangeCodeForSession called")
      return { data: { session: mockSession, user: mockUser }, error: null }
    },
    
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      console.log("Mock: onAuthStateChange listener registered")
      // Simulate authenticated state immediately
      setTimeout(() => {
        callback("SIGNED_IN", mockSession)
      }, 100)
      
      return {
        data: { subscription: { unsubscribe: () => {} } }
      }
    }
  },
  
  // Mock database operations
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => ({
        single: async () => {
          console.log(`Mock: Database query - SELECT ${columns} FROM ${table} WHERE ${column} = ${value}`)
          if (table === "subscriptions") {
            return { data: mockSubscription, error: null }
          }
          return { data: null, error: null }
        }
      })
    }),
    
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        select: (columns: string) => ({
          single: async () => {
            console.log(`Mock: Database update - UPDATE ${table} SET ${JSON.stringify(data)} WHERE ${column} = ${value}`)
            if (table === "subscriptions") {
              const updatedSubscription = { ...mockSubscription, ...data }
              return { data: updatedSubscription, error: null }
            }
            return { data: null, error: null }
          }
        })
      })
    }),
    
    insert: (data: any) => ({
      select: (columns: string) => ({
        single: async () => {
          console.log(`Mock: Database insert - INSERT INTO ${table} VALUES ${JSON.stringify(data)}`)
          if (table === "subscriptions") {
            return { data: { ...mockSubscription, ...data }, error: null }
          }
          return { data: null, error: null }
        }
      })
    })
  }),
  
  // Mock realtime channel
  channel: (name: string, options?: any) => {
    console.log(`Mock: Creating realtime channel "${name}"`)
    return {
      on: (event: string, config: any, callback: (payload: any) => void) => {
        console.log(`Mock: Listening to ${event} on channel ${name}`)
        return {
          subscribe: (statusCallback?: (status: string) => void) => {
            console.log(`Mock: Subscribing to channel ${name}`)
            setTimeout(() => {
              if (statusCallback) statusCallback("SUBSCRIBED")
            }, 100)
            return { unsubscribe: () => console.log(`Mock: Unsubscribed from channel ${name}`) }
          }
        }
      },
      subscribe: (callback?: (status: string) => void) => {
        console.log(`Mock: Direct subscribe to channel ${name}`)
        setTimeout(() => {
          if (callback) callback("SUBSCRIBED")
        }, 100)
        return { unsubscribe: () => console.log(`Mock: Unsubscribed from channel ${name}`) }
      },
      unsubscribe: () => {
        console.log(`Mock: Unsubscribed from channel ${name}`)
      }
    }
  }
}

export const signInWithGoogle = async () => {
  try {
    console.log("Mock: Initiating Google sign in...")
    // Simulate successful Google sign in
    return { 
      data: { url: null, provider: "google" }, 
      error: null 
    }
  } catch (error) {
    console.error("Mock: Unexpected error during Google sign in:", error)
    throw error
  }
}

// Mock realtime connection management - simplified
let channel: any = null

// Simulate auth state monitoring without actual connection
console.log("Mock: Setting up auth state monitoring")
setTimeout(() => {
  console.log("Mock: Simulating SIGNED_IN event")
  
  // Create mock channel
  channel = {
    on: () => channel,
    subscribe: (callback?: (status: string) => void) => {
      console.log("Mock: Realtime connection established")
      if (callback) callback("SUBSCRIBED")
      return { unsubscribe: () => console.log("Mock: Realtime connection cleaned up") }
    },
    unsubscribe: () => console.log("Mock: Channel unsubscribed")
  }
}, 200)

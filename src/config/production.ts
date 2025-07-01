// Production SaaS Configuration
// These keys are embedded in the app and shared by all users
export const PRODUCTION_CONFIG = {
  // Supabase (public keys loaded from environment variables)
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
  },

  // YOUR API Keys (embedded for SaaS model) 
  // These come from your .env during build time
  apiKeys: {
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
    google: import.meta.env.VITE_GOOGLE_API_KEY,
    tavily: import.meta.env.VITE_TAVILY_API_KEY,
    github: import.meta.env.VITE_GH_TOKEN
  },

  // Note: Usage limits are defined in src/lib/supabase.ts
  // Free: 5 chat messages, unlimited screenshots, 10 voice transcriptions per day
  // Pro/Enterprise: unlimited everything

  // App configuration
  app: {
    name: "Wagoo",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development'
  }
} as const

// Helper to get API key for a provider
export function getApiKey(provider: 'openai' | 'anthropic' | 'google' | 'tavily' | 'github'): string | undefined {
  const key = PRODUCTION_CONFIG.apiKeys[provider]
  
  if (!key || key.includes('WILL_BE_INSERTED_HERE')) {
    console.warn(`API key for ${provider} not available`)
    return undefined
  }
  
  return key
}

// Helper to check if in production mode
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
} 
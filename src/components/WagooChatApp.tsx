import React, { useRef, useState, useEffect } from 'react'
import { ChatPage } from './chat/ChatPage'
import { ChatProvider } from '../contexts/ChatContext'
import { User } from '@supabase/supabase-js'
import type { Profile, Subscription } from '../types/database'

interface WagooChatAppProps {
  user: User
  profile: Profile | null
  subscription: Subscription | null
  usageTracking: any
  currentLanguage: string
  setLanguage: (language: string) => void
  refreshUserData: () => Promise<void>
}

export function WagooChatApp({ user, profile, subscription, usageTracking, currentLanguage, setLanguage, refreshUserData }: WagooChatAppProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showUserInfo, setShowUserInfo] = useState(false)
  const [showEmailDropdown, setShowEmailDropdown] = useState(false)

  // Screenshot handlers (moved from SubscribedApp)
  const handleTakeScreenshot = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.electronAPI?.onScreenshotTaken || !window.electronAPI?.triggerScreenshot) {
        reject(new Error('Screenshot API not available'))
        return
      }

      // Set up listener for screenshot taken event
      const cleanup = window.electronAPI.onScreenshotTaken((data: any) => {
        cleanup()
        resolve(data.path)
      })

      // Trigger screenshot
      window.electronAPI.triggerScreenshot()
        .then((result: any) => {
          if (!result.success) {
            cleanup()
            reject(new Error(result.error || 'Failed to take screenshot'))
          }
        })
        .catch((error: any) => {
          cleanup()
          reject(error)
        })
    })
  }

  const handleGetImagePreview = async (path: string): Promise<string> => {
    try {
      return await (window.electronAPI as any).getImagePreview(path)
    } catch (error) {
      console.error('Failed to get image preview:', error)
      throw error
    }
  }

  const handleSignOut = async () => {
    console.log('🔥 SIGN OUT BUTTON CLICKED!')
    try {
      console.log('🔄 Starting sign out process...')
      
      // Clear local storage first
      localStorage.removeItem('wagoo_subscription_status')
      localStorage.removeItem('wagoo_user_data')
      console.log('✅ Cleared localStorage items')
      
      // Sign out from Supabase - this will trigger the auth state change listener
      console.log('📡 Calling supabase.auth.signOut()...')
      const { error } = await (await import('../lib/supabase')).supabase.auth.signOut()
      if (error) {
        console.error('❌ Sign out error:', error)
      } else {
        console.log('✅ Successfully signed out from Supabase')
      }
      
      // The useWagooAuth hook will automatically detect the sign out
      // and update the state to 'auth_required'
      console.log('⏳ Waiting for auth state change listener...')
    } catch (err) {
      console.error('💥 Error during sign out:', err)
    }
  }

  const toggleUserInfo = () => {
    setShowUserInfo(!showUserInfo)
    setShowEmailDropdown(false) // Close email dropdown when toggling user info
  }

  const toggleEmailDropdown = () => {
    setShowEmailDropdown(!showEmailDropdown)
  }

  const handleManageSubscription = async () => {
    // Open wagoo.vercel.app for subscription management in default browser
    console.log('Opening subscription management...')
    try {
      // Try the electron IPC method first
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
    setShowEmailDropdown(false)
  }

  const handleRefreshSubscription = async () => {
    console.log('Refreshing subscription status...')
    try {
      await refreshUserData()
      console.log('Subscription status refreshed successfully')
    } catch (error) {
      console.error('Failed to refresh subscription status:', error)
    }
    setShowEmailDropdown(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmailDropdown && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowEmailDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmailDropdown])

  return (
    <div ref={containerRef} className="h-screen w-full bg-glass flex flex-col">
      {/* User info bar - appears when logo is clicked */}
      {showUserInfo && (
        <div className="flex-shrink-0 px-4 py-3 relative" style={{ 
          background: 'var(--wagoo-bg-secondary)', 
          borderBottom: '1px solid var(--wagoo-border-primary)' 
        }}>
          <div className="flex items-center justify-between">
            {/* Left: User email (clickable) and subscription tier */}
            <div className="flex items-center gap-3 relative">
              <button 
                onClick={toggleEmailDropdown}
                className="text-white text-sm hover:text-blue-400 transition-colors cursor-pointer"
              >
                {user.email}
              </button>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                {subscription?.tier === 'pro' ? 'Pro' : 
                 subscription?.tier === 'enterprise' ? 'Enterprise' : 
                 subscription?.tier === 'free' ? 'Free' : 
                 subscription?.tier || 'Free'}
              </span>
              
              {/* Show usage for free users */}
              {usageTracking.usageStats && usageTracking.usageStats.userTier === 'free' && (
                <div className="flex items-center gap-2">
                  {/* Progress dots */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => {
                      const used = usageTracking.usageStats.usage.chat_messages_count || 0
                      const isUsed = i < used
                      return (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isUsed ? 'bg-blue-400' : 'bg-gray-600'
                          }`}
                        />
                      )
                    })}
                  </div>
                  {/* Text indicator */}
                  <span className="text-xs text-gray-400">
                    {usageTracking.usageStats.remaining.chat_messages_count} left
                </span>
                </div>
              )}
              
              {/* Email dropdown */}
              {showEmailDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-black border border-gray-500 rounded-lg shadow-lg py-2 min-w-[200px] z-50">
                  <button
                    onClick={handleManageSubscription}
                    className="w-full px-4 py-2 text-left text-white text-sm hover:bg-gray-900 transition-colors"
                  >
                    Manage Subscription
                  </button>
                  <button
                    onClick={handleRefreshSubscription}
                    className="w-full px-4 py-1.5 text-left text-gray-400 text-xs hover:bg-gray-900 hover:text-gray-300 transition-colors"
                  >
                    ↻ Refresh
                  </button>
                </div>
              )}
            </div>
            
            {/* Right: Sign Out button only */}
            <div className="flex items-center">
              <button 
                onClick={(e) => {
                  console.log('🖱️ Sign out button click event captured!', e)
                  handleSignOut()
                }}
                className="text-red-400 hover:text-red-300 text-sm transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main chat interface - full height */}
      <div className="flex-1 min-h-0">
        <ChatProvider>
          <ChatPage
            onTakeScreenshot={handleTakeScreenshot}
            onGetImagePreview={handleGetImagePreview}
            onLogoClick={toggleUserInfo}
            onMessageSent={async () => await usageTracking.trackChatMessage()}
            usageStats={usageTracking.usageStats}
          />
        </ChatProvider>
      </div>
    </div>
  )
} 
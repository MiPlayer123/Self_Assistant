import React from 'react'

interface UsageLimitModalProps {
  isOpen: boolean
  onClose: () => void
  remaining: number
  maxLimit: number
  usageType: string
}

export function UsageLimitModal({ isOpen, onClose, remaining, maxLimit, usageType }: UsageLimitModalProps) {
  if (!isOpen) return null

  const handleUpgrade = () => {
    // Use the existing IPC handler to open wagoo.ai
    if (window.electronAPI?.openSubscriptionPortal) {
      window.electronAPI.openSubscriptionPortal({ id: 'temp', email: 'temp' })
    } else {
      // Fallback for web version
      window.open('https://wagoo.ai', '_blank')
    }
    onClose()
  }

  const getUsageTypeDisplay = (type: string) => {
    switch (type) {
      case 'chat_messages_count': return 'chat messages'
      case 'voice_transcriptions_count': return 'voice transcriptions'
      case 'screen_context_requests': return 'screen captures'
      default: return type
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-lg mx-4 shadow-2xl">
        <div className="text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold mb-3 dark:text-white">Ready to Unlock More?</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4 text-lg">
            You've used all {maxLimit} free {getUsageTypeDisplay(usageType)} for today.
          </p>
          
          {/* Pro Benefits */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">🌟 Pro Benefits:</h3>
            <div className="text-left space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Unlimited chat messages</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Advanced AI models (GPT-4, Claude)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Priority support</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>No daily limits</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleUpgrade}
              className="w-full px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Upgrade to Pro Now
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-sm"
            >
              Continue tomorrow (free plan resets daily)
            </button>
          </div>
          
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Your daily limit resets at midnight
          </p>
        </div>
      </div>
    </div>
  )
} 
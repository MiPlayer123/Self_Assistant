import React, { useState, useEffect } from 'react'

interface FloatingGlassButtonProps {
  isVisible: boolean
  onToggleChat: () => void
}

export const FloatingGlassButton: React.FC<FloatingGlassButtonProps> = ({
  isVisible,
  onToggleChat
}) => {
  const [isHovered, setIsHovered] = useState(false)

  if (!isVisible) return null

  return (
    <div 
      className="fixed bottom-0 right-0 pointer-events-none"
      style={{ 
        width: '68px', 
        height: '68px',
        zIndex: 9998
      }}
    >
      {/* SVG Filter Definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="frosted" primitiveUnits="objectBoundingBox">
            <feImage 
              href="gradient.png"
              x="0" y="0" width="1" height="1" result="map"
            />
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.02" result="blur"/>
            <feDisplacementMap 
              id="disp" 
              in="blur" 
              in2="map" 
              scale={isHovered ? "1.4" : "1"} 
              xChannelSelector="R" 
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Floating Glass Button */}
      <button
        className={`
          absolute bottom-3 right-3
          w-14 h-14 rounded-full
          bg-white/8 border-2 border-transparent
          backdrop-blur-sm
          transition-all duration-300 ease-out
          cursor-pointer outline-none
          flex items-center justify-center
          hover:scale-110
          pointer-events-auto
          ${isHovered ? 'shadow-lg' : 'shadow-md'}
        `}
        style={{
          backdropFilter: 'url(#frosted)',
          WebkitBackdropFilter: 'url(#frosted)',
          boxShadow: `
            0 0 0 2px rgba(255, 255, 255, 0.6),
            0 ${isHovered ? '20px 40px' : '16px 32px'} rgba(0, 0, 0, 0.12)
          `,
          zIndex: 9999
        }}
        onClick={onToggleChat}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title="Toggle Chat Window"
      >
        {/* Plus Icon */}
        <div className="relative">
          <div 
            className="absolute w-5 h-0.5 bg-white rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          />
          <div 
            className="absolute w-0.5 h-5 bg-white rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          />
        </div>
      </button>
    </div>
  )
} 
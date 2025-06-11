import React, { useState, useEffect } from 'react'

export const ButtonWindow: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false)

  // Ensure the body background is transparent for the button window
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent'
    document.body.style.background = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    document.documentElement.style.background = 'transparent'
    
    // Also ensure any potential CSS resets don't interfere
    const style = document.createElement('style')
    style.textContent = `
      * {
        background: rgba(0, 0, 0, 0.3) !important;
      }
      html, body {
        background: transparent !important;
        background-color: transparent !important;
      }
      #root {
        background: transparent !important;
        background-color: transparent !important;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      // Clean up when component unmounts
      document.body.style.backgroundColor = ''
      document.body.style.background = ''
      document.documentElement.style.backgroundColor = ''
      document.documentElement.style.background = ''
      if (style.parentNode) {
        style.parentNode.removeChild(style)
      }
    }
  }, [])

  const handleClick = () => {
    // Use Electron API to toggle the main window
    if (window.electronAPI?.toggleMainWindow) {
      window.electronAPI.toggleMainWindow()
    }
  }

  return (
    <div 
      className="w-full h-full flex items-center justify-center"
      style={{ 
        width: '68px', 
        height: '68px',
        backgroundColor: 'transparent',
        background: 'transparent'
      }}
    >
      {/* SVG Filter Definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="frosted" primitiveUnits="objectBoundingBox">
            <feImage 
              href="renderer/public/gradient.png"
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
          w-14 h-14 rounded-full
          bg-white/8 border-2 border-transparent
          backdrop-blur-sm
          transition-all duration-300 ease-out
          cursor-pointer outline-none
          flex items-center justify-center
          hover:scale-110
          ${isHovered ? 'shadow-lg' : 'shadow-md'}
        `}
        style={{
          backdropFilter: 'url(#frosted)',
          WebkitBackdropFilter: 'url(#frosted)',
          boxShadow: `
            0 0 0 2px rgba(255, 255, 255, 0.6),
            0 ${isHovered ? '20px 40px' : '16px 32px'} rgba(0, 0, 0, 0.12)
          `,
        }}
        onClick={handleClick}
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
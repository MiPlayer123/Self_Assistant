import React, { useState, useEffect } from 'react'
import { isMacOS } from '../../utils/platform'
import { Tooltip } from './Tooltip'

export const ButtonWindow: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true) // Default to dark mode styling

  // Platform-specific shortcuts for tooltips
  const toggleShortcut = isMacOS ? 'Ctrl+B' : 'Alt+B'

  // Sample background color periodically
  useEffect(() => {
    let intervalId: NodeJS.Timeout

    const sampleBackgroundColor = async () => {
      try {
        // Get button window position - assuming it's near bottom right
        const buttonSize = 56
        const margin = 10
        const x = window.screen.width - buttonSize/2 - margin
        const y = window.screen.height - buttonSize/2 - margin

        if (window.electronAPI?.sampleBackgroundColor) {
          const result = await window.electronAPI.sampleBackgroundColor(x, y)
          if (result.success && typeof result.isLight === 'boolean') {
            setIsDarkMode(!result.isLight) // Dark mode when background is light
          }
        }
      } catch (error) {
        console.error('Error sampling background color:', error)
      }
    }

    // Sample immediately and then every 1 second
    sampleBackgroundColor()
    intervalId = setInterval(sampleBackgroundColor, 1000)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [])

  // Ensure the body background is transparent for the button window
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent'
    document.body.style.background = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    document.documentElement.style.background = 'transparent'
    
    // Only make the page background transparent, not all elements
    const style = document.createElement('style')
    style.textContent = `
      html, body {
        background: transparent !important;
        background-color: transparent !important;
        margin: 0;
        padding: 0;
      }
      #root {
        background: transparent !important;
        background-color: transparent !important;
      }
      /* Ensure container divs are transparent but not buttons */
      body > div, #root > div {
        background: transparent !important;
        background-color: transparent !important;
      }
    `
    document.head.appendChild(style)
    
      // Small delay to ensure content is ready after transparency is set
      setTimeout(() => {
        setIsReady(true)
      }, 100)
      
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

  // Dynamic colors based on background
  const buttonColors = {
    background: 'rgba(255, 255, 255, 0.15)',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    plusIcon: isDarkMode ? '#fff' : '#000'
  }

  return (
    <div 
      className="w-full h-full flex items-center justify-center relative"
      style={{ 
        width: '68px', 
        height: '68px',
        backgroundColor: 'transparent',
        background: 'transparent'
      }}
    >

      
      {/* SVG Filter Definition - Using gradient.PNG for liquid displacement effect */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {/* Liquid glass filter using reference implementation */}
          <filter id="frosted" primitiveUnits="objectBoundingBox">
            <feImage href="/gradient.PNG" x="0" y="0" width="1" height="1" result="map"/>
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.02" result="blur"/>
            <feDisplacementMap id="disp" in="blur" in2="map" scale="1" xChannelSelector="R" yChannelSelector="G">
              <animate attributeName="scale" to="1.4" dur="0.3s" begin="glass-btn.mouseover" fill="freeze"/>
              <animate attributeName="scale" to="1" dur="0.3s" begin="glass-btn.mouseout" fill="freeze"/>
            </feDisplacementMap>
          </filter>
          
          {/* Fallback filter without image for visibility */}
          <filter id="frosted-fallback">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
            <feColorMatrix in="blur" type="saturate" values="1.2"/>
          </filter>
        </defs>
      </svg>

      {/* Floating Glass Button */}
      <Tooltip content={`Toggle chat window • ${toggleShortcut}`} position="left">
        <button
          id="glass-btn"
          className={`
            glass-button
            transition-transform duration-300 ease-out
            cursor-pointer outline-none
            ${isReady ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            position: 'relative',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: buttonColors.background,
            border: `2px solid transparent`,
            boxShadow: `
              0 0 0 2px ${buttonColors.border},
              0 ${isHovered ? '20px 40px' : '16px 32px'} rgba(0, 0, 0, 0.12)
            `,
            backdropFilter: 'url(#frosted), blur(10px)',
            WebkitBackdropFilter: 'url(#frosted), blur(10px)',
            display: 'grid',
            placeItems: 'center',
            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
            transition: 'all 0.3s ease-out',
            zIndex: 1,
          }}
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      </Tooltip>

      {/* Add CSS for pseudo-elements with dynamic colors */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .glass-button::before,
          .glass-button::after {
            content: "";
            position: absolute;
            background: ${buttonColors.plusIcon};
            border-radius: 4px;
          }
          .glass-button::before {
            width: 40%;
            height: 3px;
          }
          .glass-button::after {
            width: 3px;
            height: 40%;
          }
        `
      }} />
    </div>
  )
} 
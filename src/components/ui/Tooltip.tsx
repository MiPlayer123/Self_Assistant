import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  delay = 500,
  position = 'top' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = (rect: DOMRect, preferredPosition: 'top' | 'bottom' | 'left' | 'right') => {
    const tooltipWidth = 200; // Estimated tooltip width
    const tooltipHeight = 32; // Estimated tooltip height
    const padding = 8; // Padding from window edges
    const arrowOffset = 8; // Distance from trigger element
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let x = 0;
    let y = 0;
    let finalPosition: 'top' | 'bottom' | 'left' | 'right' = preferredPosition;
    
    // Calculate initial position
    switch (preferredPosition) {
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - arrowOffset;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + arrowOffset;
        break;
      case 'left':
        x = rect.left - arrowOffset;
        y = rect.top + rect.height / 2;
        break;
      case 'right':
        x = rect.right + arrowOffset;
        y = rect.top + rect.height / 2;
        break;
    }
    
    // Check boundaries and adjust position if needed
    
    // For top/bottom positions, check horizontal boundaries
    if (preferredPosition === 'top' || preferredPosition === 'bottom') {
      if (x - tooltipWidth/2 < padding) {
        x = padding + tooltipWidth/2;
      } else if (x + tooltipWidth/2 > windowWidth - padding) {
        x = windowWidth - padding - tooltipWidth/2;
      }
      
      // Check if tooltip would go outside vertical boundaries
      if (preferredPosition === 'top' && y - tooltipHeight < padding) {
        // Switch to bottom
        finalPosition = 'bottom';
        y = rect.bottom + arrowOffset;
      } else if (preferredPosition === 'bottom' && y + tooltipHeight > windowHeight - padding) {
        // Switch to top
        finalPosition = 'top';
        y = rect.top - arrowOffset;
      }
    }
    
    // For left/right positions, check vertical boundaries
    if (preferredPosition === 'left' || preferredPosition === 'right') {
      if (y - tooltipHeight/2 < padding) {
        y = padding + tooltipHeight/2;
      } else if (y + tooltipHeight/2 > windowHeight - padding) {
        y = windowHeight - padding - tooltipHeight/2;
      }
      
      // Check if tooltip would go outside horizontal boundaries
      if (preferredPosition === 'left' && x - tooltipWidth < padding) {
        // Switch to right
        finalPosition = 'right';
        x = rect.right + arrowOffset;
      } else if (preferredPosition === 'right' && x + tooltipWidth > windowWidth - padding) {
        // Switch to left
        finalPosition = 'left';
        x = rect.left - arrowOffset;
      }
    }
    
    return { x, y, position: finalPosition };
  };

  const showTooltip = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { x, y, position: finalPosition } = calculatePosition(rect, position);
    
    setTooltipPosition({ x, y });
    setActualPosition(finalPosition);
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clonedChild = React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      showTooltip(e);
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hideTooltip();
      children.props.onMouseLeave?.(e);
    },
  });

  return (
    <>
      {clonedChild}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: actualPosition === 'top' || actualPosition === 'bottom' 
              ? 'translateX(-50%)' 
              : actualPosition === 'left' 
                ? 'translate(-100%, -50%)' 
                : 'translateY(-50%)',
            zIndex: 9999
          }}
        >
          <div
            className="px-2 py-1 text-xs font-medium text-white rounded-md shadow-lg max-w-xs break-words whitespace-nowrap tooltip-animation"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {content}
            {/* Arrow */}
            <div
              className="absolute"
              style={{
                width: 0,
                height: 0,
                ...(actualPosition === 'top' && {
                  bottom: '-4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '4px solid rgba(0, 0, 0, 0.9)',
                }),
                ...(actualPosition === 'bottom' && {
                  top: '-4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderBottom: '4px solid rgba(0, 0, 0, 0.9)',
                }),
                ...(actualPosition === 'left' && {
                  right: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  borderTop: '4px solid transparent',
                  borderBottom: '4px solid transparent',
                  borderLeft: '4px solid rgba(0, 0, 0, 0.9)',
                }),
                ...(actualPosition === 'right' && {
                  left: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  borderTop: '4px solid transparent',
                  borderBottom: '4px solid transparent',
                  borderRight: '4px solid rgba(0, 0, 0, 0.9)',
                }),
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}; 
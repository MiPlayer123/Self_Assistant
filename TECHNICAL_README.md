# Wagoo - Technical Architecture Guide

## Overview
An Electron-based desktop application that provides AI-powered coding assistance while remaining invisible to screen capture software. Built with React/TypeScript frontend and Node.js backend integration.

## Core Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Desktop**: Electron 29 + Native APIs
- **UI**: Tailwind CSS + Radix UI Components
- **State**: TanStack Query for API state management
- **Backend**: Node.js API endpoints + Supabase
- **AI**: OpenAI API integration

## Key Implementation Concepts

### 1. Window Invisibility System
```typescript
// Uses Electron's window properties to bypass screen capture
const mainWindow = new BrowserWindow({
  transparent: true,
  frame: false,
  skipTaskbar: true,
  alwaysOnTop: true
})
```
- **Transparent window** with custom frame
- **Always on top** positioning
- **Skip taskbar** to avoid detection
- Platform-specific optimizations for capture avoidance

### 1.1 Window Invisibility Details
The window remains invisible to screen sharing (e.g. Zoom, Discord, browser-based capture) by leveraging Electron's transparent window properties. In our implementation, the main window is created with a transparent background (transparent: true) and a frameless (frame: false) design. In addition, the window is set to "always on top" (alwaysOnTop: true) and skips the taskbar (skipTaskbar: true). These properties, combined with platform-specific tweaks (for example, on macOS, the window's layer is set to a "capture-avoiding" layer), ensure that most screen capture software (including Zoom versions below 6.1.6, Discord, and browser-based capture) cannot "see" the window. 

```typescript
// (Example snippet for macOS – additional tweaks in production)
if (process.platform === "darwin") {
  // On macOS, set the window's layer to a capture-avoiding layer
  // (e.g. using NSWindow's setCollectionBehavior or similar native calls)
  // (In production, additional native tweaks are applied.)
}
```

### 2. Native Screenshot Capture
```typescript
// Platform-specific screenshot implementations
async captureScreenshotMac(): Promise<Buffer> {
  await execFileAsync("screencapture", ["-x", tmpPath])
}

async captureScreenshotWindows(): Promise<Buffer> {
  // PowerShell bitmap capture implementation
}
```
- **Native system calls** (screencapture on macOS, PowerShell on Windows)
- **Buffer-based** image handling
- **Queue management** (max 2 screenshots per queue)

### 3. Global Shortcut System
```typescript
globalShortcut.register("CommandOrControl+H", async () => {
  // Screenshot capture with window hiding
  hideMainWindow()
  const screenshotPath = await takeScreenshot()
  showMainWindow()
})
```
- **Cross-platform shortcuts** using Electron's globalShortcut
- **Async operation handling** with proper cleanup
- **Window state management** during operations

### 4. AI Processing Pipeline
```typescript
// Multi-step AI processing workflow
1. Screenshot Analysis → /api/extract
2. Problem Extraction → Cache problem data
3. Solution Generation → /api/generate  
4. Debug Analysis → /api/debug (optional)
```

## Core Components

### Frontend Architecture

#### State Management Pattern
```typescript
// TanStack Query for API state + local state for UI
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, gcTime: Infinity }
  }
})

// Key queries: ["problem_statement"], ["solution"], ["new_solution"]
```

#### View State Machine
```
Queue View → Solutions View → Debug View
     ↑           ↓              ↓
     ←---------Reset-----------←
```

#### Component Structure
- **Queue.tsx**: Screenshot capture and management
- **Solutions.tsx**: AI-generated solutions display  
- **Debug.tsx**: Code debugging interface
- **ScreenshotHelper**: Native screenshot operations
- **ProcessingHelper**: AI API coordination

### Backend Integration

#### IPC Communication Pattern
```typescript
// Preload script exposes safe APIs
contextBridge.exposeInMainWorld("electronAPI", {
  triggerScreenshot: () => ipcRenderer.invoke("trigger-screenshot"),
  onSolutionSuccess: (callback) => {
    ipcRenderer.on("solution-success", callback)
    return () => ipcRenderer.removeListener("solution-success", callback)
  }
})
```

#### Event-Driven Architecture
```typescript
// Main process event coordination
PROCESSING_EVENTS = {
  SOLUTION_START: "solution-start",
  PROBLEM_EXTRACTED: "problem-extracted", 
  SOLUTION_SUCCESS: "solution-success",
  DEBUG_SUCCESS: "debug-success"
}
```

## Product Flow

### 1. Initialization
```
App Launch → Auth Check → Credit Sync → Global Shortcuts Registration
```

### 2. Core Workflow
```
Screenshot (Cmd+H) → Queue Display → Process (Cmd+Enter) → 
AI Analysis → Solutions Display → Debug (Optional) → Reset (Cmd+R)
```

### 3. Data Flow
```
Native Screenshot → Base64 Encoding → API Request → 
AI Processing → Response Caching → UI Update
```

## Key Implementation Details

### Screenshot Queue Management
```typescript
class ScreenshotHelper {
  private screenshotQueue: string[] = []
  private extraScreenshotQueue: string[] = []
  private readonly MAX_SCREENSHOTS = 2
  
  // Automatic cleanup when queue exceeds limit
  // Separate queues for different view states
}
```

### API Integration Pattern
```typescript
// Retry logic with abort controllers
private currentProcessingAbortController: AbortController | null = null

async processScreenshots() {
  this.currentProcessingAbortController = new AbortController()
  const response = await axios.post(url, data, { 
    signal: this.currentProcessingAbortController.signal 
  })
}
```

### Error Handling Strategy
- **Graceful degradation** for API failures
- **User feedback** via toast notifications  
- **State recovery** mechanisms
- **Request cancellation** support

## Development Setup

### Prerequisites
```bash
Node.js 16+, npm/bun, OpenAI API key
```

### Build System
```bash
npm run dev    # Vite dev server + Electron hot reload
npm run build  # Production build with electron-builder
```

### Environment Configuration
```typescript
// Development vs Production API endpoints
const API_BASE_URL = isDev 
  ? "http://localhost:3000" 
  : "https://www.interviewcoder.co"
```

## Deployment Architecture

### Cross-Platform Building
```javascript
// electron-builder configuration
"mac": { "target": ["dmg", "zip"], "arch": ["x64", "arm64"] },
"win": { "target": ["nsis"] },
"linux": { "target": ["AppImage"] }
```

### Security Features
- **Code signing** and notarization for macOS
- **Hardened runtime** for security compliance
- **ASAR packaging** for code protection

## Extension Points

### Adding New AI Providers
```typescript
// Extend ProcessingHelper with new API endpoints
async processWithProvider(provider: 'openai' | 'claude' | 'custom') {
  const endpoint = this.getProviderEndpoint(provider)
  // Standardized request/response handling
}
```

### Custom Screenshot Sources
```typescript
// Extend ScreenshotHelper for new capture methods
async captureFromSource(source: 'screen' | 'window' | 'region') {
  // Platform-specific implementation
}
```

### UI Themes/Customization
```typescript
// Tailwind-based theming system
// Radix UI component overrides
// CSS variable-based customization
```

This architecture provides a solid foundation for building similar AI-assisted desktop applications with invisibility features, native integrations, and complex state management requirements. 
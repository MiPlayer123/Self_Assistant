# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wagoo is an Electron-based desktop AI assistant application that features an invisible window overlay for seamless AI interaction. The app provides chat functionality with multiple AI model providers (OpenAI, Anthropic, Google) and includes local model support via node-llama-cpp.

## Development Commands

### Core Development
- `npm run dev` - Start development server with hot reload (Vite + Electron)
- `npm run build` - Build production version with TypeScript compilation
- `npm run build:release` - Build for release without publishing
- `npm run package:all` - Package for all platforms (Mac, Windows, Linux)
- `npm run clean` - Clean dist and dist-electron directories

### Development Server
- Development server runs on `http://localhost:54321`
- Uses Vite for React frontend with TypeScript
- Electron main process compiles separately via `tsc`

## Architecture Overview

### Multi-Process Structure
- **Main Process** (`electron/main.ts`): Core Electron app, window management, screen capture resistance
- **Renderer Process** (`src/App.tsx`): React frontend with chat interface
- **Button Window**: Small floating 68x68px window for quick access

### Key Components

#### Window Management
- **Main Window**: Invisible/semi-transparent chat interface (450x600px)
- **Button Window**: Small floating button for window control
- Screen capture resistance with `setContentProtection(true)`
- Global keyboard shortcuts for window control and screenshots

#### Authentication & Data
- Supabase for authentication and user data
- PKCE-based OAuth flow with deep linking (`wagoo://` protocol)
- Real-time subscription updates via Supabase channels
- Offline mode support with cached subscription data

#### AI Model System
- **ModelManager** (`src/models/ModelManager.ts`): Factory for chat models
- Multiple providers: OpenAI, Anthropic (Claude), Google (Gemini), Local
- Local models via node-llama-cpp with worker threads
- Provider-specific chat model implementations in `src/models/providers/`

#### Core Features
- **Chat Interface**: Multi-model AI conversations
- **Screenshot Capture**: Global hotkeys for screen capture
- **Usage Tracking**: Credits and subscription management  
- **Offline Support**: Cached models and subscription data

### File Structure
```
src/
├── components/          # React components
│   ├── chat/           # Chat-specific components
│   ├── ui/             # Reusable UI components
│   └── shared/         # Shared components
├── models/             # AI model management
│   ├── providers/      # Provider-specific implementations
│   └── base/           # Base model interfaces
├── hooks/              # React hooks
├── contexts/           # React contexts
├── lib/                # Utilities and configurations
├── services/           # External service integrations
└── types/              # TypeScript type definitions

electron/
├── main.ts             # Main Electron process
├── preload.ts          # Preload script for IPC
├── ipcHandlers.ts      # IPC communication handlers
└── *Helper.ts          # Various helper classes
```

## Environment Configuration

Required environment variables in `.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_OPENAI_API_KEY` - OpenAI API key
- `VITE_ANTHROPIC_API_KEY` - Anthropic API key
- `VITE_GOOGLE_API_KEY` - Google AI API key

## Key Technical Details

### Screen Capture Resistance
- Windows use `setContentProtection(true)` to prevent screen recording
- `alwaysOnTop` with "screen-saver" level
- `skipTaskbar` and `setHiddenInMissionControl` on macOS
- Transparent windows with careful opacity management

### IPC Communication
- Extensive IPC handlers in `electron/ipcHandlers.ts`
- Environment variable access via `getEnvVar` IPC
- Model management and chat operations through IPC
- Screenshot and window control operations

### Build System
- Vite for frontend bundling
- TypeScript compilation for Electron main process
- electron-builder for packaging across platforms
- Separate tsconfig files for different targets

### Local Model Integration
- node-llama-cpp for local inference
- Worker thread isolation for model operations
- Model file management and loading
- Performance optimization for local inference

## Development Guidelines

### Code Organization
- Use TypeScript throughout
- React with functional components and hooks
- Contexts for global state management
- Separate concerns between Electron and React code

### Model System
- Always use ModelManager for model instantiation
- Handle API key retrieval through `getApiKey()` helper
- Support graceful fallbacks for unavailable models
- Local models should handle loading states properly

### Window Management
- Respect screen capture resistance requirements
- Use proper IPC for window operations
- Handle window state persistence
- Support multi-monitor setups

### Authentication
- Use Supabase hooks for auth state
- Handle PKCE flow properly with deep links
- Support offline authentication caching
- Real-time subscription updates via channels
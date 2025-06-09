# Wagoo: General-Purpose AI Assistant Overlay

## 1. Introduction to Wagoo

**Wagoo** is a context-aware AI assistant that sits invisibly on top of your screen, providing intelligent help across any application or workflow. Unlike traditional chatbots, Wagoo combines visual context (screenshots), multi-modal AI backends, and flexible prompt flows to assist with everything from email drafting to code reviews to general questions.

### Core Features
- **Invisible Overlay**: Hotkey-activated, non-intrusive interface that appears over any application
- **Multi-Model Support**: Seamlessly switch between OpenAI, Claude, local LLMs, and custom models
- **Context-Aware**: Automatic screenshot capture with optional voice input for rich context
- **Unified Chat Interface**: Single conversation view that handles multiple task types and flows
- **Extensible Prompt Flows**: Pre-built templates for common tasks (email summary, code review, general chat)
- **Cross-Platform**: Native Electron app with platform-specific optimizations

### Use Cases
- **Email Management**: "Summarize this email thread" or "Draft a professional reply"
- **Code Assistance**: "Explain this error" or "Review this function"
- **Content Creation**: "Help me write a presentation about X"
- **Screen Analysis**: "What's happening in this interface?" or "How do I use this software?"
- **General Knowledge**: Traditional AI chat with visual context

---

## 2. Component Migration Plan

The transformation from Interview Coder to Wagoo requires restructuring the codebase into modular, extensible components. Here's the detailed migration strategy:

### 2.1 Platform APIs Extraction

**Current State**: Platform-specific code scattered across `electron/` directory
**Target**: Centralized `platform/` package for cross-platform compatibility

```
src/platform/
├── screenshot/
│   ├── ScreenshotHelper.ts          # Migrated from electron/ScreenshotHelper.ts
│   ├── types.ts                     # Screenshot-related types
│   └── index.ts                     # Public API exports
├── processing/
│   ├── ProcessingHelper.ts          # Migrated from electron/ProcessingHelper.ts
│   ├── types.ts                     # Processing pipeline types
│   └── index.ts
├── shortcuts/
│   ├── shortcuts.ts                 # Migrated from electron/shortcuts.ts
│   ├── types.ts                     # Hotkey configuration types
│   └── index.ts
├── ipc/
│   ├── handlers.ts                  # Migrated from electron/ipcHandlers.ts
│   ├── channels.ts                  # IPC channel definitions
│   ├── types.ts                     # IPC message types
│   └── index.ts
└── index.ts                         # Main platform API exports
```

**Migration Steps**:
1. Extract and generalize `ScreenshotHelper.ts` - remove Interview Coder specific logic
2. Refactor `ProcessingHelper.ts` to support multiple AI models and prompt flows
3. Update `shortcuts.ts` to handle global hotkeys for Wagoo activation
4. Restructure `ipcHandlers.ts` for unified communication patterns
5. Create TypeScript interfaces for platform abstraction

**Code Changes**:
- Replace hardcoded Interview Coder references with configurable flow parameters
- Add model abstraction layer in processing pipeline
- Implement screenshot region selection for targeted context capture

### 2.2 Model Adapter Layer

**Current State**: Hardcoded AI service integration
**Target**: Pluggable model architecture supporting multiple providers

```
src/models/
├── base/
│   ├── BaseModel.ts                 # Abstract base class for all models
│   ├── types.ts                     # Common model interfaces
│   └── errors.ts                    # Model-specific error handling
├── providers/
│   ├── openai/
│   │   ├── OpenAIModel.ts           # OpenAI GPT integration
│   │   ├── config.ts                # API configuration
│   │   └── types.ts                 # OpenAI-specific types
│   ├── anthropic/
│   │   ├── ClaudeModel.ts           # Claude integration
│   │   ├── config.ts
│   │   └── types.ts
│   ├── local/
│   │   ├── LocalModel.ts            # Local LLM integration (Ollama, etc.)
│   │   ├── config.ts
│   │   └── types.ts
│   └── custom/
│       ├── CustomModel.ts           # User-defined model endpoints
│       └── types.ts
├── ModelManager.ts                  # Model selection and lifecycle management
├── ModelRegistry.ts                 # Dynamic model registration
└── index.ts
```

**Integration Points**:
- Update `ProcessingHelper.ts` to use `ModelManager` instead of direct API calls
- Add model selection UI component in chat interface
- Implement model-specific prompt formatting and response parsing

### 2.3 Prompt Flow Engine

**Current State**: Hardcoded interview-specific prompts
**Target**: Flexible flow system for different task types

```
src/flows/
├── base/
│   ├── BaseFlow.ts                  # Abstract flow class
│   ├── FlowManager.ts               # Flow execution and state management
│   ├── types.ts                     # Flow interfaces and types
│   └── utils.ts                     # Common flow utilities
├── templates/
│   ├── generalChat/
│   │   ├── GeneralChatFlow.ts       # Generic AI conversation
│   │   ├── prompts.ts               # Chat-specific prompts
│   │   └── config.ts                # Flow configuration
│   ├── emailSummary/
│   │   ├── EmailSummaryFlow.ts      # Email analysis and summarization
│   │   ├── prompts.ts
│   │   └── config.ts
│   ├── codeReview/
│   │   ├── CodeReviewFlow.ts        # Code analysis and suggestions
│   │   ├── prompts.ts
│   │   └── config.ts
│   ├── screenAnalysis/
│   │   ├── ScreenAnalysisFlow.ts    # UI/screen content analysis
│   │   ├── prompts.ts
│   │   └── config.ts
│   └── custom/
│       ├── CustomFlow.ts            # User-defined flows
│       └── templates/               # User flow templates
├── FlowRegistry.ts                  # Dynamic flow registration
├── FlowExecutor.ts                  # Flow execution engine
└── index.ts
```

**Integration Strategy**:
- Replace hardcoded prompts in `ProcessingHelper.ts` with flow-based system
- Add flow selection UI in chat interface
- Implement flow context passing (screenshot, voice, text input)

### 2.4 UI Refactor: Single Chat Interface

**Current State**: Separate `Queue.tsx`, `Solutions.tsx`, `Debug.tsx` pages
**Target**: Unified `ChatPage.tsx` with context-aware conversations

```
src/components/chat/
├── ChatPage.tsx                     # Main unified chat interface
├── ChatHeader.tsx                   # Model/flow selection, settings
├── ChatMessages.tsx                 # Message history display
├── ChatInput.tsx                    # Multi-modal input (text, voice, screenshot)
├── FlowSelector.tsx                 # Quick flow template selection
├── ModelSelector.tsx                # AI model switching
├── ContextPanel.tsx                 # Current context display (screenshot, etc.)
└── types.ts                         # Chat-specific types
```

**Migration from Existing Pages**:

| Current Component | New Component | Migration Notes |
|------------------|---------------|-----------------|
| `Queue.tsx` | `ChatMessages.tsx` | Extract message list logic, remove queue-specific state |
| `Solutions.tsx` | `ChatMessages.tsx` + `ContextPanel.tsx` | Move solution display to message bubbles, context to side panel |
| `Debug.tsx` | `ChatPage.tsx` (debug mode) | Integrate debug info as overlay or side panel |

**State Management Updates**:
```typescript
// src/contexts/ChatContext.tsx
interface ChatState {
  messages: ChatMessage[]
  currentFlow: FlowType
  selectedModel: ModelType
  context: ContextData
  isProcessing: boolean
}

interface ContextData {
  screenshot?: ScreenshotData
  voice?: VoiceData
  selectedText?: string
  applicationContext?: AppContext
}
```

### 2.5 State & Types Reorganization

**Current State**: Minimal state management in `contexts/`
**Target**: Comprehensive state architecture for multi-modal chat

```
src/contexts/
├── ChatContext.tsx                  # Main chat state management
├── ModelContext.tsx                 # Model selection and configuration
├── FlowContext.tsx                  # Active flow state
├── PlatformContext.tsx              # Platform-specific state
├── SettingsContext.tsx              # User preferences and configuration
└── index.ts                         # Context providers composition

src/types/
├── chat.ts                          # Chat message and conversation types
├── models.ts                        # AI model interfaces
├── flows.ts                         # Flow definition types
├── platform.ts                      # Platform-specific types
├── context.ts                       # Context data types
└── index.ts                         # Type exports
```

**Key Type Definitions**:
```typescript
// Enhanced message structure
interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: Date
  context?: ContextData
  flow?: FlowType
  model?: ModelType
  metadata?: MessageMetadata
}

// Flow configuration
interface FlowConfig {
  id: string
  name: string
  description: string
  prompts: PromptTemplate[]
  requiredContext: ContextType[]
  supportedModels: ModelType[]
}
```

---

## 3. Future Steps & Suggestions

### 3.1 Next Milestones

#### Phase 1: Core Migration (Weeks 1-2)
- [ ] Extract platform APIs to `src/platform/`
- [ ] Implement basic model adapter layer
- [ ] Create unified `ChatPage.tsx` component
- [ ] Set up basic flow system with `generalChat` template

#### Phase 2: Enhanced Features (Weeks 3-4)
- [ ] Add voice input/output integration
- [ ] Implement screenshot region selection
- [ ] Create additional flow templates (email, code review)
- [ ] Add model switching UI

#### Phase 3: Polish & Extension (Weeks 5-6)
- [ ] Implement theming system
- [ ] Add auto-update mechanism
- [ ] Create user onboarding flow
- [ ] Performance optimization and testing

### 3.2 Creative Improvements & Extensions

#### Plugin Architecture
```
src/plugins/
├── base/
│   ├── Plugin.ts                    # Plugin interface
│   ├── PluginManager.ts             # Plugin lifecycle management
│   └── types.ts
├── builtin/
│   ├── calendar/                    # Calendar integration plugin
│   ├── browser/                     # Browser automation plugin
│   └── files/                       # File system operations plugin
└── custom/                          # User-installed plugins
```

#### Advanced Context Capture
- **Region-based Screenshots**: Allow users to select specific screen regions
- **Application State Extraction**: Deep integration with specific apps (VS Code, browsers)
- **Temporal Context**: Remember conversation history and context across sessions
- **Multi-display Support**: Handle multiple monitors intelligently

#### Analytics & Learning
```
src/analytics/
├── UsageTracker.ts                  # Usage pattern analysis
├── FlowOptimizer.ts                 # Suggest better flows based on usage
├── ModelPerformance.ts              # Track model effectiveness
└── PrivacyManager.ts                # GDPR-compliant data handling
```

#### Advanced UI Features
- **Floating Widget Mode**: Minimal always-visible overlay
- **Quick Actions**: Hotkey-triggered instant commands
- **Context-Aware Suggestions**: Proactive assistance based on screen content
- **Multi-language Support**: Internationalization framework

### 3.3 Technical Considerations

#### Performance Optimizations
- **Lazy Loading**: Load flows and models on demand
- **Caching**: Intelligent context and response caching
- **Background Processing**: Non-blocking AI model inference
- **Memory Management**: Efficient handling of large screenshots and audio

#### Security & Privacy
- **Local-First Option**: Ensure all processing can happen locally
- **Data Encryption**: Encrypt sensitive context data
- **Permission System**: Granular control over app access and data sharing
- **Audit Logging**: Track data usage for compliance

#### Cross-Platform Considerations
- **Platform-Specific Shortcuts**: Respect OS conventions
- **Native Integrations**: Leverage platform-specific APIs where beneficial
- **Accessibility**: Support screen readers and keyboard navigation
- **System Integration**: Proper app lifecycle management

---

## Implementation Strategy

1. **Start Small**: Begin with basic chat interface and one AI model
2. **Iterate Quickly**: Get core functionality working before adding advanced features
3. **Test Early**: Create automated tests for platform APIs and core flows
4. **User Feedback**: Deploy beta versions to gather real-world usage patterns
5. **Document Everything**: Maintain clear documentation for extensibility

This migration transforms a specialized interview coding assistant into a flexible, extensible AI overlay that can adapt to any workflow while maintaining the robust platform integration and user experience of the original application. 
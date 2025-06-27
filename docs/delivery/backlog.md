# Product Backlog

| ID | Actor | User Story | Status | Conditions of Satisfaction (CoS) |
|----|-------|------------|--------|-----------------------------------|
| PBI-001 | User | As a user, I want a modern, dark translucent UI theme inspired by professional design principles so that the application has a professional Wagoo interface with bottom-right positioning and proper resizability | Agreed | - Window positioned at bottom-right of screen<br>- Dark translucent background with white text<br>- Unified, modular CSS system<br>- All chat components styled consistently<br>- Window properly resizable<br>- All existing functionality preserved |
| PBI-002 | User | As a user, I want enhanced chat interaction features including a floating glass button and advanced window controls so that I have a more Wagoo-like interface with easy access and beautiful liquid glass styling | Agreed | - Floating glass button with Apple's liquid glass UI styling<br>- Always visible mini icon in bottom-right corner<br>- Ctrl+B hides chat menu, Ctrl+Shift+B hides button entirely<br>- Button allows minimize/restore of chat window<br>- Smooth animations and transitions<br>- Maintains existing keyboard shortcuts<br>- Professional glass morphism design |
| PBI-003 | User | As a user, I want to run a local LLM so that I can use the application offline and ensure data privacy | Proposed | - Application runs inference with a locally hosted LLM<br>- User can select and configure local models from the UI<br>- Core application features (problem extraction, solution generation, debugging) work with local models<br>- Performance is acceptable for local inference<br>- Clear instructions for local model setup and download are provided |
| PBI-004 | User | As a user, I want offline access for subscribed users so that paid users can use the app without internet while free users are prompted to upgrade | Proposed | - Free users see "No internet, go online or upgrade for offline access" screen<br>- Subscribed users get offline notification and can use app fully offline<br>- Local subscription cache persists subscription status when offline<br>- App defaults to local model when offline<br>- Clear differentiation between free and paid offline experiences<br>- Subscription expiry handling in offline mode |

## PBI History

- **2024-12-19 20:30** - PBI-001 - create_pbi - Created new PBI for Wagoo UI theme updates - User
- **2024-12-19 20:35** - PBI-001 - propose_for_backlog - Proposed -> Agreed - PBI approved for implementation - User 
- **2024-12-19 22:45** - PBI-002 - create_pbi - Created new PBI for enhanced chat interaction features with floating glass button - User
- **2024-12-19 22:50** - PBI-002 - propose_for_backlog - Proposed -> Agreed - PBI approved for implementation with floating glass button and enhanced window controls - User
- **2024-05-22 10:00** - PBI-003 - create_pbi - Created new PBI for local LLM integration - AI_Agent
- **2025-01-03 18:00** - PBI-004 - create_pbi - Created new PBI for offline access implementation with subscription-based differentiation - AI_Agent
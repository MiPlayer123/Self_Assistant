# Wagoo Keyboard Shortcuts

This document provides a comprehensive list of all keyboard shortcuts available in Wagoo, organized by function and platform.

## Platform-Specific Modifiers

| Platform | General Actions | Window Movement | Toggle Window |
|----------|-----------------|-----------------|---------------|
| **macOS** | `Ctrl` | `Ctrl + Option` | `Ctrl` |
| **Windows/Linux** | `Alt` | `Alt` | `Alt` |

## Shortcut Categories

### 📸 Screenshot Management

| Action | macOS | Windows/Linux | Description |
|--------|-------|---------------|-------------|
| **Take Screenshot** | `Ctrl + H` | `Alt + H` | Captures a screenshot and adds it to the queue for analysis |
| **Send Message** | `Ctrl + Enter` | `Alt + Enter` | Sends the current message or screenshot (equivalent to clicking the send button) |

### 🔄 Application Control

| Action | macOS | Windows/Linux | Description |
|--------|-------|---------------|-------------|
| **Reset/Clear** | `Ctrl + R` | `Alt + R` | Cancels ongoing requests and clears all screenshot queues |
| **Toggle Window** | `Ctrl + B` | `Alt + B` | Shows/hides the Wagoo window (works even when hidden) |
| **Hide Floating Button** | `Ctrl + Shift + B` | `Alt + Shift + B` | Toggles floating glass button visibility |

### 🪟 Window Movement

| Action | macOS | Windows/Linux | Description |
|--------|-------|---------------|-------------|
| **Move Left** | `Ctrl + Option + ←` | `Alt + ←` | Moves the window to the left |
| **Move Right** | `Ctrl + Option + →` | `Alt + →` | Moves the window to the right |
| **Move Up** | `Ctrl + Option + ↑` | `Alt + ↑` | Moves the window up |
| **Move Down** | `Ctrl + Option + ↓` | `Alt + ↓` | Moves the window down |

## Behavior Rules

### 🔍 Window Visibility
- **When Window is Visible**: All shortcuts are active and functional
- **When Window is Hidden**: All shortcuts are disabled except for `Toggle Window`
- **Exception**: `Ctrl/Alt + B` (Toggle Window) always works to bring back the window

### 🎯 Quick Reference

#### Most Common Actions
```
Take Screenshot:     Ctrl+H (Mac) / Alt+H (Win/Linux)
Send Message:        Ctrl+Enter (Mac) / Alt+Enter (Win/Linux)
Toggle Window:       Ctrl+B (Mac) / Alt+B (Win/Linux)
Hide Float Button:   Ctrl+Shift+B (Mac) / Alt+Shift+B (Win/Linux)
Reset Everything:    Ctrl+R (Mac) / Alt+R (Win/Linux)
```

#### Window Positioning
```
Move Window:  Ctrl+Option+Arrow Keys (Mac) / Alt+Arrow Keys (Win/Linux)
```

## Workflow Examples

### Basic Chat Interaction
1. `Ctrl/Alt + H` - Take a screenshot (optional)
2. Type your message in the chat input
3. `Ctrl/Alt + Enter` - Send the message and get AI response

### Quick Window Management
1. `Ctrl/Alt + B` - Hide the window when not needed
2. `Ctrl/Alt + B` - Show the window again
3. `Cmd/Alt + Arrow Keys` - Position the window where you want it

### Reset and Start Over
1. `Ctrl/Alt + R` - Clear all queues and reset the application
2. Start fresh with new screenshots

## Technical Notes

- **Global Shortcuts**: All shortcuts work system-wide, even when Wagoo is not the active application
- **Window Focus**: Shortcuts automatically bring Wagoo to focus when executed (except when hidden)
- **Screenshot Queue**: Multiple screenshots can be taken before processing
- **Instant Reset**: The reset command immediately cancels any ongoing AI processing
- **Platform Detection**: Modifiers are automatically detected based on your operating system

## Troubleshooting

### Shortcuts Not Working
1. **Check Window State**: Most shortcuts only work when the window is visible
2. **Try Toggle**: Use `Ctrl/Alt + B` to ensure the window is shown
3. **Restart Application**: If shortcuts stop responding, restart Wagoo

### Conflicts with Other Applications
- If shortcuts conflict with other apps, you can temporarily disable them by hiding the Wagoo window
- The only global shortcut that remains active when hidden is the toggle command

## Chat Interface

In addition to global shortcuts, the chat interface supports:
- **Enter**: Send message
- **Shift + Enter**: New line in message
- **📸 Button**: Take screenshot (same as `Ctrl/Alt + H`)
- **↑ Button**: Send message

---

*Last updated: 2024-12-19*
*Wagoo Version: 1.0.18* 
# PBI-005: Browser-based Deep-Link Login

## Overview
Enable users to authenticate via their default web browser and return to the Wagoo Electron app with a secure PKCE session, improving trust and leveraging existing browser cookies.

## Problem Statement
Current in-window OAuth flow can look unfamiliar and may suffer from embedded-browser limitations. A native-browser flow is more secure, recognisable, and avoids CAPTCHA / third-party blockers that disallow embedded views.

## User Stories
* As a user, I want to click "Log in with browser" so that the familiar Google OAuth page opens in my default browser.
* As a user, after finishing login, I expect Wagoo to reopen (or focus) and show me as authenticated without additional steps.

## Technical Approach
1. Switch Supabase auth flow to PKCE with `redirectTo = wagoo://auth/callback`.
2. Register `wagoo://` protocol in Electron main process (macOS, Windows, Linux).
3. On deep link, main process sends `auth-callback` IPC with the auth code to renderer.
4. Renderer exchanges code for session via `supabase.auth.exchangeCodeForSession`.
5. Replace current Google button with a new one that launches the OAuth URL in `shell.openExternal`.

## UX/UI Considerations
* New single primary button: "Continue with Google in browser".
* While waiting for callback, show spinner and hint: "Complete login in your browser...".

## Acceptance Criteria
- Clicking the button opens default browser with Google consent screen.
- After successful login the app is focused and shows authenticated state.
- Works on macOS, Windows, and Linux packaged builds.
- No access or refresh tokens appear in deep-link URL.
- Existing offline/usage-tracking flows remain unaffected.

## Dependencies
Supabase JS ≥ 2.39 (supports `exchangeCodeForSession`).

## Open Questions
None at this time.

## Related Tasks
See tasks.md. 
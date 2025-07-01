# Tasks for PBI 005: Browser-based Deep-Link Login

**Parent PBI**: [PBI-005: Browser-based Deep-Link Login](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
|---------|------|--------|-------------|
| PBI-005-1 | Register `wagoo://` protocol & deep-link handler | Done | Add protocol registration, single-instance handling, and IPC emit `auth-callback`. |
| PBI-005-2 | OAuth URL launcher & PKCE session exchange | Done | Call Supabase to get auth URL, open in default browser, receive `auth-callback` in renderer, run `exchangeCodeForSession`. |
| PBI-005-3 | Replace login button UI | InReview | Swap existing Google button for new "Continue with Google in browser" variant and waiting spinner. | 
# Windows Protocol Handling Guide

## Overview
This guide addresses Windows-specific issues with custom protocol handling (`wagoo://`) for authentication flow.

## Issues Identified

### 1. Code Signing Requirements
**Production**: Windows requires signed executables for reliable custom protocol registration. Without signing:
- Registry entries may not be created properly
- Windows may block or warn about unsigned executables
- Protocol handlers may fail silently

**Development**: Can work without signing but requires proper configuration.

### 2. Protocol Registration Logic
The original logic had several issues:
- Incorrect URL parsing using `commandLine.pop()`
- Missing null checks for command line arguments
- Insufficient logging for debugging

### 3. Development vs Production Differences
Different handling needed for:
- Development: Running with `electron.exe`
- Production: Running as built `.exe`

## Solutions Implemented

### 1. Enhanced Protocol Registration
```typescript
// Fixed Windows protocol registration
if (process.platform === "win32") {
  if (process.defaultApp) {
    // Development mode - when running with electron.exe
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("wagoo", process.execPath, [
        path.resolve(process.argv[1])
      ])
    }
  } else {
    // Production mode - when running as built exe
    app.setAsDefaultProtocolClient("wagoo")
  }
}
```

### 2. Robust URL Parsing
```typescript
// Enhanced URL finding logic
const protocolUrl = commandLine.find((arg) => 
  arg && typeof arg === 'string' && arg.startsWith("wagoo://")
)
```

### 3. Improved Error Handling
- Added comprehensive logging
- Better null checks
- Enhanced debugging information

## Testing Steps

### Development Mode Testing
1. Start the app in development:
   ```bash
   npm run dev
   ```

2. Test protocol registration:
   ```bash
   # Windows Command Prompt
   start wagoo://auth/callback?code=test123
   
   # Or PowerShell
   Start-Process "wagoo://auth/callback?code=test123"
   ```

3. Check console logs for:
   - Protocol registration attempts
   - URL parsing results
   - Event handling

### Production Mode Testing
1. Build the app:
   ```bash
   npm run build:win
   ```

2. Install the built executable

3. Test protocol handling:
   ```bash
   start wagoo://auth/callback?code=test123
   ```

## Troubleshooting

### Protocol Not Working in Development
1. Check console logs for protocol registration
2. Verify `process.defaultApp` is true
3. Ensure correct command line arguments

### Protocol Not Working in Production
1. **Code Signing Required**: For reliable production use, you need to sign your executable
2. Check Windows Registry for protocol registration
3. Verify executable permissions

### Registry Verification
Check if protocol is registered in Windows Registry:
```
HKEY_CURRENT_USER\SOFTWARE\Classes\wagoo
HKEY_LOCAL_MACHINE\SOFTWARE\Classes\wagoo
```

## Code Signing Solutions

### Option 1: Self-Signed Certificate (Development)
```bash
# Create self-signed certificate
makecert -r -pe -n "CN=Wagoo" -ss my -sr CurrentUser -a sha256 -cy authority -sky signature -sv wagoo.pvk wagoo.cer
```

### Option 2: Commercial Certificate (Production)
Purchase from providers like:
- DigiCert
- GlobalSign
- Sectigo

### Option 3: Windows Store Distribution
Publish through Microsoft Store (automatically signed)

## Configuration Updates

### Package.json Changes
```json
{
  "win": {
    "signAndEditExecutable": false,
    "forceCodeSigning": false,
    "protocols": {
      "name": "wagoo-protocol",
      "schemes": ["wagoo"]
    }
  }
}
```

## Authentication Flow Testing

### 1. Manual Browser Test
1. Open browser to: `https://www.wagoo.ai/login?redirectTo=wagoo://auth/callback`
2. Complete login
3. Browser should prompt "Open Wagoo"
4. Click "Open" - app should focus and authenticate

### 2. Direct Protocol Test
1. Use `start wagoo://auth/callback?code=test123`
2. App should launch/focus
3. Check logs for callback handling

## Known Limitations

### Without Code Signing
- Windows may show security warnings
- Protocol registration may fail on some systems
- Enterprise environments may block unsigned executables

### With Code Signing
- Requires certificate purchase/setup
- Adds build complexity
- Necessary for production distribution

## Recommendations

### For Development
- Use current implementation with enhanced logging
- Test on multiple Windows versions
- Consider development certificate for team testing

### For Production
- Implement code signing for reliable protocol handling
- Consider Windows Store distribution
- Test thoroughly on target Windows versions

## Support Matrix

| Windows Version | Unsigned | Signed |
|----------------|----------|---------|
| Windows 10     | Limited  | Full    |
| Windows 11     | Limited  | Full    |
| Windows Server | Blocked  | Full    |
| Enterprise     | Blocked  | Full    |

## Additional Resources

- [Electron Custom Protocols](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app)
- [Windows Protocol Registration](https://docs.microsoft.com/en-us/windows/win32/shell/app-registration)
- [Code Signing Guide](https://www.electronjs.org/docs/latest/tutorial/code-signing) 
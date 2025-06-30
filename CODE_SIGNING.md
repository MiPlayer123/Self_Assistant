# Code Signing Guide for Wagoo Electron App

This document provides instructions on how to code-sign the Wagoo application for both macOS and Windows distributions using `electron-builder`.

## 1. General Concepts

Code signing assures users that the application comes from a known source and has not been tampered with since it was signed. Operating systems enforce this through mechanisms like Apple's Gatekeeper and Windows SmartScreen.

For Continuous Integration (CI/CD) environments like GitHub Actions, it is crucial to handle certificates and passwords securely using environment variables (e.g., repository secrets).

## 2. macOS Signing and Notarization

Signing for macOS is a two-part process:
1.  **Code Signing**: Your app bundle is signed with your developer certificate.
2.  **Notarization**: The signed app is uploaded to Apple's servers to be scanned for malicious components.

This process requires an active **Apple Developer Program** membership.

### Prerequisites

1.  **Apple Developer Account**: You must be enrolled in the [Apple Developer Program](https://developer.apple.com/programs/enroll/).
2.  **Certificates**: From your Apple Developer account, you will need to obtain:
    *   `Developer ID Application`: For signing the application itself.
    *   `Developer ID Installer`: For signing the macOS installer (e.g., the `.dmg` file).
3.  **Install Certificates**: Install these certificates on your macOS build machine. They will be added to your Keychain Access.
4.  **App-Specific Password**: Create an app-specific password from your [Apple ID account page](https://appleid.apple.com/). This is required for the notarization step. **Do not use your main Apple ID password.**

### Configuration with `electron-builder`

`electron-builder` will use the settings in `package.json` and environment variables to perform the signing and notarization.

#### Environment Variables for CI/CD

Set these as secrets in your CI/CD environment:

-   `CSC_LINK`: A base64 encoded string of your `.p12` certificate file.
    -   To generate this, first export your "Developer ID Application" certificate from Keychain Access as a `.p12` file.
    -   Then, run this command in your terminal: `base64 -i /path/to/your/cert.p12 | pbcopy`
-   `CSC_KEY_PASSWORD`: The password for your `.p12` certificate.
-   `APPLE_ID`: Your Apple ID email address.
-   `APPLE_ID_PASSWORD`: The app-specific password you generated.
-   `APPLE_TEAM_ID`: Your Apple Developer Team ID.

**For local builds**, `electron-builder` can often automatically find your certificate in the Keychain, but you will still need to set `APPLE_ID`, `APPLE_ID_PASSWORD`, and `APPLE_TEAM_ID` as environment variables for notarization.

#### `package.json` modifications

I recommend the following changes to the `mac` section of your `build` configuration in `package.json`:

1.  **`identity`**: Remove this line. It's better to let `electron-builder` auto-discover the correct identity from your keychain or use the `CSC_LINK` environment variable.
2.  **`gatekeeperAssess`**: Remove this line. The default is `true`, which is what you want for notarization. Setting it to `false` can cause notarization to fail.
3.  **`notarize`**: This should be an object to pass options. The current `true` value might work but it is better to be explicit. It has been changed to `{}`.

I will now apply these changes to your `package.json`.

---

## 3. Windows Signing

For Windows, you need to purchase a code signing certificate from a Certificate Authority (CA). To avoid the Windows SmartScreen warning, an **Extended Validation (EV) certificate** is strongly recommended. These are more expensive and are typically shipped to you on a hardware USB token.

### Prerequisites

1.  **Windows Code Signing Certificate**: Purchase one from a CA like [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing), [DigiCert](https://www.digicert.com/code-signing), etc.
2.  **Certificate File**: You will typically receive a `.pfx` file (which is the same as a `.p12`).

### Configuration with `electron-builder`

#### Environment Variables for CI/CD

-   `CSC_LINK`: A base64 encoded string of your `.pfx` certificate file. (See macOS instructions for how to generate this).
-   `CSC_KEY_PASSWORD`: The password for your `.pfx` certificate.

If you are using a cloud-based or hardware-based signing solution (common for EV certs), you might need to use `electron-builder` hooks or other tools. The configuration will depend on your certificate provider.

#### `package.json` modifications

You should add a `publisherName` to your `nsis` target configuration. I will add this for you.

---
This guide should provide a clear path to getting your application properly signed. 
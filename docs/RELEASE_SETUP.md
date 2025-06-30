# Wagoo Release Setup Guide

This guide explains how to set up automated releases for Wagoo using a separate public repository.

## Overview

The release process works as follows:
1. **Development** happens in this private repository
2. **Releases** are automatically built and published to a separate public repository
3. **Users** download releases from the public repository

## Step 1: Create Public Repository

1. Create a new **public** repository on GitHub (e.g., `wagoo-releases`)
2. Initialize it with a README.md:

```markdown
# Wagoo - AI Assistant Overlay

An invisible desktop application that serves as your general-purpose AI assistant overlay.

## Download

Download the latest version for your platform from the [Releases](https://github.com/your-username/wagoo-releases/releases) page:

- **macOS**: Download the `.dmg` file
- **Windows**: Download the `.exe` file  
- **Linux**: Download the `.AppImage` file

## Installation

### macOS
1. Download the `.dmg` file
2. Open the file and drag Wagoo to your Applications folder
3. Launch Wagoo from Applications

### Windows
1. Download the `.exe` file
2. Run the installer and follow the setup wizard
3. Launch Wagoo from the Start menu

### Linux
1. Download the `.AppImage` file
2. Make it executable: `chmod +x Wagoo-Linux-*.AppImage`
3. Run the file: `./Wagoo-Linux-*.AppImage`

## Features

- AI-powered assistant overlay
- Cross-platform support (macOS, Windows, Linux)
- Voice input and text chat
- Screenshot analysis
- Privacy-focused design

## Support

For issues and feature requests, please visit [our support page](https://your-website.com/support).

## License

Copyright © 2024. All rights reserved.
```

## Step 2: Configure GitHub Secrets

In your **private repository** (this one), add these secrets:

### Required Secrets

1. Go to your repository Settings → Secrets and variables → Actions
2. Add these Repository secrets:

| Secret Name | Description | Value |
|-------------|-------------|-------|
| `PUBLIC_REPO_TOKEN` | GitHub Personal Access Token | See instructions below |
| `PUBLIC_REPO_NAME` | Full name of public repo | `your-username/wagoo-releases` |

### Creating Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token" → "Generate new token (classic)"
3. Set these permissions:
   - `repo` (Full control of private repositories)
   - `public_repo` (Access public repositories)
4. Copy the token and add it as `PUBLIC_REPO_TOKEN` secret

## Step 3: Release Process

### Option A: Automatic Release (Recommended)

Use the release script for easy releases:

```bash
# Make sure you're on the main branch with all changes committed
git checkout main
git pull origin main

# Run the release script with the new version
./scripts/release.sh 1.0.19
```

This script will:
- Update the version in `package.json`
- Create a git commit with the version change
- Create and push a git tag
- Trigger the GitHub Actions workflow

### Option B: Manual Release

1. Update version in `package.json`:
   ```bash
   npm version 1.0.19 --no-git-tag-version
   ```

2. Commit and tag:
   ```bash
   git add package.json
   git commit -m "Bump version to 1.0.0"
   git tag -a v1.0.19 -m "Release version 1.0.0"
   git push origin main
   git push origin v1.0.19
   ```

### Option C: Manual Trigger

You can also manually trigger a release from GitHub:

1. Go to Actions tab in your repository
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Enter the version (e.g., `v1.0.0`)
5. Click "Run workflow"

## Step 4: Monitor Release

1. After triggering a release, go to the **Actions** tab in your private repository
2. Watch the "Build and Release" workflow progress
3. The workflow will:
   - Build binaries for macOS, Windows, and Linux
   - Create a release in your public repository
   - Upload all platform binaries to the release

## Step 5: Verify Release

1. Go to your public repository
2. Check the **Releases** section
3. Verify that all platform binaries are attached
4. Test download links

## Troubleshooting

### Build Fails
- Check the Actions logs for specific error messages
- Ensure all dependencies are properly listed in `package.json`
- Verify Node.js version compatibility

### Release Not Created in Public Repo
- Verify `PUBLIC_REPO_TOKEN` has correct permissions
- Check `PUBLIC_REPO_NAME` is set correctly
- Ensure the public repository exists and is accessible

### Missing Platform Binaries
- Check if specific platform builds failed in the Actions logs
- macOS builds require macOS runners (included in workflow)
- Windows and Linux builds should work on their respective runners

## Customization

### Modify Supported Platforms

Edit `.github/workflows/release.yml` and update the `matrix.os` section:

```yaml
strategy:
  matrix:
    os: [macos-latest, windows-latest, ubuntu-latest]
```

### Change Release Notes Format

Modify the release notes generation in the workflow:

```bash
# In .github/workflows/release.yml
echo "## Wagoo $VERSION" > release_notes.md
# Add your custom release notes format here
```

### Add Code Signing

For production releases, add code signing:

1. Add signing certificates to GitHub secrets
2. Modify the build process to include signing
3. Update `package.json` build configuration

## Website Integration

To link to your releases from your website:

```html
<!-- Direct download links -->
<a href="https://github.com/your-username/wagoo-releases/releases/latest/download/Wagoo-arm64.dmg">
  Download for macOS (Apple Silicon)
</a>

<a href="https://github.com/your-username/wagoo-releases/releases/latest/download/Wagoo-Windows-1.0.19.exe">
  Download for Windows
</a>

<!-- Or use the releases page -->
<a href="https://github.com/your-username/wagoo-releases/releases">
  View All Releases
</a>
```

## Security Considerations

1. **Private Repository**: Keep your main development repository private to protect:
   - API keys and secrets
   - Internal documentation
   - Development processes

2. **Public Repository**: Only contains:
   - Built binaries
   - Public documentation
   - Release information

3. **Token Permissions**: Use minimal required permissions for the GitHub token

4. **Code Signing**: Consider adding code signing for production releases to increase user trust

## Support

If you encounter issues with this setup:

1. Check the GitHub Actions logs
2. Verify all secrets are correctly configured
3. Ensure the public repository is accessible
4. Test the build process locally first

## Next Steps

After setup:

1. Create your first release to test the process
2. Update your website to link to the public repository
3. Set up monitoring for failed builds
4. Consider adding automated testing before releases 
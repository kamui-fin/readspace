---
description: Testing OAuth locally with Chrome extension
---

# Testing Chrome Extension OAuth Locally

This guide explains how to test the Google OAuth flow for your Chrome extension during local development.

## Understanding Extension OAuth

### Key Concepts
1. **Extension ID**: Chrome assigns a unique ID to your extension. This ID changes between:
   - **Unpacked/Development**: Random ID (changes if you remove/reload)
   - **Chrome Web Store**: Fixed ID based on your private key
   
2. **Redirect URI**: Chrome extensions use a special redirect URI format:
   - Format: `https://<extension-id>.chromiumapp.org/`
   - Generated automatically via `browser.identity.getRedirectURL()`

3. **OAuth2 in Manifest**: Your `manifest.chrome.json` includes the `oauth2` section which enables Chrome's identity API

## Step-by-Step Testing Instructions

### Step 1: Get Your Development Extension ID

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked** and select your extension's build directory:
   ```
   /home/kamui/dev/projects/readspace/apps/extension/dist
   ```
4. **Copy the Extension ID** - it looks like: `abcdefghijklmnopqrstuvwxyz123456`

### Step 2: Configure Supabase OAuth

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers** → **Google**
3. Add the development redirect URI to **Authorized Redirect URIs**:
   ```
   https://<YOUR-EXTENSION-ID>.chromiumapp.org/
   ```
   Replace `<YOUR-EXTENSION-ID>` with the ID from Step 1
   
4. Keep the existing production redirect URI if you have one

### Step 3: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find the OAuth 2.0 Client ID: `618963664803-flhs0b3rd4d974kglkf0gshfhk461rqq`
4. Under **Authorized redirect URIs**, add:
   ```
   https://<YOUR-EXTENSION-ID>.chromiumapp.org/
   ```
5. Also add your Supabase callback URL if not already present:
   ```
   https://<YOUR-SUPABASE-PROJECT-ID>.supabase.co/auth/v1/callback
   ```

### Step 4: Build and Test the Extension

1. Build the extension:
   ```bash
   cd /home/kamui/dev/projects/readspace/apps/extension
   bun run build
   ```

2. In `chrome://extensions/`:
   - Click the **reload icon** on your extension to reload it
   - Open the extension popup
   - Click the **Google OAuth** button

3. You should see:
   - Google's OAuth consent screen
   - Permission request for email and profile
   - Redirect back to the extension

### Step 5: Debug OAuth Flow

To debug issues, open the **service worker console**:

1. In `chrome://extensions/`, click **service worker** under your extension
2. This opens DevTools for the background script
3. Look for console logs:
   ```
   Supabase initialized with URL: https://hnqyngkyugiamvlhqoaf.supabase.co
   ```

You can also check for errors in:
- **Extension popup**: Right-click popup → Inspect
- **Background service worker**: Click "service worker" link in chrome://extensions/

### Step 6: Verify Session Storage

After successful OAuth:

1. Open service worker console
2. Run:
   ```javascript
   chrome.storage.local.get('session', (data) => console.log(data))
   ```
3. You should see the session object with `access_token` and `refresh_token`

## Common Issues and Solutions

### Issue: "Invalid redirect URI"
**Solution**: Make sure the redirect URI in Google Cloud Console and Supabase matches exactly with `https://<extension-id>.chromiumapp.org/`

### Issue: Extension ID keeps changing
**Solution**: This is normal for unpacked extensions. Options:
1. Update the redirect URI each time (annoying for testing)
2. Use a fixed key (see below)

### Issue: Need a fixed Extension ID for development

**Solution**: Generate a key pair and add to manifest:

1. Generate a key:
   ```bash
   openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
   ```

2. Add to `manifest.chrome.json`:
   ```json
   {
     "key": "YOUR_GENERATED_KEY_HERE",
     ...
   }
   ```
   
3. The extension will now have a consistent ID

**Note**: Remove the key before publishing to Chrome Web Store!

### Issue: "OAuth URL not returned"
**Solution**: Check that Supabase Google provider is enabled and configured correctly

### Issue: CORS errors
**Solution**: Make sure `skipBrowserRedirect: true` is set in the OAuth options (already in your code)

## Production vs Development

### Development (Current Setup)
- Extension ID: Changes with each load (unless you add a key)
- Redirect URI: `https://<dev-extension-id>.chromiumapp.org/`
- Must be manually added to Google Console and Supabase

### Production (Chrome Web Store)
- Extension ID: Fixed based on the key used when publishing
- Redirect URI: `https://<production-extension-id>.chromiumapp.org/`
- Should already be configured in your Google Console

## Quick Testing Checklist

- [ ] Extension built with `bun run build`
- [ ] Extension loaded in `chrome://extensions/`
- [ ] Extension ID copied
- [ ] Extension ID added to Supabase redirect URIs
- [ ] Extension ID added to Google Cloud Console redirect URIs
- [ ] Background service worker console open for debugging
- [ ] Clicked "Sign in with Google" button
- [ ] OAuth consent screen appears
- [ ] Successfully redirected back to extension
- [ ] Session stored in `chrome.storage.local`

## Testing Self-Hosted Supabase

If you want to test with a local/self-hosted Supabase instance:

1. Open the extension popup
2. Click **Settings** → **Self-Hosted**
3. Enter your local Supabase URL and anon key
4. Restart the extension
5. The OAuth flow will use your local instance

Make sure your local Supabase instance has Google OAuth configured!

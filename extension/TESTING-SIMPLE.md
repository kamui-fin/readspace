# 🧪 Testing the Readspace Chrome Extension (Simplified)

## ✅ Quick Setup

### 1. **Load the Extension**
```bash
cd extension
npm run build
```

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" 
4. Select the `dist` folder
5. Pin the extension to your toolbar

### 2. **Configure Settings**
Click the extension icon → "Settings":

- **Readspace API URL**: `http://0.0.0.0:8008`
- **Supabase URL**: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
- **Supabase Anonymous Key**: Your public anon key from Supabase dashboard

### 3. **Sign In**
Click the extension icon → "Sign In to Readspace":

- Enter your email and password (same as web app)
- Click "Sign In"
- That's it! ✨

## 🎯 Test Features

### **Article Saving**
1. Navigate to any article (try Medium, Dev.to, news sites)
2. Click the extension icon
3. Review the article preview
4. Click "Save to Readspace"

### **Context Menu**
- Right-click on any page → "Save to Readspace"
- Right-click on any link → "Save link to Readspace"

### **Keyboard Shortcuts**
- `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac): Save current page
- `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac): Open Readspace

### **RSS Feed Discovery**
- Right-click on pages with RSS feeds → "Discover RSS feeds"

## 🐛 Common Issues

**"Configure Supabase connection"**
- Make sure you've entered the Supabase URL and anonymous key in Settings

**"Failed to sign in"**
- Check your Supabase configuration
- Verify your email/password are correct
- Make sure your Supabase project allows email auth

**"Network error" when saving articles**
- Check that your Readspace server is running on `http://0.0.0.0:8008`
- Verify CORS is configured to allow the extension

## 🔧 Development Tips

**Check Extension Console:**
```
chrome://extensions/ → Readspace → "service worker" link
```

**Check Popup Console:**
```
Right-click extension icon → "Inspect popup"
```

**Check Content Script:**
```
F12 on any page → Console → Look for "Readspace content script loaded"
```

**Test API Endpoints:**
```bash
# Test health check
curl http://0.0.0.0:8008/api/health

# Test with your token
curl -H "Authorization: Bearer YOUR_TOKEN" http://0.0.0.0:8008/api/user-info
```

## 🚀 What's Different Now

✅ **Before**: Complex token extraction from developer tools  
✅ **Now**: Simple email/password login like the web app

✅ **Before**: Manual API token management  
✅ **Now**: Automatic Supabase session handling

✅ **Before**: Multiple configuration steps  
✅ **Now**: Two clicks to get started

## 🎉 Ready to Use!

The extension now works just like any other app:
1. Configure your server URLs once
2. Sign in with your credentials
3. Start saving articles!

No more developer tools, token copying, or complex setup. Just simple, secure authentication that works. 
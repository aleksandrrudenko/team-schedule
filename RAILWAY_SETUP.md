# Railway Deployment Setup Guide

## ⚠️ Critical: Environment Variables

The application **requires** these environment variables to be set in Railway:

### Required Variables

1. **GOOGLE_CLIENT_ID** - Your Google OAuth Client ID
2. **GOOGLE_CLIENT_SECRET** - Your Google OAuth Client Secret
3. **SESSION_SECRET** - A random string for session encryption
4. **ALLOWED_USERS** - Comma-separated list of allowed email addresses
5. **CALLBACK_URL** - Your Railway app URL + `/auth/google/callback`

### How to Set Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add each variable:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=generate-a-random-string-here
ALLOWED_USERS=user1@example.com,user2@example.com
CALLBACK_URL=https://your-app-name.railway.app/auth/google/callback
PORT=3000
NODE_ENV=production
```

### Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: `https://your-app-name.railway.app/auth/google/callback`
7. Copy **Client ID** and **Client Secret**

### Important Notes

- ⚠️ **CALLBACK_URL must match exactly** the URL in Google Cloud Console
- ⚠️ **SESSION_SECRET** should be a long random string (use `openssl rand -base64 32`)
- ⚠️ After setting variables, Railway will automatically redeploy
- ⚠️ Check logs if deployment fails

### Troubleshooting

**Error: "OAuth2Strategy requires a clientID option"**
- ✅ Check that `GOOGLE_CLIENT_ID` is set in Railway Variables
- ✅ Check that `GOOGLE_CLIENT_SECRET` is set in Railway Variables
- ✅ Redeploy after setting variables

**Error: "Access denied"**
- ✅ Check that your email is in `ALLOWED_USERS` variable
- ✅ Email must match exactly (case-sensitive)

**OAuth callback error**
- ✅ Verify `CALLBACK_URL` matches Google Cloud Console redirect URI
- ✅ Use HTTPS URL (Railway provides free SSL)

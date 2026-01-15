# Quick Deploy to Railway (Free)

## Step 1: Sign up and Connect

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `aleksandrrudenko/team-schedule`

## Step 2: Configure Environment Variables

In Railway dashboard, go to "Variables" tab and add:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
CALLBACK_URL=https://your-app-name.railway.app/auth/google/callback
SESSION_SECRET=generate-random-string-here
ALLOWED_USERS=your-email@gmail.com
NODE_ENV=production
PORT=3000
```

**Important**: 
- Replace `your-app-name` with your actual Railway app name
- Update Google OAuth callback URL in Google Cloud Console to match Railway URL

## Step 3: Deploy

Railway will automatically:
- Detect Node.js
- Run `npm install`
- Start with `npm start`

## Step 4: Get Your Free Domain

Railway provides: `https://your-app-name.railway.app`

You can also add a custom domain in Railway settings.

## Step 5: Update Google OAuth

1. Go to Google Cloud Console
2. Update authorized redirect URI to: `https://your-app-name.railway.app/auth/google/callback`
3. Update `CALLBACK_URL` in Railway variables

Done! Your app is live at `https://your-app-name.railway.app`

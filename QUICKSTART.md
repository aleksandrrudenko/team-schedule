# Quick Start Guide

## Setup in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Type: Web application
   - Authorized redirect URI: `http://localhost:3000/auth/google/callback`
5. Copy Client ID and Client Secret

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
ALLOWED_USERS=your-email@gmail.com,another-user@example.com
SESSION_SECRET=generate-random-string-here
```

Generate random session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start Server

```bash
npm start
```

### 5. Access Application

Open http://localhost:3000 in your browser and sign in with Google.

## Adding Users

Edit `.env`:
```env
ALLOWED_USERS=user1@example.com,user2@example.com,newuser@example.com
```

Restart the server.

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Update `CALLBACK_URL` to your production domain
3. Use HTTPS (required for secure cookies)
4. Use environment variables from your hosting provider

# Authentication Setup Guide

This guide explains how to set up Google OAuth authentication for the Team Schedule System.

## Prerequisites

1. Node.js (v14 or higher)
2. A Google Cloud Project with OAuth 2.0 credentials
3. A list of allowed user email addresses

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - For development: `http://localhost:3000/auth/google/callback`
     - For production: `https://your-domain.com/auth/google/callback`
   - Copy the **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   CALLBACK_URL=http://localhost:3000/auth/google/callback
   SESSION_SECRET=your-random-secret-key
   ALLOWED_USERS=user1@example.com,user2@example.com,admin@example.com
   PORT=3000
   NODE_ENV=development
   ```

### Important Notes:

- **SESSION_SECRET**: Use a long, random string. You can generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- **ALLOWED_USERS**: Comma-separated list of Google email addresses that should have access. Only these users will be able to log in.

- **CALLBACK_URL**: Must match exactly what you configured in Google Cloud Console.

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Start the Server

### Development (with auto-reload):
```bash
npm run dev
```

### Production:
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## Step 5: Access the Application

1. Open your browser and go to `http://localhost:3000`
2. You will be redirected to Google for authentication
3. Sign in with a Google account that is in your `ALLOWED_USERS` list
4. After successful authentication, you'll be redirected to the schedule page

## Security Features

- **Whitelist-based access**: Only users in `ALLOWED_USERS` can access the application
- **Session management**: Users stay logged in for 24 hours
- **Secure cookies**: In production, cookies are marked as secure (HTTPS only)
- **Automatic logout**: Users not in whitelist are automatically logged out

## Adding/Removing Users

To add or remove users:

1. Edit the `.env` file
2. Update the `ALLOWED_USERS` variable:
   ```env
   ALLOWED_USERS=user1@example.com,user2@example.com,newuser@example.com
   ```
3. Restart the server

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in `.env`
2. Use HTTPS (required for secure cookies)
3. Update `CALLBACK_URL` to your production domain
4. Use a strong `SESSION_SECRET`
5. Consider using environment variables from your hosting provider instead of `.env` file

## Troubleshooting

### "Access Denied" error
- Check that the user's email is in `ALLOWED_USERS`
- Verify the email matches exactly (case-sensitive)

### "Authentication Failed" error
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check that `CALLBACK_URL` matches Google Cloud Console configuration
- Ensure Google+ API is enabled

### Session not persisting
- Check `SESSION_SECRET` is set
- In production, ensure you're using HTTPS
- Clear browser cookies and try again

## API Endpoints

- `GET /` - Redirects to login or schedule page
- `GET /auth/google` - Initiates Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/failure` - Shows authentication failure message
- `GET /logout` - Logs out the user
- `GET /api/user` - Returns current user info (requires authentication)
- `GET /health` - Health check endpoint

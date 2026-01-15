# Deployment Guide

## Free Hosting Options for Node.js Application

### Option 1: Railway (Recommended - Free Tier Available)

Railway offers free hosting with custom domain support.

1. **Sign up**: https://railway.app
2. **Connect GitHub repository**
3. **Deploy**: Railway auto-detects Node.js
4. **Add custom domain**: Free subdomain or bring your own

**Setup:**
```bash
# Railway automatically detects package.json and starts the server
# Just connect your GitHub repo
```

### Option 2: Render (Free Tier)

1. **Sign up**: https://render.com
2. **New Web Service** → Connect GitHub
3. **Configure**:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Free subdomain**: `your-app.onrender.com`

### Option 3: Fly.io (Free Tier)

1. **Sign up**: https://fly.io
2. **Install flyctl**: `curl -L https://fly.io/install.sh | sh`
3. **Deploy**: `fly launch`
4. **Free subdomain**: `your-app.fly.dev`

### Option 4: Vercel (Free Tier)

Vercel supports Node.js serverless functions.

1. **Sign up**: https://vercel.com
2. **Import GitHub repository**
3. **Configure**: Vercel auto-detects Node.js
4. **Free subdomain**: `your-app.vercel.app`

## Free Domain Options

### Option 1: Freenom (Free TLDs: .tk, .ml, .ga, .cf)

⚠️ **Note**: Freenom domains are less reliable but completely free.

1. Go to https://www.freenom.com
2. Search for available domain
3. Register (free for 1 year, renewable)
4. Point to your hosting provider's DNS

### Option 2: GitHub Pages (Static Only)

For static sites only - won't work for Node.js server.

### Option 3: Use Hosting Provider's Free Subdomain

Most hosting providers offer free subdomains:
- Railway: `your-app.railway.app`
- Render: `your-app.onrender.com`
- Fly.io: `your-app.fly.dev`
- Vercel: `your-app.vercel.app`

## Environment Variables Setup

All hosting providers allow you to set environment variables:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
CALLBACK_URL=https://your-domain.com/auth/google/callback
SESSION_SECRET=your-random-secret
ALLOWED_USERS=user1@example.com,user2@example.com
NODE_ENV=production
PORT=3000
```

**Important**: Update `CALLBACK_URL` to match your production domain!

## Quick Deploy to Railway

1. **Install Railway CLI**:
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. **Deploy**:
   ```bash
   railway init
   railway up
   ```

3. **Set environment variables**:
   ```bash
   railway variables set GOOGLE_CLIENT_ID=your-id
   railway variables set GOOGLE_CLIENT_SECRET=your-secret
   railway variables set ALLOWED_USERS=user1@example.com
   # ... etc
   ```

4. **Get your URL**: Railway provides a free `.railway.app` subdomain

## Quick Deploy to Render

1. **Connect GitHub** in Render dashboard
2. **Create Web Service**
3. **Configure**:
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Add Environment Variables** in dashboard
5. **Deploy** - get free `.onrender.com` subdomain

## Custom Domain Setup

Once you have a domain (free from Freenom or paid):

1. **Get DNS settings** from your hosting provider
2. **Configure DNS** at your domain registrar:
   - Add A record or CNAME pointing to hosting provider
3. **Update CALLBACK_URL** in environment variables
4. **Update Google OAuth** callback URL in Google Cloud Console

## Security Notes for Production

- ✅ Use HTTPS (most providers provide free SSL)
- ✅ Set strong `SESSION_SECRET`
- ✅ Use environment variables (never commit `.env`)
- ✅ Set `NODE_ENV=production`
- ✅ Regularly update dependencies

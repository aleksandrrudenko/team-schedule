const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway (important for cookies in production)
app.set('trust proxy', 1);

// Whitelist of allowed users (Google email addresses)
// Support multiple formats: comma-separated, space-separated, or newline-separated
const ALLOWED_USERS_RAW = process.env.ALLOWED_USERS || '';
const ALLOWED_USERS = ALLOWED_USERS_RAW
    ? ALLOWED_USERS_RAW
        .split(/[,\n\r]+/)  // Split by comma, newline, or carriage return
        .map(email => email.trim().toLowerCase())
        .filter(email => email.length > 0 && email.includes('@'))  // Remove empty strings and invalid emails
    : [];

// Debug logging
console.log('🔐 Whitelist configuration:');
console.log('   ALLOWED_USERS env (raw):', JSON.stringify(ALLOWED_USERS_RAW));
console.log('   ALLOWED_USERS env (length):', ALLOWED_USERS_RAW.length);
console.log('   Parsed whitelist:', ALLOWED_USERS);
console.log('   Whitelist count:', ALLOWED_USERS.length);
if (ALLOWED_USERS.length > 0) {
    console.log('   Whitelist emails:');
    ALLOWED_USERS.forEach((email, index) => {
        console.log(`      [${index + 1}] "${email}"`);
    });
} else {
    console.log('   ⚠️  WARNING: Whitelist is empty!');
}

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,  // Changed back to false - resave only if session was modified
    saveUninitialized: false,  // Changed back to false - don't save empty sessions
    cookie: {
        secure: 'auto',  // Use 'auto' to let Express detect HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'  // Added for better cookie handling
    },
    name: 'sessionId'  // Explicit session name
}));

// Check required environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('❌ ERROR: Missing required environment variables!');
    console.error('   Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
    console.error('   Please set these in Railway dashboard: Variables tab');
    console.error('   See README_AUTH.md for setup instructions');
    console.error('');
    console.error('🔍 Debug info:');
    console.error('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
    console.error('   GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
    console.error('   All env vars:', Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('SESSION') || k.includes('ALLOWED') || k.includes('CALLBACK')));
    process.exit(1);
}

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`
}, (accessToken, refreshToken, profile, done) => {
    // Check if user is in whitelist
    const userEmail = profile.emails[0].value;
    const userEmailLower = userEmail.toLowerCase();
    
    console.log('🔍 Authentication attempt:');
    console.log('   User email:', userEmail);
    console.log('   User email (lowercase):', userEmailLower);
    console.log('   Whitelist:', ALLOWED_USERS);
    console.log('   Whitelist check (exact):', ALLOWED_USERS.includes(userEmail));
    console.log('   Whitelist check (lowercase):', ALLOWED_USERS.includes(userEmailLower));
    
    if (ALLOWED_USERS.length === 0) {
        console.warn('⚠️  WARNING: No users in whitelist. All users will be denied access.');
        return done(null, false, { message: 'Access denied. No users configured.' });
    }

    // Check both exact match and lowercase match
    const isAllowed = ALLOWED_USERS.includes(userEmail) || ALLOWED_USERS.includes(userEmailLower);
    
    if (!isAllowed) {
        console.log(`❌ Access denied for: ${userEmail}`);
        console.log('   Reason: Email not found in whitelist');
        console.log('   Whitelist contains:', ALLOWED_USERS);
        return done(null, false, { message: 'Access denied. Your email is not in the whitelist.' });
    }

    console.log(`✅ Access granted for: ${userEmail}`);
    return done(null, {
        id: profile.id,
        email: userEmail,
        name: profile.displayName,
        photo: profile.photos[0]?.value
    });
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Middleware to check authentication
function isAuthenticated(req, res, next) {
    console.log('🔐 isAuthenticated check:');
    console.log('   Is authenticated:', req.isAuthenticated());
    console.log('   User:', req.user ? req.user.email : 'No user');
    console.log('   Session ID:', req.sessionID);
    
    if (req.isAuthenticated()) {
        console.log('   ✅ Authentication passed');
        return next();
    }
    console.log('   ❌ Not authenticated, redirecting to /auth/google');
    res.redirect('/auth/google');
}

// Middleware to check whitelist (additional check)
function isWhitelisted(req, res, next) {
    if (!req.user) {
        console.log('⚠️  isWhitelisted: No user in session');
        return res.redirect('/auth/google');
    }

    const userEmail = req.user.email;
    const userEmailLower = userEmail.toLowerCase();
    
    console.log('🔍 isWhitelisted check:');
    console.log('   User email:', userEmail);
    console.log('   User email (lowercase):', userEmailLower);
    console.log('   Whitelist:', ALLOWED_USERS);
    console.log('   Check (exact):', ALLOWED_USERS.includes(userEmail));
    console.log('   Check (lowercase):', ALLOWED_USERS.includes(userEmailLower));
    
    // Check both exact match and lowercase match
    const isAllowed = ALLOWED_USERS.includes(userEmail) || ALLOWED_USERS.includes(userEmailLower);
    
    if (ALLOWED_USERS.length > 0 && !isAllowed) {
        console.log(`❌ isWhitelisted: Access denied for ${userEmail}`);
        req.logout((err) => {
            if (err) console.error('Logout error:', err);
        });
        return res.status(403).send(`
            <html>
                <head>
                    <title>Access Denied</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: #f5f5f5;
                        }
                        .error-container {
                            background: white;
                            padding: 40px;
                            border-radius: 12px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            text-align: center;
                            max-width: 500px;
                        }
                        h1 { color: #e74c3c; margin-bottom: 20px; }
                        p { color: #555; line-height: 1.6; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <h1>❌ Access Denied</h1>
                        <p>Your email (<strong>${userEmail}</strong>) is not in the whitelist.</p>
                        <p>Please contact the administrator to request access.</p>
                    </div>
                </body>
            </html>
        `);
    }
    next();
}

// Routes
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/schedule.html');
    } else {
        res.redirect('/auth/google');
    }
});

// Google OAuth routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/failure' }),
    (req, res) => {
        // Successful authentication
        console.log('✅ OAuth callback successful');
        console.log('   User:', req.user ? req.user.email : 'No user');
        console.log('   Session ID:', req.sessionID);
        console.log('   Is authenticated:', req.isAuthenticated());
        console.log('   Session data:', JSON.stringify(req.session));
        
        // Save session before redirect
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
            } else {
                console.log('✅ Session saved successfully');
            }
            res.redirect('/schedule.html');
        });
    }
);

app.get('/auth/failure', (req, res) => {
    res.status(401).send(`
        <html>
            <head>
                <title>Authentication Failed</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }
                    .error-container {
                        background: white;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        text-align: center;
                        max-width: 500px;
                    }
                    h1 { color: #e74c3c; margin-bottom: 20px; }
                    p { color: #555; line-height: 1.6; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>❌ Authentication Failed</h1>
                    <p>${req.query.message || 'Unable to authenticate with Google.'}</p>
                    <p><a href="/auth/google">Try again</a></p>
                </div>
            </body>
        </html>
    `);
});

// Logout route
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Error during logout');
        }
        res.redirect('/auth/google');
    });
});

// Protected routes - serve static files with authentication
// Serve schedule.html as main page when authenticated
app.get('/schedule.html', isAuthenticated, isWhitelisted, (req, res) => {
    console.log('✅ Accessing /schedule.html');
    console.log('   User:', req.user ? req.user.email : 'No user');
    console.log('   Is authenticated:', req.isAuthenticated());
    console.log('   Session ID:', req.sessionID);
    const filePath = path.join(__dirname, 'schedule.html');
    console.log('   File path:', filePath);
    console.log('   __dirname:', __dirname);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        console.error('❌ schedule.html not found at:', filePath);
        return res.status(404).send('Schedule page not found');
    }
    
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('❌ Error sending schedule.html:', err);
            if (!res.headersSent) {
                res.status(500).send('Error loading schedule page');
            }
        } else {
            console.log('✅ schedule.html sent successfully');
        }
    });
});

// Protect all other static files (HTML, JS, MD)
app.get('/*.html', isAuthenticated, isWhitelisted, (req, res, next) => {
    express.static(__dirname)(req, res, next);
});

app.get('/*.js', isAuthenticated, isWhitelisted, (req, res, next) => {
    express.static(__dirname)(req, res, next);
});

app.get('/*.md', isAuthenticated, isWhitelisted, (req, res, next) => {
    express.static(__dirname)(req, res, next);
});

// Serve other static files (CSS, images, etc.) - no protection needed
app.use(express.static(__dirname));

// User info endpoint
app.get('/api/user', isAuthenticated, isWhitelisted, (req, res) => {
    res.json({
        email: req.user.email,
        name: req.user.name,
        photo: req.user.photo
    });
});

// Save schedule endpoint
app.post('/api/save-schedule', isAuthenticated, isWhitelisted, express.json(), (req, res) => {
    try {
        const fs = require('fs');
        const scheduleData = {
            ...req.body,
            savedBy: req.user.email,
            savedByName: req.user.name || req.user.email,
            savedAt: new Date().toISOString()
        };
        
        const filePath = path.join(__dirname, 'saved-schedule.json');
        fs.writeFileSync(filePath, JSON.stringify(scheduleData, null, 2));
        
        console.log(`✅ Schedule saved by ${req.user.email} (${req.user.name || 'unknown'})`);
        res.json({ 
            success: true, 
            message: 'Schedule saved successfully',
            savedBy: scheduleData.savedBy,
            savedByName: scheduleData.savedByName,
            savedAt: scheduleData.savedAt
        });
    } catch (error) {
        console.error('❌ Error saving schedule:', error);
        res.status(500).json({ error: 'Failed to save schedule', details: error.message });
    }
});

// Load schedule endpoint
app.get('/api/load-schedule', isAuthenticated, isWhitelisted, (req, res) => {
    try {
        const fs = require('fs');
        const filePath = path.join(__dirname, 'saved-schedule.json');
        
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const scheduleData = JSON.parse(data);
            console.log(`✅ Schedule loaded (saved by ${scheduleData.savedBy || 'unknown'})`);
            res.json(scheduleData);
        } else {
            res.status(404).json({ error: 'No saved schedule found' });
        }
    } catch (error) {
        console.error('❌ Error loading schedule:', error);
        res.status(500).json({ error: 'Failed to load schedule', details: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Whitelist: ${ALLOWED_USERS.length} user(s) configured`);
    if (ALLOWED_USERS.length > 0) {
        console.log(`   Allowed users: ${ALLOWED_USERS.join(', ')}`);
    } else {
        console.warn('   ⚠️  WARNING: No users in whitelist!');
    }
    
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error('❌ ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env file');
    }
});

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection (for Railway or other PostgreSQL providers)
let pool = null;
let useDatabase = false;

if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    useDatabase = true;
    console.log('🗄️  PostgreSQL database configured');
} else {
    console.log('📁 Using local file storage (no DATABASE_URL set)');
}

// Initialize database table
async function initDatabase() {
    if (!useDatabase) return;
    
    try {
        // Create table with month/year columns for per-month storage
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schedule_data (
                id SERIAL PRIMARY KEY,
                month INTEGER,
                year INTEGER,
                data JSONB NOT NULL,
                saved_by VARCHAR(255),
                saved_by_name VARCHAR(255),
                saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Add month/year columns if they don't exist (for existing tables)
        await pool.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schedule_data' AND column_name='month') THEN
                    ALTER TABLE schedule_data ADD COLUMN month INTEGER;
                    ALTER TABLE schedule_data ADD COLUMN year INTEGER;
                END IF;
            END $$;
        `);
        
        // Log current state before migration for safety
        const beforeMigration = await pool.query('SELECT id, month, year, saved_at, saved_by FROM schedule_data ORDER BY id');
        console.log(`📊 Current records in DB: ${beforeMigration.rows.length}`);
        beforeMigration.rows.forEach(row => {
            console.log(`   - ID ${row.id}: month=${row.month}, year=${row.year}, saved_at=${row.saved_at}, by=${row.saved_by}`);
        });
        
        // Migrate existing records that have NULL month/year - extract from data JSONB
        // This UPDATE is safe - it only fills in NULL values, doesn't delete anything
        const updateResult = await pool.query(`
            UPDATE schedule_data 
            SET 
                month = COALESCE((data->>'month')::INTEGER, EXTRACT(MONTH FROM saved_at)::INTEGER - 1),
                year = COALESCE((data->>'year')::INTEGER, EXTRACT(YEAR FROM saved_at)::INTEGER)
            WHERE month IS NULL OR year IS NULL
            RETURNING id, month, year
        `);
        
        if (updateResult.rows.length > 0) {
            console.log(`📝 Migrated ${updateResult.rows.length} record(s) with month/year:`);
            updateResult.rows.forEach(row => {
                console.log(`   - ID ${row.id}: month=${row.month}, year=${row.year}`);
            });
        }
        
        // Check for duplicates BEFORE adding constraint (safety check)
        const duplicateCheck = await pool.query(`
            SELECT month, year, COUNT(*) as cnt 
            FROM schedule_data 
            WHERE month IS NOT NULL AND year IS NOT NULL
            GROUP BY month, year 
            HAVING COUNT(*) > 1
        `);
        
        if (duplicateCheck.rows.length > 0) {
            console.log('⚠️  WARNING: Found duplicate month/year combinations:');
            duplicateCheck.rows.forEach(row => {
                console.log(`   - ${row.month + 1}/${row.year}: ${row.cnt} records`);
            });
            console.log('⚠️  Skipping unique constraint to preserve data. App will still work correctly.');
        } else {
            // Safe to add unique constraint - no duplicates exist
            try {
                await pool.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint 
                            WHERE conname = 'schedule_data_month_year_key'
                        ) THEN
                            ALTER TABLE schedule_data ADD CONSTRAINT schedule_data_month_year_key UNIQUE (month, year);
                        END IF;
                    END $$;
                `);
                console.log('✅ Unique constraint on (month, year) added/verified');
            } catch (constraintError) {
                console.log('⚠️  Could not add unique constraint:', constraintError.message);
                console.log('   App will still work correctly without it.');
            }
        }
        
        console.log('✅ Database table initialized (with month/year support)');
        
        // Migrate existing file data to database if file exists but no data in DB
        const filePath = path.join(__dirname, 'saved-schedule.json');
        if (fs.existsSync(filePath)) {
            const result = await pool.query('SELECT COUNT(*) FROM schedule_data');
            if (parseInt(result.rows[0].count) === 0) {
                console.log('📦 Migrating existing file data to database...');
                const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const month = fileData.month !== undefined ? fileData.month : new Date().getMonth();
                const year = fileData.year || new Date().getFullYear();
                await pool.query(
                    'INSERT INTO schedule_data (month, year, data, saved_by, saved_by_name, saved_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (month, year) DO NOTHING',
                    [month, year, fileData, fileData.savedBy || 'migration', fileData.savedByName || 'Migration', fileData.savedAt || new Date().toISOString()]
                );
                console.log('✅ File data migrated to database');
            }
        }
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        console.log('⚠️  Falling back to file storage');
        useDatabase = false;
    }
}

// Initialize database on startup
initDatabase();

// Trust proxy for Railway (important for cookies in production)
app.set('trust proxy', 1);

// Whitelist of allowed users (Google email addresses)
// Support multiple formats:
// 1. ALLOWED_USER_1, ALLOWED_USER_2, ALLOWED_USER_3, ALLOWED_USER_4 (individual variables)
// 2. ALLOWED_USERS (comma-separated, space-separated, or newline-separated)
const ALLOWED_USERS_RAW = process.env.ALLOWED_USERS || '';

// Read from individual variables (ALLOWED_USER_1, ALLOWED_USER_2, etc.)
const INDIVIDUAL_USERS = [];
for (let i = 1; i <= 20; i++) {  // Support up to 20 users
    const user = process.env[`ALLOWED_USER_${i}`];
    if (user && user.trim().length > 0 && user.includes('@')) {
        INDIVIDUAL_USERS.push(user.trim().toLowerCase());
    }
}

// Parse from ALLOWED_USERS if provided
const ALLOWED_USERS_FROM_STRING = ALLOWED_USERS_RAW
    ? ALLOWED_USERS_RAW
        .split(/[,\n\r]+/)  // Split by comma, newline, or carriage return
        .map(email => email.trim())  // Trim whitespace
        .filter(email => email.length > 0 && email.includes('@'))  // Remove empty strings and invalid emails
        .map(email => email.toLowerCase())  // Convert to lowercase
    : [];

// Combine both sources, remove duplicates
const ALLOWED_USERS = [...new Set([...INDIVIDUAL_USERS, ...ALLOWED_USERS_FROM_STRING])];

// Debug logging with detailed information
console.log('🔐 Whitelist configuration:');
console.log('   ALLOWED_USERS env (raw):', JSON.stringify(ALLOWED_USERS_RAW));
console.log('   ALLOWED_USERS env (length):', ALLOWED_USERS_RAW.length);
console.log('   Individual users found:', INDIVIDUAL_USERS.length);
if (INDIVIDUAL_USERS.length > 0) {
    console.log('   Individual user variables:');
    INDIVIDUAL_USERS.forEach((email, index) => {
        console.log(`      ALLOWED_USER_${index + 1}: "${email}"`);
    });
}
console.log('   ALLOWED_USERS from string:', ALLOWED_USERS_FROM_STRING.length);
console.log('   Parsed whitelist:', ALLOWED_USERS);
console.log('   Whitelist count:', ALLOWED_USERS.length);
if (ALLOWED_USERS.length > 0) {
    console.log('   Whitelist emails:');
    ALLOWED_USERS.forEach((email, index) => {
        console.log(`      [${index + 1}] "${email}"`);
    });
} else {
    console.log('   ⚝  WARNING: Whitelist is empty!');
    console.log('   💡 Check that ALLOWED_USER_1, ALLOWED_USER_2, etc. are set in Service Variables');
    console.log('   💡 OR set ALLOWED_USERS=email1@domain.com,email2@domain.com');
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
app.post('/api/save-schedule', isAuthenticated, isWhitelisted, express.json(), async (req, res) => {
    try {
        const month = req.body.month;
        const year = req.body.year;
        
        if (month === undefined || year === undefined) {
            return res.status(400).json({ error: 'Month and year are required' });
        }
        
        const scheduleData = {
            ...req.body,
            savedBy: req.user.email,
            savedByName: req.user.name || req.user.email,
            savedAt: new Date().toISOString()
        };
        
        if (useDatabase) {
            // Save to PostgreSQL database - UPSERT by month/year
            // Using transaction to ensure atomicity
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Delete existing record for this month/year (if any)
                const deleteResult = await client.query(
                    'DELETE FROM schedule_data WHERE month = $1 AND year = $2 RETURNING id',
                    [month, year]
                );
                
                if (deleteResult.rows.length > 0) {
                    console.log(`🔄 Updating existing schedule for ${month + 1}/${year} (replaced record ID ${deleteResult.rows[0].id})`);
                }
                
                // Insert new record
                await client.query(
                    'INSERT INTO schedule_data (month, year, data, saved_by, saved_by_name, saved_at) VALUES ($1, $2, $3, $4, $5, $6)',
                    [month, year, scheduleData, scheduleData.savedBy, scheduleData.savedByName, scheduleData.savedAt]
                );
                
                await client.query('COMMIT');
                console.log(`✅ Schedule for ${month + 1}/${year} saved to DATABASE by ${req.user.email}`);
            } catch (txError) {
                await client.query('ROLLBACK');
                throw txError;
            } finally {
                client.release();
            }
        } else {
            // Fallback to file storage (per month/year)
            const filePath = path.join(__dirname, `saved-schedule-${year}-${month}.json`);
            fs.writeFileSync(filePath, JSON.stringify(scheduleData, null, 2));
            console.log(`✅ Schedule for ${month + 1}/${year} saved to FILE by ${req.user.email}`);
        }
        
        res.json({ 
            success: true, 
            message: `Schedule for ${month + 1}/${year} saved successfully`,
            month: month,
            year: year,
            savedBy: scheduleData.savedBy,
            savedByName: scheduleData.savedByName,
            savedAt: scheduleData.savedAt,
            storage: useDatabase ? 'database' : 'file'
        });
    } catch (error) {
        console.error('❌ Error saving schedule:', error);
        res.status(500).json({ error: 'Failed to save schedule', details: error.message });
    }
});

// Load schedule endpoint - now supports month/year query params
app.get('/api/load-schedule', isAuthenticated, isWhitelisted, async (req, res) => {
    try {
        const month = req.query.month !== undefined ? parseInt(req.query.month) : null;
        const year = req.query.year !== undefined ? parseInt(req.query.year) : null;
        
        if (useDatabase) {
            let result;
            
            if (month !== null && year !== null) {
                // Load specific month/year
                result = await pool.query(
                    'SELECT data, saved_by, saved_by_name, saved_at, month, year FROM schedule_data WHERE month = $1 AND year = $2',
                    [month, year]
                );
                console.log(`🔍 Looking for schedule: ${month + 1}/${year}`);
            } else {
                // Load most recent (backward compatibility)
                result = await pool.query(
                    'SELECT data, saved_by, saved_by_name, saved_at, month, year FROM schedule_data ORDER BY saved_at DESC LIMIT 1'
                );
            }
            
            if (result.rows.length > 0) {
                const row = result.rows[0];
                const scheduleData = {
                    ...row.data,
                    savedBy: row.saved_by,
                    savedByName: row.saved_by_name,
                    savedAt: row.saved_at,
                    month: row.month,
                    year: row.year
                };
                console.log(`✅ Schedule for ${(row.month !== null ? row.month + 1 : '?')}/${row.year || '?'} loaded from DATABASE`);
                res.json(scheduleData);
            } else {
                res.status(404).json({ error: 'No saved schedule found for this month/year' });
            }
        } else {
            // Fallback to file storage
            let filePath;
            if (month !== null && year !== null) {
                filePath = path.join(__dirname, `saved-schedule-${year}-${month}.json`);
            } else {
                filePath = path.join(__dirname, 'saved-schedule.json');
            }
            
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                const scheduleData = JSON.parse(data);
                console.log(`✅ Schedule loaded from FILE`);
                res.json(scheduleData);
            } else {
                res.status(404).json({ error: 'No saved schedule found for this month/year' });
            }
        }
    } catch (error) {
        console.error('❌ Error loading schedule:', error);
        res.status(500).json({ error: 'Failed to load schedule', details: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        storage: useDatabase ? 'postgresql' : 'file',
        databaseConfigured: !!process.env.DATABASE_URL
    });
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

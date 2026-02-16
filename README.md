# Team Schedule

**Open-source scheduling system for distributed teams with 24/7 follow-the-sun coverage.**

Built for teams that need to coordinate complex shift rotations across multiple timezones while preventing employee burnout through automatic workload balancing.

## Why This Exists

Managing schedules for globally distributed teams is hard:
- Different timezones mean different "work hours"
- 24/7 coverage requires careful handoff planning
- Overtime sneaks up on you without automatic tracking
- Fair rotation is nearly impossible to do manually

This tool solves these problems with an algorithm that automatically generates balanced schedules while respecting configurable working hour limits.

## Key Features

| Feature | Description |
|---------|-------------|
| **Follow-the-Sun Coverage** | Seamless 24/7 coverage with automatic shift handoffs between timezone groups |
| **Multi-Timezone Support** | Configure any number of timezone groups (default: Americas, APAC, EMEA) |
| **Overtime Prevention** | Hard limits on monthly hours (default: 165-185h) with real-time tracking |
| **On-Call Rotation** | Fair distribution of on-call duties with configurable overlap periods |
| **Visual Dashboard** | Color-coded calendar view with per-employee statistics |
| **Editable Cells** | Click any cell to override with custom shift assignment |
| **Team Management** | Add, remove, and rename employees directly from the UI |
| **Data Persistence** | PostgreSQL backend stores schedules per month (no data loss on redeploy) |
| **CSV Export** | Export to Google Calendar, Outlook, or any calendar app |

## Quick Start

### Option 1: Run Locally

```bash
git clone https://github.com/aleksandrrudenko/team-schedule.git
cd team-schedule
npm install
npm start
# Open http://localhost:3000
```

### Option 2: Deploy to Cloud

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

Required environment variables:
```env
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-secret
SESSION_SECRET=random-32-char-string
ALLOWED_USERS=user1@gmail.com,user2@gmail.com
DATABASE_URL=postgres://...  # Optional, enables persistent storage
```

### Option 3: Static HTML (No Auth)

Just open `schedule.html` in your browser for a standalone version without authentication.

## How It Works

### Shift Structure

The system divides each day into three 8-hour shifts:

| Shift | Time (CET) | Typical Coverage |
|-------|------------|------------------|
| Shift 1 | 00:00-08:00 | APAC team |
| Shift 2 | 08:00-16:00 | EMEA team |
| Shift 3 | 16:00-00:00 | Americas team |

### On-Call Rotation

On-call duties rotate between timezone groups with 1-hour overlaps for smooth handoffs:

```
APAC:     17:00 -------- 01:00 (CET)
EMEA:     00:00 -------- 09:00 (CET)  
Americas: 08:00 -------- 17:00 (CET)
```

### Workload Balancing

The algorithm ensures:
- **Hard limit**: 165-185 hours/month per employee
- **Soft limit**: Max 5 consecutive work days (configurable)
- **Soft limit**: Max 2 consecutive days off (configurable)
- **Fair distribution**: On-call and regular shifts spread evenly

## Configuration

### Adding/Removing Employees

Edit the `team` object in `schedule.html`:

```javascript
const team = {
    americas: [
        { name: 'Alice', timezone: 'America/Sao_Paulo', offset: -3 },
        { name: 'Bob', timezone: 'America/New_York', offset: -5 }
    ],
    apac: [
        { name: 'Charlie', timezone: 'Australia/Sydney', offset: 10 }
    ],
    emea: [
        { name: 'Diana', timezone: 'Europe/Berlin', offset: 1 },
        { name: 'Eve', timezone: 'Europe/London', offset: 0 }
    ]
};
```

Or use the UI: click **"Add Employee"** button and fill in the details.

### Adjusting Hour Limits

Find these constants in `schedule.html`:

```javascript
const minTotalHours = 165;  // Minimum monthly hours
const maxTotalHours = 185;  // Maximum monthly hours
```

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework dependencies)
- **Backend**: Node.js + Express
- **Auth**: Google OAuth 2.0 with whitelist
- **Database**: PostgreSQL (optional, for persistence)
- **Deployment**: Railway, Render, Vercel, AWS, or any Node.js host

## Documentation

- [Schedule Rules](SCHEDULE_RULES.md) - Detailed algorithm explanation
- [AWS Deployment Guide](DEPLOYMENT_AWS.md) - Production deployment to AWS

## License

MIT License - use it, modify it, make it yours.

## Contributing

Pull requests welcome! This project was built to solve a real problem for a real team. If you have ideas for improvements, open an issue or submit a PR.

---

**Built with coffee and timezone math.**

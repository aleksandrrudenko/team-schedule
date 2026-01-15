---
title: Team Schedule System
description: Visualization and management of work schedule for a distributed team with on-call rotation balancing
version: 1.0.0
last_updated: 2025-01-15
---

# Team Schedule System

Visualization and management of work schedule for a distributed team with on-call rotation balancing, working hours, and days off.

## Table of Contents

- [Overview](#overview)
- [Team Composition](#team-composition)
- [Features](#features)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Schedule Rules](#schedule-rules)
- [Troubleshooting](#troubleshooting)

## Overview

The Team Schedule System is an automated scheduling tool designed to balance workload across a distributed team spanning three timezones. It ensures fair distribution of on-call duties and regular work shifts while maintaining strict working hour requirements (165-185 hours per month per employee).

### Key Capabilities

- **Automated Schedule Generation**: Creates monthly schedules with balanced workload distribution
- **Multi-Timezone Support**: Handles Brazil (UTC-3), Australia (UTC+10), and Europe (UTC+1) timezones
- **On-Call Rotation**: Fair distribution of 24/7 on-call duties across three groups
- **Workload Balancing**: Ensures all employees meet 165-185 hour monthly target (HARD RULE)
- **Export Functionality**: CSV export for calendar integration

## Team Composition

The system manages schedules for **11 employees** across three regions:

| Region | Employees | Timezone | UTC Offset | Notes |
|--------|-----------|----------|------------|-------|
| **Brazil** | 2 | America/Sao_Paulo | UTC-3 | - |
| **Australia** | 2 | Australia/Sydney | UTC+10 | - |
| **Europe** | 7 | Europe/Berlin | UTC+1 (CET) | Main load for partner requests |

## Features

### Core Features

- ✅ **Interactive Schedule Visualization** - Web-based calendar with color-coded shifts
- ✅ **8-Hour Shift System** - Three shifts per day providing 24/7 coverage
- ✅ **Working Hours Enforcement** - Automatic enforcement of 165-185 hours/month (HARD RULE)
- ✅ **Dual Time Display** - Shows both CET and local time for each shift
- ✅ **On-Call Rotation** - Fair distribution with 1-hour overlaps for handover
- ✅ **Statistics Dashboard** - Real-time workload statistics with progress indicators
- ✅ **CSV Export** - Export schedules for calendar applications (Google Calendar, Outlook, etc.)

### Advanced Features

- **Parallel Work Assignment**: Regular work can be assigned alongside on-call duties
- **Consecutive Day Limits**: For Europeans, maximum 5 consecutive work days and 2 consecutive days off (soft rule)
- **Automatic Balancing**: Algorithm ensures minimum hours are met before optimizing for target

## Quick Start

### Prerequisites

- Node.js (v14 or higher) - for CSV generation via command line
- Modern web browser - for interactive visualization

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aleksandrrudenko/team-schedule.git
   cd team-schedule
   ```

2. No additional dependencies required - the system uses vanilla JavaScript

### First Run

**Option 1: Web Interface (Recommended)**
```bash
# Open schedule.html in your browser
open schedule.html  # macOS
# or double-click schedule.html
```

**Option 2: Command Line**
```bash
# Generate schedule for current month
node generate_schedule.js

# Generate for specific month
node generate_schedule.js 3 2024  # March 2024
```

## Usage

### Interactive Web Visualization

1. Open `schedule.html` in your browser
2. Select the desired month and year from dropdowns
3. Click **"Update Schedule"** to generate the schedule
4. Review statistics and schedule visualization
5. Use **"Export to CSV"** to save the schedule

### Command Line CSV Generation

Generate CSV files directly from the command line:

```bash
# Current month (default)
node generate_schedule.js

# Specific month and year
node generate_schedule.js 3 2024   # March 2024
node generate_schedule.js 12 2024 # December 2024
```

The generated CSV file will be named: `schedule_<Month>_<Year>.csv`

### CSV Import to Calendar

1. Export schedule using "Export to CSV" button or command line
2. Open your calendar application (Google Calendar, Outlook, etc.)
3. Import the CSV file
4. Map columns as needed (most applications auto-detect)

## Configuration

### Modifying Team Composition

To add, remove, or modify employees, edit the `team` object in both files:

**Files to modify:**
- `schedule.html` (around line ~350)
- `generate_schedule.js` (around line ~12)

**Example:**
```javascript
const team = {
    brazil: [
        { name: 'Brazil 1', timezone: 'America/Sao_Paulo', offset: -3, workStart: 9, workEnd: 18 },
        { name: 'Brazil 2', timezone: 'America/Sao_Paulo', offset: -3, workStart: 9, workEnd: 18 }
    ],
    // ... other groups
};
```

### Adjusting Working Hours

The system enforces a **HARD RULE** of 165-185 hours per month. To modify:

1. Edit `minTotalHours` and `maxTotalHours` constants in:
   - `schedule.html` (function `distributeShifts`)
   - `generate_schedule.js` (function `distributeShifts`)

2. **Warning**: Changing these values may affect schedule quality and employee workload balance

## Schedule Rules

For detailed information about shift logic, on-call distribution, and working hours rules, see **[SCHEDULE_RULES.md](SCHEDULE_RULES.md)**.

### Quick Reference

- **Working Hours**: 165-185 hours/month per employee (HARD RULE)
- **Shift Duration**: 8 hours per shift
- **Shifts per Day**: 3 shifts (covering 24 hours)
- **On-Call Duration**: 8-10 hours (varies by group)
- **On-Call Overlap**: 1 hour for handover between groups

## Color Legend

The schedule visualization uses the following color coding:

| Color | Meaning | Time (CET) |
|-------|---------|------------|
| 🔵 **Blue** | Shift 1 (Night) | 00:00-08:00 |
| 🟡 **Yellow** | Shift 2 (Day) | 08:00-16:00 |
| 🟣 **Pink** | Shift 3 (Evening) | 16:00-00:00 |
| 🟠 **Orange** | On-call | Varies by group |
| 🟢🟠 **Gradient** | Regular work + On-call (parallel) | - |
| 🟣 **Purple** | Day off | - |

## Statistics

The system automatically calculates and displays:

- **Shift Count**: Number of shifts per type (Shift 1/2/3) per employee
- **Shift Hours**: Total regular work hours (shifts × 8 hours)
- **On-Call Hours**: Total on-call hours (calculated by shift duration)
- **Total Hours**: Combined on-call + regular work hours
- **Progress Indicator**: 
  - ✅ Within range (165-185h)
  - ⚠️ Exceeded maximum (>185h)
  - ❌ Below minimum (<165h)

## Troubleshooting

### Common Issues

**Issue: Employee has less than 165 hours**
- **Cause**: Algorithm couldn't assign enough shifts
- **Solution**: Check if there are enough available shifts. The system will prioritize employees below minimum in the next generation.

**Issue: Employee has more than 185 hours**
- **Cause**: Algorithm assigned too many shifts
- **Solution**: The system automatically stops assigning shifts once maximum is reached. This should be rare.

**Issue: CSV export not working**
- **Cause**: Browser security restrictions
- **Solution**: Use a modern browser (Chrome, Firefox, Safari, Edge). Ensure pop-ups are not blocked.

**Issue: Schedule looks unbalanced**
- **Cause**: Randomization in algorithm
- **Solution**: Regenerate the schedule. The algorithm uses randomization for fairness, so results may vary slightly.

### Getting Help

For detailed algorithm information, see [SCHEDULE_RULES.md](SCHEDULE_RULES.md).

## Examples

### Generate Schedule for Next Month

```bash
# Get current month and year
CURRENT_MONTH=$(date +%m)
CURRENT_YEAR=$(date +%Y)

# Calculate next month
NEXT_MONTH=$((CURRENT_MONTH + 1))
if [ $NEXT_MONTH -gt 12 ]; then
    NEXT_MONTH=1
    NEXT_YEAR=$((CURRENT_YEAR + 1))
else
    NEXT_YEAR=$CURRENT_YEAR
fi

# Generate schedule
node generate_schedule.js $NEXT_MONTH $NEXT_YEAR
```

### Batch Generate Multiple Months

```bash
# Generate schedules for Q1 2024
for month in 1 2 3; do
    node generate_schedule.js $month 2024
done
```

## Version History

- **v1.0.0** (2025-01-15)
  - Initial release
  - On-call rotation with 1-hour overlaps
  - 165-185 hour enforcement (HARD RULE)
  - Consecutive day limits for Europeans
  - CSV export functionality

## License

Internal use only - Playson

---

**Last Updated**: January 15, 2025  
**Maintained by**: DevOps Team

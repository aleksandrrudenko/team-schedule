# Schedule Rules

This document describes the logic and rules for the team schedule generation system.

## Overview

The schedule system manages work assignments for a distributed team across three timezones:
- **Brazil** (America/Sao_Paulo, UTC-3): 2 employees
- **Australia** (Australia/Sydney, UTC+10): 2 employees  
- **Europe** (Europe/Berlin, UTC+1): 7 employees

## Day Types

Each employee's day can be one of three types:

1. **On-call** - 24/7 availability during assigned shift hours
2. **Regular work** - Standard 8-hour shift
3. **Day off** - No work assigned

**Note:** Regular work can be assigned in parallel with on-call days.

## On-Call Shifts

### Distribution Logic

On-call shifts are distributed among three groups (Brazil, Australia, Europe) with rotation:
- Each day, one group is assigned on-call duty
- Groups rotate daily
- Within each group, employees rotate to distribute load evenly

### Shift Times (with 1-hour overlap for handover)

On-call shifts are aligned with each group's local working hours (9:00-18:00 local time):

- **Australia**: CET 00:00-09:00 (9 hours)
  - Local: 09:00-18:00
  - Overlaps with Europe at 08:00-09:00 CET

- **Europe**: CET 08:00-18:00 (10 hours)
  - Local: 09:00-18:00
  - Overlaps with Australia at 08:00-09:00 CET
  - Overlaps with Brazil at 17:00-18:00 CET

- **Brazil**: CET 17:00-01:00 (8 hours, crosses midnight)
  - Local: 09:00-18:00
  - Overlaps with Europe at 17:00-18:00 CET
  - Overlaps with Australia at 00:00-01:00 CET

### On-Call Hours Calculation

- Regular shifts: `endCET - startCET` hours
- Midnight crossover (Brazil): 8 hours (17:00-01:00 CET)

## Regular Work Shifts

### Shift Definitions

Three 8-hour shifts per day (covering all 24 hours):

1. **Shift 1**: CET 00:00-08:00 (Night shift)
2. **Shift 2**: CET 08:00-16:00 (Day shift)
3. **Shift 3**: CET 16:00-00:00 (Evening shift)

### Distribution Logic

Regular work shifts are assigned using a scoring algorithm that prioritizes:

1. **Critical Priority (< 165 hours)**: Employees below minimum get `hoursNeeded * 1000` bonus
2. **High Priority (165-180 hours)**: Employees below target get `hoursNeeded * 30` bonus
3. **Low Priority (180-185 hours)**: Employees can still receive shifts up to maximum with `hoursNeeded * 5` bonus
4. **Skip if > 185 hours**: No more shifts assigned
5. **Bonus for non-on-call days**: +200 points to fill days without on-call
6. **Group bonuses**: Europeans +25, Brazilians/Australians +15

### Parallel Assignment

Regular work can be assigned on the same day as on-call duty, allowing employees to work both simultaneously.

## Total Working Hours Rule (HARD RULE)

**CRITICAL:** Each employee must work between **165 and 185 hours per month** (total = on-call hours + regular work hours).

- **Minimum**: 165 hours (hard limit - cannot be below)
- **Maximum**: 185 hours (hard limit - cannot exceed)
- **Target**: 180 hours (preferred)

### Enforcement

The algorithm ensures:
- If an employee has less than 165 hours, regular work is aggressively assigned with maximum priority
- If an employee exceeds 185 hours, no more shifts are assigned
- The system passes through the shift list multiple times (3 passes) to guarantee minimum hours

### Progress Indicators

- ❌ Below minimum (165h) - CRITICAL
- ⚠️ Exceeded maximum (185h) - Warning
- ✅ Within acceptable range (165-185h) - OK

## Timezone Conversion

All times are calculated in CET (Central European Time, UTC+1) and converted to local time for each employee:

```
localHour = (cetHour - 1 + employeeOffset + 24) % 24
```

Where:
- `cetHour`: Hour in CET (0-23)
- `employeeOffset`: UTC offset for employee's timezone
- Result is wrapped to 0-23 range

## CSV Export Format

The exported CSV includes:
- Employee name and timezone
- Day, date, and day of week
- Day type (On-call, Regular work, Day off)
- Shift name and times (CET and local)
- On-call status (Yes/No)
- Shift hours and on-call hours

## Algorithm Details

### On-Call Distribution

1. Initialize counters for all employees
2. For each day:
   - Determine which group works (rotation: `(dayIndex + groupIndex) % groups.length`)
   - Select employee within group (rotation: `Math.floor(dayIndex / groups.length) % groupSize`)
   - Create on-call shift with appropriate CET and local times
   - Record shift in employee's schedule

### Regular Work Distribution

1. Calculate on-call hours for each employee
2. Determine minimum regular work needed to reach 165 hours total
3. Create list of all available shifts (all days × all shifts)
4. Shuffle shifts for even distribution
5. For each shift (3 passes):
   - Score all employees based on:
     - Hours needed to reach minimum/target/maximum
     - On-call status for the day
     - Group affiliation
     - Random factor for variety
   - Assign shift to highest-scoring employee
   - Update counters

## Statistics

The system tracks and displays:
- On-call shifts count and hours
- Regular work shifts count (by shift type) and hours
- Total hours (on-call + regular work)
- Progress indicator (❌/⚠️/✅)
- Comparison against 165-185 hour range

## Notes

- Weekend days are marked but can still have work assigned
- The algorithm prioritizes reducing "Day off" days by assigning regular work to non-on-call days
- Shift assignments are randomized within passes to ensure fair distribution
- The system ensures all employees meet the minimum 165 hours before optimizing for target 180 hours

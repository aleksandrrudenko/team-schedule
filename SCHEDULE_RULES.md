---
title: Schedule Rules and Algorithm
description: Detailed documentation of schedule generation logic and rules
version: 1.0.0
last_updated: 2025-01-15
---

# Schedule Rules and Algorithm

This document provides detailed information about the logic and rules governing the team schedule generation system.

## Table of Contents

- [Overview](#overview)
- [Day Types](#day-types)
- [On-Call Shifts](#on-call-shifts)
- [Regular Work Shifts](#regular-work-shifts)
- [Total Working Hours Rule](#total-working-hours-rule-hard-rule)
- [Timezone Conversion](#timezone-conversion)
- [Algorithm Details](#algorithm-details)
- [Special Rules](#special-rules)

## Overview

The schedule system manages work assignments for a distributed team across three timezones:

| Region | Employees | Timezone | UTC Offset |
|--------|-----------|----------|------------|
| **Brazil** | 2 | America/Sao_Paulo | UTC-3 |
| **Australia** | 2 | Australia/Sydney | UTC+10 |
| **Europe** | 7 | Europe/Berlin | UTC+1 (CET) |

### System Goals

1. **Fair Distribution**: Equal workload distribution across all employees
2. **24/7 Coverage**: Continuous on-call coverage with smooth handovers
3. **Compliance**: Strict adherence to 165-185 hour monthly requirement
4. **Balance**: Minimize consecutive work days and maximize rest periods

## Day Types

Each employee's day can be one of three types:

### 1. On-Call

- **Definition**: 24/7 availability during assigned shift hours
- **Requirement**: Employee must be 100% available, sitting at computer
- **Duration**: 8-10 hours depending on group
- **Overlap**: 1-hour overlap with adjacent group for handover

### 2. Regular Work

- **Definition**: Standard 8-hour shift
- **Duration**: Exactly 8 hours
- **Types**: Three shifts per day (Shift 1, 2, or 3)
- **Parallel Assignment**: Can be assigned alongside on-call duties

### 3. Day Off

- **Definition**: No work assigned (no on-call, no regular work)
- **Occurrence**: Minimized by algorithm to meet hour requirements
- **Limits**: For Europeans, maximum 2 consecutive days off (soft rule)

## On-Call Shifts

### Distribution Logic

On-call shifts are distributed among three groups (Brazil, Australia, Europe) using rotation:

1. **Group Rotation**: Each day, one group is assigned on-call duty
2. **Daily Rotation**: Groups rotate daily in sequence
3. **Employee Rotation**: Within each group, employees rotate to distribute load evenly

**Rotation Formula:**
```javascript
// Group selection
dayGroupIndex = (dayIndex + groupIndex) % groups.length

// Employee selection within group
employeeIndexInGroup = Math.floor(dayIndex / groups.length) % groupSize
```

### Shift Times (with 1-hour overlap for handover)

On-call shifts are aligned with each group's local working hours (9:00-18:00 local time):

#### Australia Group

- **CET Time**: 00:00-09:00 (9 hours)
- **Local Time**: 09:00-18:00
- **Overlaps**: 
  - With Europe: 08:00-09:00 CET

#### Europe Group

- **CET Time**: 08:00-18:00 (10 hours)
- **Local Time**: 09:00-18:00
- **Overlaps**: 
  - With Australia: 08:00-09:00 CET
  - With Brazil: 17:00-18:00 CET

#### Brazil Group

- **CET Time**: 17:00-01:00 (8 hours, crosses midnight)
- **Local Time**: 09:00-18:00
- **Overlaps**: 
  - With Europe: 17:00-18:00 CET
  - With Australia: 00:00-01:00 CET

### On-Call Hours Calculation

```javascript
if (shift.crossesMidnight) {
    onCallHours = 8; // Brazil: 17:00-01:00 = 8 hours
} else {
    onCallHours = shift.endCET - shift.startCET;
}
```

## Regular Work Shifts

### Shift Definitions

Three 8-hour shifts per day covering all 24 hours:

| Shift | CET Time | Local Time (Europe) | Type |
|-------|----------|---------------------|------|
| **Shift 1** | 00:00-08:00 | 00:00-08:00 | Night |
| **Shift 2** | 08:00-16:00 | 08:00-16:00 | Day |
| **Shift 3** | 16:00-00:00 | 16:00-00:00 | Evening |

### Distribution Logic

Regular work shifts are assigned using a **scoring algorithm** that prioritizes employees based on multiple factors:

#### Scoring Components

1. **Critical Priority (< 165 hours)**
   - Score: `(minTotalHours - totalHours) * 1000`
   - Purpose: Ensure minimum hours are met

2. **High Priority (165-180 hours)**
   - Score: `(targetTotalHours - totalHours) * 30`
   - Purpose: Reach target hours

3. **Low Priority (180-185 hours)**
   - Score: `(maxTotalHours - totalHours) * 5`
   - Purpose: Fill up to maximum

4. **Non-On-Call Bonus**
   - Score: `+200` if employee is not on-call this day
   - Purpose: Reduce days off

5. **Group Bonuses**
   - Europeans: `+25`
   - Brazilians/Australians: `+15`

6. **Random Factor**
   - Score: `Math.random() * 2`
   - Purpose: Ensure fair distribution

#### Assignment Rules

- **Skip if > 185 hours**: Employee exceeding maximum is skipped
- **Parallel Assignment**: Regular work can be assigned on on-call days
- **Multiple Passes**: Algorithm runs 3 passes to ensure minimum hours

### Parallel Assignment

Regular work can be assigned on the same day as on-call duty, allowing employees to work both simultaneously. This helps meet hour requirements while maintaining coverage.

## Total Working Hours Rule (HARD RULE)

### Rule Definition

**CRITICAL:** Each employee must work between **165 and 185 hours per month** (total = on-call hours + regular work hours).

| Parameter | Value | Type |
|-----------|-------|------|
| **Minimum** | 165 hours | Hard limit (cannot be below) |
| **Maximum** | 185 hours | Hard limit (cannot exceed) |
| **Target** | 180 hours | Preferred value |

### Enforcement

The algorithm ensures compliance through:

1. **Multiple Passes**: Runs 3 passes through all available shifts
2. **Priority Scoring**: Employees below minimum get maximum priority
3. **Automatic Assignment**: Aggressively assigns shifts until minimum is met
4. **Maximum Enforcement**: Stops assigning once maximum is reached

### Progress Indicators

| Indicator | Condition | Meaning |
|-----------|-----------|---------|
| ❌ | Total < 165h | **CRITICAL** - Below minimum |
| ⚠️ | Total > 185h | **Warning** - Exceeded maximum |
| ✅ | 165h ≤ Total ≤ 185h | **OK** - Within acceptable range |

## Timezone Conversion

All times are calculated in **CET (Central European Time, UTC+1)** and converted to local time for each employee.

### Conversion Formula

```javascript
localHour = (cetHour - 1 + employeeOffset + 24) % 24
```

**Where:**
- `cetHour`: Hour in CET (0-23)
- `employeeOffset`: UTC offset for employee's timezone
- Result is wrapped to 0-23 range

### Examples

| CET Time | Brazil (UTC-3) | Australia (UTC+10) | Europe (UTC+1) |
|----------|----------------|---------------------|----------------|
| 00:00 | 20:00 (prev day) | 09:00 | 00:00 |
| 08:00 | 04:00 | 17:00 | 08:00 |
| 17:00 | 13:00 | 02:00 (next day) | 17:00 |

## Algorithm Details

### On-Call Distribution Algorithm

```javascript
1. Initialize counters for all employees
2. For each day in month:
   a. Determine working group (rotation formula)
   b. Select employee within group (rotation formula)
   c. Create on-call shift with CET and local times
   d. Record shift in employee's schedule
   e. Update counters
```

### Regular Work Distribution Algorithm

```javascript
1. Calculate on-call hours for each employee
2. Determine minimum regular work needed to reach 165 hours total
3. Create list of all available shifts (all days × all shifts)
4. Shuffle shifts for even distribution
5. For each shift (3 passes):
   a. Score all employees based on:
      - Hours needed to reach minimum/target/maximum
      - On-call status for the day
      - Group affiliation
      - Consecutive day limits (for Europeans)
      - Random factor for variety
   b. Assign shift to highest-scoring employee
   c. Update counters
6. Remove one shift per employee (if above minimum) to target ~180 hours
```

## Special Rules

### Consecutive Day Limits (Europeans Only)

**Soft Rule**: For European employees, the system enforces:

- **Maximum 5 consecutive work days**
- **Maximum 2 consecutive days off**

#### Implementation

1. **During Assignment**:
   - If employee has 5+ consecutive work days and is not below minimum, skip assignment
   - Bonus (+50) for employees with 2+ consecutive days off
   - Penalty (-30) for employees with 4+ consecutive work days

2. **During Shift Removal**:
   - Prefer removing shifts from days that are part of long consecutive work streaks (5+ days)

### Shift Removal Logic

After initial assignment, the system removes one regular work shift from each employee to target ~180 hours:

1. **Conditions**:
   - Employee has at least one shift
   - After removal, employee will still have ≥ 165 hours

2. **Priority** (for Europeans):
   - Days that are part of long consecutive work streaks (5+ days)
   - Non-on-call days
   - Weekends

## CSV Export Format

The exported CSV includes the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| Employee | Employee name | "Europe 1" |
| Timezone | Timezone identifier | "Europe/Berlin" |
| Day | Day of month | 15 |
| Date | Date in DD.MM.YYYY format | "15.03.2024" |
| Day of week | Day name | "Mon" |
| Type | Day type | "Regular work" |
| Shift | Shift name | "Shift 2" |
| CET time | Shift time in CET | "08:00-16:00" |
| Local time | Shift time in local timezone | "08:00-16:00" |
| On-call | On-call status | "Yes" or "No" |
| Shift hours | Regular work hours | "8" or "0" |
| On-call hours | On-call hours | "9" or "0" |

## Statistics Tracking

The system tracks and displays:

- **On-call shifts count** and hours per employee
- **Regular work shifts count** (by shift type) and hours per employee
- **Total hours** (on-call + regular work) per employee
- **Progress indicator** (❌/⚠️/✅) per employee
- **Comparison** against 165-185 hour range

## Notes

- Weekend days are marked but can still have work assigned
- The algorithm prioritizes reducing "Day off" days by assigning regular work to non-on-call days
- Shift assignments are randomized within passes to ensure fair distribution
- The system ensures all employees meet the minimum 165 hours before optimizing for target 180 hours
- For Europeans, consecutive day limits are soft rules that can be overridden if needed to meet minimum hours

---

**Version**: 1.0.0  
**Last Updated**: January 15, 2025

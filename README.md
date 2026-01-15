# 📅 Team Schedule - Workload Balancing

Visualization and management of work schedule for a distributed team with on-call rotation balancing, working hours, and days off.

## 👥 Team Composition

- **Brazil**: 2 employees (America/Sao_Paulo, UTC-3)
- **Australia**: 2 employees (Australia/Sydney, UTC+10)
- **Europe**: 7 employees (Europe/Berlin, CET, UTC+1) - main load for partner requests

## 📋 Features

✅ **Schedule Visualization** - Interactive calendar with color coding  
✅ **8-hour shift system** - 3 shifts per day (24/7 coverage) utilizing all timezones  
✅ **165-185 working hours per month** - Each employee gets regular work shifts to meet the target (HARD RULE)  
✅ **CET and local time** - Display shift times in both formats  
✅ **On-call rotation** - Fair distribution of 24/7 on-call duties (100% sitting at computer, always available)  
✅ **Weekend days** - Shifts can be assigned on weekends to reach target hours  
✅ **Statistics** - Count shifts, on-call hours, and total workload with progress indicators  
✅ **CSV export** - For import into calendar applications or Excel  

## 📖 Schedule Rules

For detailed information about shift logic, on-call distribution, and working hours rules, see **[SCHEDULE_RULES.md](SCHEDULE_RULES.md)**.

## 🚀 Usage

### Option 1: Interactive Web Visualization

1. Open `schedule.html` in your browser
2. Select month and year
3. Click "Update Schedule"
4. Use "Export to CSV" to save data

### Option 2: CSV Generation via Command Line

```bash
# Current month
node generate_schedule.js

# Specify month and year
node generate_schedule.js 3 2024  # March 2024
node generate_schedule.js 12 2024 # December 2024
```

## 🎨 Color Legend

- 🔵 **Blue** - Shift 1 (00:00-08:00 CET) - Night shift
- 🟡 **Yellow** - Shift 2 (08:00-16:00 CET) - Day shift
- 🟣 **Pink** - Shift 3 (16:00-00:00 CET) - Evening shift
- 🟠 **Orange** - On-call (with 1h overlap for handover)
- 🟢🟠 **Combined** - Regular work + On-call (parallel)
- 🟣 **Purple** - Day off
- ⚪ **Gray** - Outside working hours

## 📊 Distribution Logic

### Shift System (8 hours)
- **3 shifts per day** of 8 hours each (24/7 coverage):
  - **Shift 1**: 00:00-08:00 CET (Night)
  - **Shift 2**: 08:00-16:00 CET (Day)
  - **Shift 3**: 16:00-00:00 CET (Evening)
- **Target**: 165-185 working hours per month per employee (HARD RULE)
  - This is approximately **20-23 shifts** of 8 hours each
  - Shifts are distributed considering all days of the month (including weekends if needed)
- Shifts are distributed evenly among all 11 employees
- Shift time is displayed in **CET** and in each employee's **local time**
- All three timezones (Brazil, Australia, Europe) are used for 24/7 coverage
- **Priority**: Work days get priority, but shifts can be assigned on weekends to reach target

### Time Conversion
Shift time is automatically converted from CET to local time:
- **Brazil** (UTC-3): Shift 2 (08:00-16:00 CET) = 04:00-12:00 local time
- **Australia** (UTC+10): Shift 2 (08:00-16:00 CET) = 17:00-01:00 local time
- **Europe** (UTC+1): Shift 2 (08:00-16:00 CET) = 08:00-16:00 local time

### On-Call Rotation
- Distributed among three groups (Brazil, Australia, Europe) with rotation
- On-call shifts align with each group's local working hours (9:00-18:00 local) with 1-hour overlaps for handover
- **On-call = 100% sitting at computer, always available**
- **Important**: Regular work can be assigned in parallel with on-call days
- On-call hours are counted separately from regular work hours
- See [SCHEDULE_RULES.md](SCHEDULE_RULES.md) for detailed on-call shift times

### Weekends
- Saturday and Sunday for all employees
- Employees can work shifts and be on-call on weekends

## 📈 Statistics

The schedule automatically calculates:
- Number of shifts of each type (Shift 1/2/3) per employee
- Shift hours (number of shifts × 8 hours)
- **Progress indicator**: ✅ if 165-185h, ⚠️ if >185h, ❌ if <165h
- Number of on-call shifts per employee
- On-call hours (calculated based on shift duration, not 24h)
- Total workload (shift hours + on-call hours)
- **Target**: 165-185 hours total (on-call + regular work) per month (HARD RULE)

## 🔧 Configuration

To change team composition or working hours, edit the `team` object in:
- `schedule.html` (around line ~350)
- `generate_schedule.js` (around line ~12)

## 📝 CSV Format

The CSV file contains the following columns:
- Employee
- Timezone
- Day (day of month)
- Date (DD.MM.YYYY)
- Day of week
- Type (On-call, Regular work, Day off)
- Shift (Shift 1/2/3 or None)
- CET time (e.g., 08:00-16:00)
- Local time (converted shift time)
- On-call (Yes/No)
- Shift hours (8 or 0)
- On-call hours (calculated based on shift duration)

## 💡 Recommendations

1. **European team** receives the main load of partner requests, so their working hours align with European business time
2. **On-call rotation** is distributed evenly so no one is overloaded
3. Use CSV export to import into calendar systems (Google Calendar, Outlook, etc.)
4. Regularly check workload balance through statistics
5. Ensure all employees meet the 165-185 hour target (HARD RULE)

## 📅 Example Usage

```bash
# Generate schedule for March 2024
node generate_schedule.js 3 2024

# Open visualization
open schedule.html  # macOS
# or simply open schedule.html in your browser
```

## 🔄 Schedule Updates

The schedule is automatically recalculated when:
- Month/year is changed in the interface
- Team composition is updated in code
- A new CSV file is generated

---

**Version**: 1.0.0  
**Last Updated**: 2024

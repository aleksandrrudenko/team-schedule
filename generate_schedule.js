#!/usr/bin/env node

/**
 * Team Schedule Generator
 * Creates CSV file with schedule for all employees
 */

const fs = require('fs');
const path = require('path');

// Team configuration
const team = {
    brazil: [
        { name: 'Brazil 1', timezone: 'America/Sao_Paulo', offset: -3, workStart: 9, workEnd: 18 },
        { name: 'Brazil 2', timezone: 'America/Sao_Paulo', offset: -3, workStart: 9, workEnd: 18 }
    ],
    australia: [
        { name: 'Australia 1', timezone: 'Australia/Sydney', offset: 10, workStart: 9, workEnd: 18 },
        { name: 'Australia 2', timezone: 'Australia/Sydney', offset: 10, workStart: 9, workEnd: 18 }
    ],
    europe: [
        { name: 'Europe 1', timezone: 'Europe/Berlin', offset: 1, workStart: 9, workEnd: 18 },
        { name: 'Europe 2', timezone: 'Europe/Berlin', offset: 1, workStart: 9, workEnd: 18 },
        { name: 'Europe 3', timezone: 'Europe/Berlin', offset: 1, workStart: 9, workEnd: 18 },
        { name: 'Europe 4', timezone: 'Europe/Berlin', offset: 1, workStart: 9, workEnd: 18 },
        { name: 'Europe 5', timezone: 'Europe/Berlin', offset: 1, workStart: 9, workEnd: 18 },
        { name: 'Europe 6', timezone: 'Europe/Berlin', offset: 1, workStart: 9, workEnd: 18 },
        { name: 'Europe 7', timezone: 'Europe/Berlin', offset: 1, workStart: 9, workEnd: 18 }
    ]
};

const allEmployees = [...team.brazil, ...team.australia, ...team.europe];

// Shift definitions (time in CET)
const shifts = [
    { id: 1, name: 'Shift 1', startCET: 0, endCET: 8, label: '00:00-08:00' },   // Night
    { id: 2, name: 'Shift 2', startCET: 8, endCET: 16, label: '08:00-16:00' },  // Day
    { id: 3, name: 'Shift 3', startCET: 16, endCET: 24, label: '16:00-00:00' }  // Evening
];

// Convert time from CET to local time
function convertCETToLocal(cetHour, employeeOffset) {
    const cetOffset = 1; // CET = UTC+1
    const localHour = (cetHour - cetOffset + employeeOffset + 24) % 24;
    return localHour;
}

// Format time
function formatTime(hour) {
    return String(hour).padStart(2, '0') + ':00';
}

function getDaysInMonth(month, year) {
    const days = [];
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month, day);
        days.push({
            date: date,
            day: day,
            dayOfWeek: date.getDay(),
            isWeekend: date.getDay() === 0 || date.getDay() === 6
        });
    }
    
    return days;
}

// Distribute on-call shifts between groups
// On-call shifts are assigned during each group's working hours (9:00-18:00 local time)
// Group 1: Brazil, Group 2: Australia, Group 3: Europe
function distributeOnCall(days) {
    const onCallSchedule = {};
    const groups = [
        { name: 'Brazil', employees: team.brazil, workStart: 9, workEnd: 18 },
        { name: 'Australia', employees: team.australia, workStart: 9, workEnd: 18 },
        { name: 'Europe', employees: team.europe, workStart: 9, workEnd: 18 }
    ];
    
    // Initialize counters
    allEmployees.forEach(emp => {
        onCallSchedule[emp.name] = { count: 0, days: [], shifts: [] };
    });

    // Distribute on-call shifts with 1 hour overlap for handover
    // Australia: CET 00:00-09:00 (9 hours)
    // Europe: CET 08:00-18:00 (10 hours, overlap 08:00-09:00)
    // Brazil: CET 17:00-01:00 (8 hours, overlap 17:00-18:00 and 00:00-01:00)
    const onCallShiftsByGroup = {
        'Australia': { startCET: 0, endCET: 9 },
        'Europe': { startCET: 8, endCET: 18 },
        'Brazil': { startCET: 17, endCET: 1 } // Crosses midnight
    };
    
    days.forEach((dayInfo, dayIndex) => {
        groups.forEach((group, groupIndex) => {
            // Determine which group works on this day (rotation)
            const dayGroupIndex = (dayIndex + groupIndex) % groups.length;
            const workingGroup = groups[dayGroupIndex];
            
            // Distribute on-call shift within group between employees
            const employeeIndexInGroup = Math.floor(dayIndex / groups.length) % workingGroup.employees.length;
            const employee = workingGroup.employees[employeeIndexInGroup];
            
            // Get shift time in CET for this group
            const shiftTimes = onCallShiftsByGroup[workingGroup.name];
            const cetStart = shiftTimes.startCET;
            const cetEnd = shiftTimes.endCET;
            
            // Convert to group's local time
            const cetOffset = 1; // CET = UTC+1
            const groupOffset = workingGroup.employees[0].offset;
            
            // Local start time
            const localStart = (cetStart - cetOffset + groupOffset + 24) % 24;
            
            // Local end time (account for midnight crossover for Brazil)
            let localEnd;
            if (cetEnd < cetStart) {
                // Crosses midnight (Brazil)
                localEnd = (cetEnd - cetOffset + groupOffset + 24) % 24;
            } else {
                localEnd = (cetEnd - cetOffset + groupOffset + 24) % 24;
            }
            
            // Format CET time (account for midnight crossover)
            let cetLabel;
            if (cetEnd < cetStart) {
                cetLabel = `${formatTime(cetStart)}-${formatTime(cetEnd)}+1`; // +1 means next day
            } else {
                cetLabel = `${formatTime(cetStart)}-${formatTime(cetEnd)}`;
            }
            
            // Create on-call shift
            const onCallShift = {
                id: 'oncall',
                name: 'On-call',
                startCET: cetStart,
                endCET: cetEnd,
                crossesMidnight: cetEnd < cetStart,
                startLocal: localStart,
                endLocal: localEnd,
                label: cetLabel,
                labelLocal: `${formatTime(localStart)}-${formatTime(localEnd)}`
            };
            
            onCallSchedule[employee.name].count++;
            onCallSchedule[employee.name].days.push(dayInfo.day);
            onCallSchedule[employee.name].shifts.push({
                day: dayInfo.day,
                shift: onCallShift
            });
        });
    });

    return onCallSchedule;
}

// Distribute regular work (shifts) between employees
// HARD RULE: 165-185 hours per month = on-call hours + regular work hours
// Regular work can be parallel with on-call
function distributeShifts(days, onCallSchedule) {
    const shiftSchedule = {};
    const minTotalHours = 165; // MINIMUM (hard rule)
    const maxTotalHours = 185; // MAXIMUM
    const targetTotalHours = 180; // Target value
    
    // Initialize
    allEmployees.forEach(emp => {
        shiftSchedule[emp.name] = {};
        days.forEach(dayInfo => {
            shiftSchedule[emp.name][dayInfo.day] = null;
        });
    });

    // Calculate statistics per employee
    const employeeStats = {};
    allEmployees.forEach(emp => {
        // Calculate on-call hours accounting for midnight crossover
        let onCallHours = 0;
        onCallSchedule[emp.name].shifts.forEach(shiftInfo => {
            const shift = shiftInfo.shift;
            if (shift.crossesMidnight) {
                // Crosses midnight: 17:00-01:00 = 8 hours
                onCallHours += 8;
            } else {
                // Regular shift: calculate difference
                const hours = shift.endCET - shift.startCET;
                onCallHours += hours;
            }
        });
        // Check employee group
        const isEuropean = team.europe.some(e => e.name === emp.name);
        const isBrazilian = team.brazil.some(e => e.name === emp.name);
        const isAustralian = team.australia.some(e => e.name === emp.name);
        
        // HARD RULE: minimum 165 hours total (on-call + regular work), maximum 185
        // Calculate how much regular work is needed to reach minimum 165 hours
        const minRegularHours = Math.max(0, minTotalHours - onCallHours); // Minimum regular work to reach 165 hours
        const maxRegularHours = Math.max(0, maxTotalHours - onCallHours); // Maximum regular work
        const targetRegularHours = Math.max(0, targetTotalHours - onCallHours); // Target regular work
        
        // FOR ALL the same: minimum regular work to reach 165 hours total
        // DO NOT set different minimums for different groups
        const finalTargetRegularHours = minRegularHours; // Minimum to reach 165 hours total
        
        const targetRegularShifts = Math.ceil(finalTargetRegularHours / 8); // 8 hours per shift
        
        employeeStats[emp.name] = {
            shifts: 0,
            onCallHours: onCallHours,
            targetRegularShifts: targetRegularShifts,
            isEuropean: isEuropean,
            isBrazilian: isBrazilian,
            isAustralian: isAustralian
        };
    });

    // Create list of all available shifts (all days, all shifts)
    const allShifts = [];
    days.forEach(dayInfo => {
        shifts.forEach(shift => {
            allShifts.push({ day: dayInfo, shift: shift });
        });
    });

    // Shuffle for more even distribution
    for (let i = allShifts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allShifts[i], allShifts[j]] = [allShifts[j], allShifts[i]];
    }

    // Distribute shifts - HARD RULE: minimum 165 hours for ALL
    // Pass multiple times to guarantee minimum
    for (let pass = 0; pass < 3; pass++) {
        // Shuffle again for each pass
        for (let i = allShifts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allShifts[i], allShifts[j]] = [allShifts[j], allShifts[i]];
        }
        
        // Regular work can be parallel with on-call
        // Priority to those not on-call this day (to reduce days off)
        allShifts.forEach(({ day, shift }) => {
        // Find employee who:
        // 1. Has not reached 180 hours yet (continue assigning even after target)
        // 2. Priority to those with fewer hours
        // 3. HUGE priority to those NOT on-call this day (to reduce days off)
        // 4. Regular work can be parallel with on-call
        
        let bestEmployee = null;
        let bestScore = -1;
        
        allEmployees.forEach((emp, empIndex) => {
            const isOnCall = onCallSchedule[emp.name].days.includes(day.day);
            
            const currentShifts = employeeStats[emp.name].shifts;
            const onCallHours = employeeStats[emp.name].onCallHours;
            const currentRegularHours = currentShifts * 8;
            const totalHours = onCallHours + currentRegularHours;
            const targetShifts = employeeStats[emp.name].targetRegularShifts;
            const isEuropean = employeeStats[emp.name].isEuropean;
            const isBrazilian = employeeStats[emp.name].isBrazilian;
            const isAustralian = employeeStats[emp.name].isAustralian;
            
            // HARD RULE: minimum 165 hours, maximum 185 hours
            const hoursNeeded = minTotalHours - totalHours; // How much needed to reach minimum
            const hoursOverMax = totalHours - maxTotalHours; // Over maximum
            
            // If exceeded maximum, skip
            if (hoursOverMax > 0) {
                return;
            }
            
            // If reached minimum (165) but not maximum (185), continue with lower priority
            // If below minimum - HUGE priority
            const isBelowMinimum = totalHours < minTotalHours;
            const isBelowTarget = totalHours < targetTotalHours;
            
            // Scoring: priority to those with fewer hours, work days
            // HUGE priority to those NOT on-call (to reduce days off)
            let score = 0;
            
            if (isBelowMinimum) {
                // CRITICAL priority - below minimum!
                score = (minTotalHours - totalHours) * 1000 + // HUGE weight for those below minimum
                        (targetShifts - currentShifts) * 50 +
                        (day.isWeekend ? 0 : 10);
            } else if (isBelowTarget) {
                // High priority - below target value
                score = (targetTotalHours - totalHours) * 30 +
                        (targetShifts - currentShifts) * 20 +
                        (day.isWeekend ? 0 : 5);
            } else {
                // Low priority - already reached target, but can add up to maximum
                score = (maxTotalHours - totalHours) * 5 +
                        (day.isWeekend ? 0 : 2);
            }
            
            // HUGE bonus for those NOT on-call this day
            if (!isOnCall) {
                score += 200; // Very large bonus to fill days without on-call
            }
            
            // Group bonuses
            if (isEuropean) {
                score += 25; // Large bonus for Europeans
            } else if (isBrazilian || isAustralian) {
                score += 15; // Bonus for Brazilians and Australians
            }
            
            score += (Math.random() * 2); // Small randomness for variety
            
            if (score > bestScore) {
                bestScore = score;
                bestEmployee = emp;
            }
        });
        
        // Assign shift to best candidate
        // IMPORTANT: if employee is below minimum 165 hours, assign shift even if already has shift this day
        if (bestEmployee) {
            const empTotalHours = employeeStats[bestEmployee.name].onCallHours + 
                                 employeeStats[bestEmployee.name].shifts * 8;
            const isBelowMinimum = empTotalHours < minTotalHours;
            const hadShift = !!shiftSchedule[bestEmployee.name][day.day];
            
            // If below minimum - assign shift in any case (may replace existing)
            if (isBelowMinimum || !hadShift) {
                shiftSchedule[bestEmployee.name][day.day] = shift;
                // Update counter only if this is a new shift
                if (!hadShift) {
                    employeeStats[bestEmployee.name].shifts++;
                }
            }
        }
    });
    } // End of passes loop

    // Remove one regular work shift from each employee to get closer to ~180 hours
    // This is done after ensuring minimum 165 hours is met
    allEmployees.forEach(emp => {
        const onCallHours = employeeStats[emp.name].onCallHours;
        const currentShifts = employeeStats[emp.name].shifts;
        const currentRegularHours = currentShifts * 8;
        const totalHours = onCallHours + currentRegularHours;
        
        // Only remove a shift if:
        // 1. Employee has at least one shift
        // 2. After removal, they will still have >= 165 hours
        if (currentShifts > 0 && (totalHours - 8) >= minTotalHours) {
            // Find a day with a regular work shift (prefer non-on-call days, then weekends)
            const daysWithShifts = [];
            days.forEach(dayInfo => {
                const hasShift = !!shiftSchedule[emp.name][dayInfo.day];
                const isOnCall = onCallSchedule[emp.name].days.includes(dayInfo.day);
                if (hasShift) {
                    daysWithShifts.push({
                        day: dayInfo.day,
                        dayInfo: dayInfo,
                        isOnCall: isOnCall,
                        isWeekend: dayInfo.isWeekend
                    });
                }
            });
            
            // Prefer removing from non-on-call days, then weekends
            daysWithShifts.sort((a, b) => {
                if (a.isOnCall !== b.isOnCall) return a.isOnCall ? 1 : -1;
                if (a.isWeekend !== b.isWeekend) return a.isWeekend ? 1 : -1;
                return 0;
            });
            
            // Remove the first shift (prefer non-on-call, non-weekend)
            if (daysWithShifts.length > 0) {
                const dayToRemove = daysWithShifts[0].day;
                shiftSchedule[emp.name][dayToRemove] = null;
                employeeStats[emp.name].shifts--;
            }
        }
    });

    return shiftSchedule;
}

function generateCSV(month, year) {
    const days = getDaysInMonth(month, year);
    const onCallSchedule = distributeOnCall(days);
    const shiftSchedule = distributeShifts(days, onCallSchedule);
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    let csv = 'Employee,Timezone,Day,Date,Day of week,Type,Shift,CET time,Local time,On-call,Shift hours,On-call hours\n';
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    allEmployees.forEach(emp => {
        days.forEach(dayInfo => {
            const isOnCall = onCallSchedule[emp.name].days.includes(dayInfo.day);
            const onCallShift = onCallSchedule[emp.name].shifts.find(s => s.day === dayInfo.day);
            const regularShift = shiftSchedule[emp.name][dayInfo.day];
            
            const dateStr = `${String(dayInfo.day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;
            const dayName = dayNames[dayInfo.dayOfWeek];
            
            // Determine day type: On-call, Regular work, or Day off
            let dayType = 'Day off';
            let shiftName = 'None';
            let timeCET = '';
            let timeLocal = '';
            let shiftHours = '0';
            let onCallHours = '0';
            
            if (isOnCall && onCallShift) {
                // On-call
                dayType = 'On-call';
                shiftName = 'On-call';
                timeCET = onCallShift.shift.label;
                timeLocal = onCallShift.shift.labelLocal;
                // Calculate on-call hours
                if (onCallShift.shift.crossesMidnight) {
                    onCallHours = '8'; // 17:00-01:00 = 8 hours
                } else {
                    onCallHours = String(onCallShift.shift.endCET - onCallShift.shift.startCET);
                }
            } else if (regularShift) {
                // Regular work
                dayType = 'Regular work';
                shiftName = regularShift.name;
                timeCET = regularShift.label;
                const localStart = convertCETToLocal(regularShift.startCET, emp.offset);
                const localEnd = convertCETToLocal(regularShift.endCET, emp.offset);
                timeLocal = `${formatTime(localStart)}-${formatTime(localEnd)}`;
                shiftHours = '8';
            }

            csv += `${emp.name},${emp.timezone},${dayInfo.day},${dateStr},${dayName},${dayType},${shiftName},${timeCET},${timeLocal},${isOnCall ? 'Yes' : 'No'},${shiftHours},${onCallHours}\n`;
        });
    });
    
    const filename = `schedule_${monthNames[month]}_${year}.csv`;
    fs.writeFileSync(filename, '\ufeff' + csv, 'utf8'); // BOM for proper Excel display
    console.log(`✅ Schedule saved to file: ${filename}`);
    
    // Print statistics
    const minHours = 165;
    const maxHours = 185;
    console.log(`\n📊 Statistics: On-call (with 1h overlap) + Regular work = ${minHours}-${maxHours}h/month (HARD RULE)\n`);
    allEmployees.forEach(emp => {
        const onCallCount = onCallSchedule[emp.name].count;
        // Calculate on-call hours accounting for midnight crossover
        let onCallHours = 0;
        onCallSchedule[emp.name].shifts.forEach(shiftInfo => {
            const shift = shiftInfo.shift;
            if (shift.crossesMidnight) {
                onCallHours += 8; // 17:00-01:00 = 8 hours
            } else {
                onCallHours += (shift.endCET - shift.startCET);
            }
        });
        let shiftCount = 0;
        let shift1Count = 0, shift2Count = 0, shift3Count = 0;
        days.forEach(dayInfo => {
            const shift = shiftSchedule[emp.name][dayInfo.day];
            if (shift) {
                shiftCount++;
                if (shift.id === 1) shift1Count++;
                else if (shift.id === 2) shift2Count++;
                else if (shift.id === 3) shift3Count++;
            }
        });
        const shiftHours = shiftCount * 8;
        const totalHours = shiftHours + onCallHours;
        let progress;
        if (totalHours < minHours) {
            progress = '❌'; // Below minimum - CRITICAL
        } else if (totalHours > maxHours) {
            progress = '⚠️'; // Exceeded maximum
        } else {
            progress = '✅'; // Within acceptable range
        }
        console.log(`  ${emp.name}: On-call ${onCallCount} shifts = ${onCallHours}h, Regular work ${shiftCount} shifts (${shift1Count}/${shift2Count}/${shift3Count}) = ${shiftHours}h, Total ${totalHours}h ${progress} (range: ${minHours}-${maxHours}h)`);
    });
}

// Command line parameters
const args = process.argv.slice(2);
let month = new Date().getMonth();
let year = new Date().getFullYear();

if (args.length >= 1) {
    month = parseInt(args[0]) - 1;
    if (isNaN(month) || month < 0 || month > 11) {
        console.error('❌ Error: month must be between 1 and 12');
        process.exit(1);
    }
}

if (args.length >= 2) {
    year = parseInt(args[1]);
    if (isNaN(year) || year < 2020 || year > 2100) {
        console.error('❌ Error: invalid year');
        process.exit(1);
    }
}

console.log(`📅 Generating schedule for ${month + 1}/${year}...\n`);
generateCSV(month, year);
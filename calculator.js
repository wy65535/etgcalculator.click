// ETG Calculator JavaScript
let etgChart = null;

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

    // Calculator form submission
    const calculatorForm = document.getElementById('etgCalculator');
    if (calculatorForm) {
        calculatorForm.addEventListener('submit', function(e) {
            e.preventDefault();
            calculateETG();
        });
    }
});

function calculateETG() {
    // Get input values
    const alcoholAmount = parseFloat(document.getElementById('alcoholAmount').value);
    const bodyWeight = parseFloat(document.getElementById('bodyWeight').value);
    const gender = document.getElementById('gender').value;
    const drinkingDuration = parseFloat(document.getElementById('drinkingDuration').value);
    const timeSinceDrinking = parseFloat(document.getElementById('timeSinceDrinking').value);
    const hydration = document.getElementById('hydration').value;
    const testThreshold = parseFloat(document.getElementById('testThreshold').value);

    // Calculate BAC and ETG levels
    const results = calculateETGLevels(
        alcoholAmount,
        bodyWeight,
        gender,
        drinkingDuration,
        timeSinceDrinking,
        hydration,
        testThreshold
    );

    // Display results
    displayResults(results, testThreshold);
    
    // Scroll to results
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function calculateETGLevels(alcoholAmount, bodyWeight, gender, drinkingDuration, timeSinceDrinking, hydration, testThreshold) {
    // Constants
    const GRAMS_PER_DRINK = 14; // Standard drink = 14g pure alcohol
    const WIDMARK_MALE = 0.68;
    const WIDMARK_FEMALE = 0.55;
    const METABOLISM_RATE = 0.015; // BAC decrease per hour
    
    // ETG production and elimination constants
    const ETG_PRODUCTION_RATIO = 0.5; // % of alcohol that becomes ETG (in µg/mg)
    const ETG_HALF_LIFE = 2.5; // hours
    const ETG_ELIMINATION_CONSTANT = Math.log(2) / ETG_HALF_LIFE; // k = 0.693/t½
    
    // Adjust for body weight (lbs to kg)
    const bodyWeightKg = bodyWeight * 0.453592;
    
    // Widmark factor based on gender
    const widmarkFactor = gender === 'male' ? WIDMARK_MALE : WIDMARK_FEMALE;
    
    // Total grams of alcohol consumed
    const totalAlcoholGrams = alcoholAmount * GRAMS_PER_DRINK;
    
    // Calculate peak BAC (g/dL)
    const peakBAC = totalAlcoholGrams / (bodyWeightKg * widmarkFactor * 1000);
    
    // Adjust peak BAC for drinking duration (alcohol consumed over time)
    const alcoholMetabolizedDuringDrinking = METABOLISM_RATE * drinkingDuration;
    const adjustedPeakBAC = Math.max(0, peakBAC - alcoholMetabolizedDuringDrinking);
    
    // Calculate current BAC
    const currentBAC = Math.max(0, adjustedPeakBAC - (METABOLISM_RATE * timeSinceDrinking));
    
    // Calculate peak ETG in ng/mL
    // ETG peak occurs 2-4 hours after drinking stops
    const etgPeakTime = 3; // hours after last drink
    let peakETG = totalAlcoholGrams * 250; // Rough estimate: 250 ng/mL per gram of alcohol
    
    // Adjust for gender (females tend to have higher ETG concentrations)
    if (gender === 'female') {
        peakETG *= 1.2;
    }
    
    // Adjust for hydration
    const hydrationMultiplier = {
        'low': 1.3,      // Dehydrated = more concentrated
        'normal': 1.0,
        'high': 0.7      // Well hydrated = more diluted
    };
    peakETG *= hydrationMultiplier[hydration];
    
    // Calculate time to reach peak ETG
    const timeToPeak = Math.max(0, etgPeakTime - timeSinceDrinking);
    
    // Calculate current ETG level
    let currentETG;
    if (timeSinceDrinking < etgPeakTime) {
        // Still rising to peak
        currentETG = peakETG * (timeSinceDrinking / etgPeakTime);
    } else {
        // Past peak, exponential elimination
        const timeAfterPeak = timeSinceDrinking - etgPeakTime;
        currentETG = peakETG * Math.exp(-ETG_ELIMINATION_CONSTANT * timeAfterPeak);
    }
    
    // Calculate time until ETG drops below threshold
    let hoursToPassTest = 0;
    if (currentETG > testThreshold) {
        if (timeSinceDrinking < etgPeakTime) {
            // Need to wait for peak, then elimination
            const timeToReachThreshold = etgPeakTime + (Math.log(peakETG / testThreshold) / ETG_ELIMINATION_CONSTANT);
            hoursToPassTest = timeToReachThreshold - timeSinceDrinking;
        } else {
            // Already past peak, just elimination
            hoursToPassTest = Math.log(currentETG / testThreshold) / ETG_ELIMINATION_CONSTANT;
        }
    }
    
    // Calculate time until complete elimination (below 100 ng/mL minimum threshold)
    const minThreshold = 100;
    let hoursToCompleteElimination;
    if (timeSinceDrinking < etgPeakTime) {
        hoursToCompleteElimination = etgPeakTime + (Math.log(peakETG / minThreshold) / ETG_ELIMINATION_CONSTANT) - timeSinceDrinking;
    } else {
        hoursToCompleteElimination = Math.log(Math.max(currentETG, minThreshold) / minThreshold) / ETG_ELIMINATION_CONSTANT;
    }
    
    // Generate timeline data for chart
    const timelineData = generateTimeline(peakETG, etgPeakTime, timeSinceDrinking, ETG_ELIMINATION_CONSTANT, testThreshold);
    
    return {
        peakBAC: peakBAC,
        currentBAC: currentBAC,
        peakETG: peakETG,
        currentETG: currentETG,
        hoursToPassTest: Math.max(0, hoursToPassTest),
        hoursToCompleteElimination: Math.max(0, hoursToCompleteElimination),
        timelineData: timelineData,
        timeToPeak: timeToPeak
    };
}

function generateTimeline(peakETG, peakTime, currentTime, eliminationConstant, threshold) {
    const timeline = [];
    const maxHours = 120; // Show up to 5 days
    
    // Calculate minimum hours to show (at least to current time + some padding)
    const minHoursToShow = Math.max(currentTime + 10, 24);
    
    for (let hour = 0; hour <= maxHours; hour += 2) {
        let etgLevel;
        if (hour < peakTime) {
            // Rising to peak
            etgLevel = peakETG * (hour / peakTime);
        } else {
            // Exponential elimination
            const timeAfterPeak = hour - peakTime;
            etgLevel = peakETG * Math.exp(-eliminationConstant * timeAfterPeak);
        }
        
        timeline.push({
            hour: hour,
            etgLevel: Math.max(0, etgLevel),
            isCurrentTime: Math.abs(hour - currentTime) < 1
        });
        
        // Only stop if ETG is negligible AND we've shown enough timeline
        if (etgLevel < 10 && hour >= minHoursToShow) break;
    }
    
    // Ensure we have at least a reasonable number of data points
    if (timeline.length < 5) {
        // If timeline is too short, regenerate with smaller intervals
        timeline.length = 0;
        const endTime = Math.max(minHoursToShow, 48);
        for (let hour = 0; hour <= endTime; hour += 4) {
            let etgLevel;
            if (hour < peakTime) {
                etgLevel = peakETG * (hour / peakTime);
            } else {
                const timeAfterPeak = hour - peakTime;
                etgLevel = peakETG * Math.exp(-eliminationConstant * timeAfterPeak);
            }
            
            timeline.push({
                hour: hour,
                etgLevel: Math.max(0, etgLevel),
                isCurrentTime: Math.abs(hour - currentTime) < 2
            });
        }
    }
    
    return timeline;
}

function displayResults(results, threshold) {
    const resultsDiv = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    
    // Determine if will pass test
    const willPass = results.currentETG < threshold;
    const passStatus = willPass ? 'result-success' : 'result-danger';
    const passText = willPass ? '✅ LIKELY TO PASS' : '❌ LIKELY TO FAIL';
    
    // Format time remaining
    const hoursRemaining = Math.ceil(results.hoursToPassTest);
    const daysRemaining = Math.floor(hoursRemaining / 24);
    const hoursRemainingMod = hoursRemaining % 24;
    
    let timeRemainingText;
    if (hoursRemaining === 0) {
        timeRemainingText = 'Now - ETG below threshold';
    } else if (daysRemaining > 0) {
        timeRemainingText = `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} ${hoursRemainingMod} hour${hoursRemainingMod !== 1 ? 's' : ''}`;
    } else {
        timeRemainingText = `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
    }
    
    // Calculate elimination date
    const eliminationDate = new Date();
    eliminationDate.setHours(eliminationDate.getHours() + results.hoursToPassTest);
    const dateString = eliminationDate.toLocaleString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    
    // Complete elimination time
    const completeHours = Math.ceil(results.hoursToCompleteElimination);
    const completeDays = Math.floor(completeHours / 24);
    const completeHoursMod = completeHours % 24;
    let completeTimeText;
    if (completeHours === 0) {
        completeTimeText = 'Already eliminated - ETG below detectable levels';
    } else if (completeDays > 0) {
        completeTimeText = `${completeDays} day${completeDays > 1 ? 's' : ''} ${completeHoursMod} hour${completeHoursMod !== 1 ? 's' : ''}`;
    } else {
        completeTimeText = `${completeHours} hour${completeHours !== 1 ? 's' : ''}`;
    }
    
    resultsContent.innerHTML = `
        <div class="result-item ${passStatus}">
            <h4>Test Result Status (${threshold} ng/mL threshold)</h4>
            <p class="result-highlight">${passText}</p>
        </div>
        
        <div class="result-item">
            <h4>Current ETG Level</h4>
            <p class="result-highlight">${results.currentETG.toFixed(0)} ng/mL</p>
            <p>Peak ETG Level: ${results.peakETG.toFixed(0)} ng/mL</p>
        </div>
        
        <div class="result-item ${willPass ? 'result-success' : 'result-warning'}">
            <h4>Time Until Passing ${threshold} ng/mL Test</h4>
            <p class="result-highlight">${timeRemainingText}</p>
            <p>${hoursRemaining > 0 ? `Estimated pass time: ${dateString}` : 'You can take the test now'}</p>
        </div>
        
        <div class="result-item">
            <h4>Complete ETG Elimination</h4>
            <p class="result-highlight">${completeTimeText}</p>
            <p>${completeHours > 0 ? 'Time until ETG drops below 100 ng/mL (most sensitive tests)' : 'ETG is below 100 ng/mL threshold'}</p>
        </div>
        
        <div class="result-item">
            <h4>Current BAC Estimate</h4>
            <p class="result-highlight">${(results.currentBAC * 100).toFixed(3)}%</p>
            <p>${results.currentBAC > 0 ? '⚠️ Alcohol still in system' : '✅ Alcohol metabolized'}</p>
        </div>
        
        <div class="result-item">
            <h4>Detection Window Information</h4>
            <p>• ETG Peak Time: ${results.timeToPeak > 0 ? `In ${results.timeToPeak.toFixed(1)} hours` : 'Already passed'}</p>
            <p>• Standard Detection: 48-80 hours after drinking</p>
            <p>• Your specific timeline shown in chart below</p>
        </div>
    `;
    
    // Show results
    resultsDiv.style.display = 'block';
    
    // Create chart
    createETGChart(results.timelineData, threshold);
}

function createETGChart(timelineData, threshold) {
    const ctx = document.getElementById('etgChart');
    
    // Destroy existing chart
    if (etgChart) {
        etgChart.destroy();
    }
    
    // Prepare data
    const labels = timelineData.map(d => d.hour);
    const data = timelineData.map(d => d.etgLevel);
    const currentTimeIndex = timelineData.findIndex(d => d.isCurrentTime);
    
    // Create background color array (different color after current time)
    const backgroundColors = timelineData.map((d, index) => {
        if (d.isCurrentTime) return 'rgba(239, 68, 68, 0.5)'; // Red for current time
        if (index < currentTimeIndex) return 'rgba(156, 163, 175, 0.5)'; // Gray for past
        return 'rgba(37, 99, 235, 0.5)'; // Blue for future
    });
    
    const borderColors = timelineData.map((d, index) => {
        if (d.isCurrentTime) return 'rgba(239, 68, 68, 1)';
        if (index < currentTimeIndex) return 'rgba(156, 163, 175, 1)';
        return 'rgba(37, 99, 235, 1)';
    });
    
    etgChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'ETG Level (ng/mL)',
                    data: data,
                    borderColor: 'rgba(37, 99, 235, 1)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: backgroundColors,
                    pointBorderColor: borderColors,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `Test Threshold (${threshold} ng/mL)`,
                    data: Array(timelineData.length).fill(threshold),
                    borderColor: 'rgba(239, 68, 68, 0.8)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'ETG Elimination Timeline',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(0) + ' ng/mL';
                            }
                            return label;
                        },
                        title: function(tooltipItems) {
                            const hours = tooltipItems[0].label;
                            const days = Math.floor(hours / 24);
                            const remainingHours = hours % 24;
                            if (days > 0) {
                                return `${days}d ${remainingHours}h after last drink`;
                            }
                            return `${hours} hours after last drink`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'ETG Concentration (ng/mL)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' ng/mL';
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hours After Last Drink'
                    },
                    ticks: {
                        callback: function(value, index) {
                            const hours = this.getLabelForValue(value);
                            const days = Math.floor(hours / 24);
                            if (hours % 24 === 0 && days > 0) {
                                return `${days}d`;
                            }
                            return hours + 'h';
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});


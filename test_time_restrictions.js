// Test script to validate time restriction logic
// This simulates the timeRestrictions.ts functionality

// School configuration
const SCHOOL_START_HOUR = 8;  // 8 AM
const SCHOOL_END_HOUR = 17;   // 5 PM

const CLASS_PERIODS = [
  { id: 1, name: "Period 1", start: "08:00", end: "09:30" },
  { id: 2, name: "Period 2", start: "09:45", end: "11:15" },
  { id: 3, name: "Period 3", start: "11:30", end: "13:00" },
  { id: 4, name: "Period 4", start: "14:00", end: "15:30" },
  { id: 5, name: "Period 5", start: "15:45", end: "17:00" }
];

// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Check if current time is within school hours
function isWithinSchoolHours(now = new Date()) {
  const currentHour = now.getHours();
  return currentHour >= SCHOOL_START_HOUR && currentHour < SCHOOL_END_HOUR;
}

// Get currently active period
function getCurrentActivePeriod(now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  return CLASS_PERIODS.find(period => {
    const startMinutes = timeToMinutes(period.start);
    const endMinutes = timeToMinutes(period.end);
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  });
}

// Check if face verification is allowed
function isFaceVerificationAllowed(now = new Date()) {
  // Check school hours first
  if (!isWithinSchoolHours(now)) {
    return {
      allowed: false,
      reason: "Face verification is only allowed during school hours (8:00 AM - 5:00 PM)"
    };
  }

  // Check if there's an active period
  const activePeriod = getCurrentActivePeriod(now);
  if (!activePeriod) {
    return {
      allowed: false,
      reason: "Face verification is only allowed during class periods"
    };
  }

  // Check if already verified for this period (simulated - would check localStorage in real app)
  const periodKey = `verification_${new Date().toDateString()}_period_${activePeriod.id}`;
  console.log(`Checking verification for: ${periodKey}`);
  
  return {
    allowed: true,
    reason: "Face verification is allowed",
    period: activePeriod
  };
}

// Test function
function runTests() {
  console.log("=== Time Restriction System Test ===\n");
  
  // Test current time
  const now = new Date();
  console.log(`Current time: ${now.toLocaleTimeString()}`);
  console.log(`Current date: ${now.toDateString()}\n`);
  
  // Test school hours
  console.log("1. School Hours Check:");
  console.log(`   Within school hours: ${isWithinSchoolHours(now)}`);
  
  // Test active period
  console.log("\n2. Active Period Check:");
  const activePeriod = getCurrentActivePeriod(now);
  if (activePeriod) {
    console.log(`   Active period: ${activePeriod.name} (${activePeriod.start} - ${activePeriod.end})`);
  } else {
    console.log("   No active period");
  }
  
  // Test verification allowance
  console.log("\n3. Face Verification Check:");
  const verificationResult = isFaceVerificationAllowed(now);
  console.log(`   Allowed: ${verificationResult.allowed}`);
  console.log(`   Reason: ${verificationResult.reason}`);
  if (verificationResult.period) {
    console.log(`   Period: ${verificationResult.period.name}`);
  }
  
  // Test specific times
  console.log("\n4. Testing Specific Times:");
  
  const testTimes = [
    { hour: 7, minute: 30, label: "Before school (7:30 AM)" },
    { hour: 8, minute: 15, label: "During Period 1 (8:15 AM)" },
    { hour: 9, minute: 35, label: "Between periods (9:35 AM)" },
    { hour: 12, minute: 30, label: "During Period 3 (12:30 PM)" },
    { hour: 17, minute: 30, label: "After school (5:30 PM)" }
  ];
  
  testTimes.forEach(testTime => {
    const testDate = new Date();
    testDate.setHours(testTime.hour, testTime.minute, 0, 0);
    
    const result = isFaceVerificationAllowed(testDate);
    console.log(`   ${testTime.label}: ${result.allowed ? '✅ Allowed' : '❌ Blocked'}`);
    if (!result.allowed) {
      console.log(`     → ${result.reason}`);
    }
  });
  
  console.log("\n=== Test Complete ===");
}

// Run the tests
runTests();

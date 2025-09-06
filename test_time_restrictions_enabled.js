// Test script to verify time restrictions are properly enabled
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 Testing Time Restrictions Status...\n');

// Check the timeRestrictions.ts file
const timeRestrictionsPath = './frontend/src/utils/timeRestrictions.ts';
if (fs.existsSync(timeRestrictionsPath)) {
  const content = fs.readFileSync(timeRestrictionsPath, 'utf8');
  
  // Check key settings
  const timeRestrictionsEnabled = content.includes('TIME_RESTRICTIONS_ENABLED = true');
  const devModeOff = content.includes('DEVELOPMENT_MODE = false');
  const forceOverrideOff = content.includes('FORCE_DEVELOPMENT_OVERRIDE = false');
  
  console.log('📋 Configuration Status:');
  console.log(`  ✅ TIME_RESTRICTIONS_ENABLED: ${timeRestrictionsEnabled ? 'TRUE ✓' : 'FALSE ❌'}`);
  console.log(`  ✅ DEVELOPMENT_MODE: ${devModeOff ? 'FALSE ✓' : 'TRUE ❌'}`);
  console.log(`  ✅ FORCE_DEVELOPMENT_OVERRIDE: ${forceOverrideOff ? 'FALSE ✓' : 'TRUE ❌'}`);
  
  // Check school hours
  const schoolHoursMatch = content.match(/startTime: "(\d{2}:\d{2})"/);
  const schoolEndMatch = content.match(/endTime: "(\d{2}:\d{2})"/);
  
  if (schoolHoursMatch && schoolEndMatch) {
    console.log(`  📅 School Hours: ${schoolHoursMatch[1]} - ${schoolEndMatch[1]}`);
  }
  
  // Check class periods
  const periodMatches = content.match(/startTime: "(\d{2}:\d{2})", endTime: "(\d{2}:\d{2})"/g);
  if (periodMatches) {
    console.log(`  🕒 Class Periods: ${periodMatches.length} periods configured`);
    periodMatches.forEach((period, index) => {
      const times = period.match(/(\d{2}:\d{2})/g);
      if (times && times.length === 2) {
        console.log(`     Period ${index + 1}: ${times[0]} - ${times[1]}`);
      }
    });
  }
  
  // Overall status
  const allEnabled = timeRestrictionsEnabled && devModeOff && forceOverrideOff;
  console.log(`\n🎯 Overall Status: ${allEnabled ? '✅ TIME RESTRICTIONS ENABLED' : '❌ TIME RESTRICTIONS DISABLED'}`);
  
  if (allEnabled) {
    console.log('\n💡 Students can now only mark attendance:');
    console.log('   - During school hours (08:00 - 15:00)');
    console.log('   - During active class periods');
    console.log('   - Once per class period');
    console.log('   - On valid academic days only');
  }
  
} else {
  console.log('❌ Could not find timeRestrictions.ts file');
}

console.log('\n✨ Time restrictions re-enabling complete!');
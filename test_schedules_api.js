// Test what the class schedules API returns for subject IDs
import fetch from 'node-fetch';

const BASE_URL = "http://localhost:8080";

async function testClassSchedulesData() {
    console.log('🚀 Testing Class Schedules API');
    console.log('=' * 50);
    
    try {
        // Login first
        console.log('🔐 Logging in...');
        const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'nadin@gmail.com',
                password: 'nadin123'
            })
        });
        
        if (!loginResponse.ok) {
            console.error('❌ Login failed:', loginResponse.status);
            const text = await loginResponse.text();
            console.error('Response:', text);
            return;
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.access_token;
        console.log('✅ Login successful');
        
        // Test class schedules API
        console.log('\n🔍 Testing class schedules API...');
        
        const schedulesResponse = await fetch(`${BASE_URL}/api/class-schedules`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!schedulesResponse.ok) {
            console.error('❌ Class schedules API failed:', schedulesResponse.status);
            const text = await schedulesResponse.text();
            console.error('Response:', text);
            return;
        }
        
        const schedulesData = await schedulesResponse.json();
        console.log('✅ Class schedules data received:');
        console.log('Raw response:', JSON.stringify(schedulesData, null, 2));
        
        // Find Data Structures 1 and analyze
        schedulesData.forEach((schedule, index) => {
            if (schedule.subject_name && schedule.subject_name.includes('Data Structures')) {
                console.log(`\n📚 Data Structures Schedule Analysis:`);
                console.log(`  id: ${schedule.id} (${typeof schedule.id})`);
                console.log(`  subject_id: ${schedule.subject_id} (${typeof schedule.subject_id})`);
                console.log(`  subject_name: ${schedule.subject_name}`);
                console.log(`  subject_code: ${schedule.subject_code}`);
                console.log(`  start_time: ${schedule.start_time}`);
                console.log(`  end_time: ${schedule.end_time}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testClassSchedulesData();
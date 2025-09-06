// Test what the frontend API client receives vs what backend sends
import fetch from 'node-fetch';

const BASE_URL = "http://localhost:8080";

async function testFrontendApiData() {
    console.log('🚀 Testing Frontend API Data Reception');
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
        
        // Test attendance API
        console.log('\n🔍 Testing attendance API...');
        const today = '2025-09-05';
        
        const attendanceResponse = await fetch(`${BASE_URL}/api/attendance?student_id=6&date=${today}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!attendanceResponse.ok) {
            console.error('❌ Attendance API failed:', attendanceResponse.status);
            const text = await attendanceResponse.text();
            console.error('Response:', text);
            return;
        }
        
        const attendanceData = await attendanceResponse.json();
        console.log('✅ Attendance data received:');
        console.log('Raw response:', JSON.stringify(attendanceData, null, 2));
        
        // Analyze each record
        attendanceData.forEach((record, index) => {
            console.log(`\n📊 Record ${index + 1} Analysis:`);
            console.log(`  subjectId: "${record.subjectId}" (${typeof record.subjectId})`);
            console.log(`  subjectId length: ${record.subjectId ? record.subjectId.length : 0}`);
            console.log(`  subjectId === "393": ${record.subjectId === "393"}`);
            console.log(`  subjectId === 393: ${record.subjectId === 393}`);
            console.log(`  parseInt(subjectId): ${parseInt(record.subjectId)}`);
            console.log(`  status: ${record.status}`);
            console.log(`  subjectName: ${record.subjectName}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testFrontendApiData();
/* 
 * Run this JavaScript in your browser's Developer Console to fix authentication issues
 * 
 * Steps:
 * 1. Open your browser's Developer Console (F12)
 * 2. Navigate to the Console tab
 * 3. Paste and run this code
 * 4. Refresh the page
 */

console.log("🔧 Fixing authentication issues...");

// Clear expired token
localStorage.removeItem('authToken');
console.log("✅ Cleared expired token from localStorage");

// Clear any other auth-related storage
const keysToRemove = Object.keys(localStorage).filter(key => 
  key.includes('auth') || key.includes('token') || key.includes('user')
);

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
  console.log(`✅ Cleared ${key} from localStorage`);
});

console.log("🚀 Authentication state cleared! Please refresh the page and log in again.");
console.log("📧 Use: admin@attendance.com");
console.log("🔑 Password: admin123");
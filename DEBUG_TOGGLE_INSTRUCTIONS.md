# Quick Debug Instructions

## Current Issue: Toggle shows INACTIVE but you still can't access face verification

## Let's Debug Step by Step:

### 1. Click the "🔧 Enable" Button
- The toggle should change from "INACTIVE" to "ACTIVE"
- Page should refresh automatically
- You should see the development banner change

### 2. Check What Happens
After clicking Enable, you should see:
- ✅ **Toggle shows "ACTIVE"** instead of "INACTIVE"
- ✅ **Classes change from "Starts Soon" to "Pending"**
- ✅ **"Mark Attendance" buttons appear** on each class
- ✅ **Face verification status shows development override**

### 3. If Toggle Doesn't Work
Try these steps:

#### Option A: Manual localStorage Override
1. Open browser developer tools (F12)
2. Go to Console tab
3. Type: `localStorage.setItem('dev_override_all_restrictions', 'true')`
4. Press Enter
5. Refresh the page (F5)

#### Option B: Check Console for Errors
1. Open developer tools (F12)
2. Go to Console tab
3. Look for any red error messages
4. Share any errors you see

### 4. Expected Results After Enable
```
Dev Override: ACTIVE     [🔒 Disable]

🔧 Development Override Active    [Toggle Enabled]
All time restrictions are bypassed - face verification available for all classes

✅ Face Verification Available
🔧 DEVELOPMENT OVERRIDE: All restrictions bypassed (toggle active)

Programming Fundamentals    [Mark Attendance]  ← This button should appear
Mathematics for Computing  [Mark Attendance]  ← This button should appear
```

### 5. If Still Not Working
Let me know what you see and I'll create a more direct solution.

## Manual Enable Command
If the button doesn't work, paste this in browser console:
```javascript
localStorage.setItem('dev_override_all_restrictions', 'true');
window.location.reload();
```

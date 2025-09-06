# 🔧 Development Mode Guide

## Quick Toggle Instructions

### Enable Development Mode (Current: ✅ ENABLED)
1. Open `frontend/src/utils/timeRestrictions.ts`
2. Find line 5: `export const DEVELOPMENT_MODE = true;`
3. Keep it as `true` for testing

### Disable Development Mode (For Production)
1. Open `frontend/src/utils/timeRestrictions.ts`
2. Find line 5: `export const DEVELOPMENT_MODE = true;`
3. Change to: `export const DEVELOPMENT_MODE = false;`

## What Development Mode Does

### ✅ When ENABLED (Current State)
- **Bypasses ALL time restrictions**
- **Face verification always available**
- **Shows orange development banners**
- **Perfect for testing and development**

### ❌ When DISABLED (Production Mode)
- **Enforces school hours (8 AM - 5 PM)**
- **Restricts to class periods only**
- **Limits one verification per period**
- **Standard production behavior**

## Visual Indicators

### In Today's Class Schedule
```
🔧 Development Mode Active                    [Testing Enabled]
All time restrictions are bypassed for development and testing purposes
Set DEVELOPMENT_MODE = false in timeRestrictions.ts for production
```

### In Face Recognition
```
🔧 Development Mode
Time restrictions bypassed for testing - verification always available
```

## Testing Workflow

### Current Setup (ENABLED)
1. ✅ **Face verification buttons** - Always visible
2. ✅ **Capture functionality** - Always works
3. ✅ **No time restrictions** - Test anytime
4. ✅ **Full system testing** - Complete workflow

### Quick Development Actions
- **Test face verification** ✅ Available now
- **Mark attendance** ✅ Works anytime  
- **UI component testing** ✅ All features active
- **API integration testing** ✅ No restrictions

### Before Production Deployment
1. Set `DEVELOPMENT_MODE = false`
2. Test time restrictions work properly
3. Verify school hours enforcement
4. Confirm period-based limitations

## File Location
```
📁 frontend/src/utils/timeRestrictions.ts
   Line 5: export const DEVELOPMENT_MODE = true;
```

---

**🎯 Perfect for Development!** You can now test all face verification features without any time restrictions. The system will show clear development mode indicators so you know it's in testing mode.

When you're ready for production, simply change the flag to `false` and all time restrictions will be enforced normally.

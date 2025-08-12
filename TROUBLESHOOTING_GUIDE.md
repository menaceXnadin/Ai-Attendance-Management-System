# 🔧 MediaPipe + InsightFace Troubleshooting Guide

## 🐛 Common Issues and Solutions

### Issue: "Get Started" Button Does Nothing

#### Possible Causes:
1. **Authentication Required**: FaceRegistration component requires user login
2. **MediaPipe Model Loading**: Model may not have loaded properly
3. **Browser Console Errors**: JavaScript errors preventing execution
4. **Camera Permissions**: Browser blocking camera access

#### Solutions:

#### 1. Check Browser Console
Open Developer Tools (F12) and look for errors:
```javascript
// Common MediaPipe errors:
// - Failed to load model from CDN
// - CORS issues with MediaPipe models
// - WebGL context issues
```

#### 2. Test Simple MediaPipe First
1. Go to `http://localhost:5173/face-integration-test`
2. Click "Run Simple MediaPipe Test" (blue button)
3. This bypasses authentication requirements

#### 3. Check Authentication
If using full Face Registration:
```javascript
// In browser console, check if user is logged in:
console.log('User logged in:', localStorage.getItem('token'));
```

#### 4. Camera Permission Issues
- Allow camera access when prompted
- Check browser settings for camera permissions
- Try different browser (Chrome/Firefox/Edge)

### Issue: MediaPipe Model Loading Fails

#### Symptoms:
- Console shows "Failed to load MediaPipe model"
- Button shows "Loading MediaPipe..." indefinitely

#### Solutions:

#### 1. Check Internet Connection
MediaPipe loads from CDN:
```
https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/
```

#### 2. CORS Issues
If behind corporate firewall, MediaPipe CDN may be blocked.

#### 3. Manual Model Loading Test
In browser console:
```javascript
// Test if MediaPipe can be loaded
import('@mediapipe/face_detection').then(module => {
  console.log('MediaPipe loaded:', module);
}).catch(err => {
  console.error('MediaPipe failed:', err);
});
```

### Issue: Camera Access Denied

#### Symptoms:
- "Camera permission denied" error
- No video feed appears

#### Solutions:

#### 1. Browser Permissions
- Click camera icon in address bar
- Select "Allow" for camera access
- Refresh page after allowing

#### 2. HTTPS Requirement
Modern browsers require HTTPS for camera access:
- Development server should be on `localhost` (allowed)
- Production needs HTTPS

#### 3. Camera In Use
- Close other applications using camera (Zoom, Teams, etc.)
- Restart browser if camera seems stuck

### Issue: Face Not Detected

#### Symptoms:
- Camera works but no face detection
- "Looking for face..." message persists

#### Solutions:

#### 1. Lighting Conditions
- Ensure good lighting on face
- Avoid backlighting (light behind you)
- Face should be well-lit and clearly visible

#### 2. Face Position
- Center face in camera frame
- Move closer if face appears too small
- Ensure only one person is visible

#### 3. MediaPipe Configuration
Check detection settings:
```javascript
// In FaceRegistration/SimpleFaceTest
faceDetection.setOptions({
  model: 'short',  // Try 'full' for better accuracy
  minDetectionConfidence: 0.5  // Lower for easier detection
});
```

### Issue: Backend InsightFace Errors

#### Symptoms:
- Face detected but registration/recognition fails
- Backend status shows error

#### Solutions:

#### 1. Check Backend Logs
Look at FastAPI server console for errors:
```
uvicorn app.main:app --reload
```

#### 2. InsightFace Dependencies
Ensure all packages installed:
```bash
pip install insightface onnxruntime opencv-python
```

#### 3. Model Download Issues
InsightFace downloads models on first use:
- Check internet connection
- Allow time for model download
- Check disk space

### Development Mode Testing

The backend includes development mode for testing without real models:

```python
# In insightface_service.py
DEVELOPMENT_MODE = True  # Set to True for testing
```

When enabled:
- Creates mock face detection
- Bypasses model loading issues
- Good for testing integration flow

## 🧪 Debug Steps

### Step 1: Basic MediaPipe Test
1. Go to test page: `http://localhost:5173/face-integration-test`
2. Click "Run Simple MediaPipe Test"
3. Check if camera starts and face detection works

### Step 2: Backend Status Check
1. Click "Test InsightFace Status"
2. Should show "Active" with model information
3. If error, check backend logs

### Step 3: Authentication Check
For full registration test:
1. Login to system first
2. Then try face registration
3. Check browser console for auth errors

### Step 4: Network Check
1. Open browser Network tab
2. Look for failed requests to:
   - MediaPipe CDN
   - Local backend API
   - WebSocket connections

## 📱 Browser Compatibility

### Recommended Browsers:
- ✅ Chrome 80+ (best WebGL support)
- ✅ Firefox 75+
- ✅ Edge 80+
- ⚠️ Safari (limited MediaPipe support)

### Mobile Testing:
- Android Chrome: Good support
- iOS Safari: Limited support
- Use responsive design for mobile

## 🔍 Advanced Debugging

### MediaPipe Debug Mode
```javascript
// Enable detailed logging
window.console.log = (...args) => {
  console.info('[DEBUG]', ...args);
};
```

### Backend Debug Mode
```python
# In main.py, add detailed logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Performance Monitoring
```javascript
// Monitor face detection performance
const startTime = performance.now();
await faceDetection.send({ image: video });
const endTime = performance.now();
console.log(`Detection took ${endTime - startTime}ms`);
```

## 🎯 Quick Fixes

### If Nothing Works:
1. **Refresh Page**: Clear any stuck states
2. **Hard Refresh**: Ctrl+F5 to clear cache
3. **Different Browser**: Test in incognito mode
4. **Restart Backend**: Kill and restart FastAPI server
5. **Check Logs**: Browser console + backend logs

### Emergency Fallback:
1. Disable MediaPipe temporarily
2. Use simple image upload instead
3. Test backend face processing directly
4. Gradual re-enable features

Remember: The integration has multiple layers (browser → MediaPipe → backend → InsightFace), so isolate each layer when debugging!

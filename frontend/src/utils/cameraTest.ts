// Camera test utility to debug camera access issues
export const testCameraAccess = async () => {
  console.log('🔍 Testing camera access...');
  
  try {
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser');
    }
    
    console.log('✅ getUserMedia is available');
    
    // Check camera permissions
    const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
    console.log('📹 Camera permission status:', permissions.state);
    
    // List available devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === 'videoinput');
    console.log('📷 Available cameras:', cameras.length);
    cameras.forEach((camera, index) => {
      console.log(`  Camera ${index + 1}: ${camera.label || 'Unknown Camera'}`);
    });
    
    // Test basic camera access
    console.log('🎬 Testing camera access...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });
    
    console.log('✅ Camera access successful!');
    console.log('📹 Stream details:', {
      active: stream.active,
      id: stream.id,
      tracks: stream.getTracks().length
    });
    
    // Clean up
    stream.getTracks().forEach(track => {
      track.stop();
      console.log(`🛑 Stopped ${track.kind} track`);
    });
    
    return {
      success: true,
      permissions: permissions.state,
      camerasCount: cameras.length,
      message: 'Camera access test successful!'
    };
    
  } catch (error) {
    console.error('❌ Camera test failed:', error);
    
    let errorMessage = 'Unknown camera error';
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please check if a camera is connected.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints cannot be satisfied.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      message: 'Camera access test failed!'
    };
  }
};

// Run camera test when this module is imported in development
if (import.meta.env.DEV) {
  console.log('🚀 Running camera test in development mode...');
  testCameraAccess().then(result => {
    console.log('📊 Camera test result:', result);
  });
}

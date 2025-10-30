/**
 * Camera Selector Utility
 * Helps select the appropriate camera device, prioritizing built-in webcams over virtual cameras
 */

export interface CameraDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
  isProbablyBuiltIn: boolean;
}

/**
 * Get all available video input devices
 */
export const getAvailableCameras = async (): Promise<CameraDevice[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    return videoDevices.map((device, index) => {
      const label = device.label || `Camera ${index + 1}`;
      
      // Detect virtual/software cameras by common names
      const virtualCameraKeywords = [
        'camo', 'snapcamera', 'obs', 'virtual', 'software', 'screen',
        'manycam', 'webcammax', 'splitcam', 'xsplit', 'streamlabs'
      ];
      
      const isVirtualCamera = virtualCameraKeywords.some(keyword => 
        label.toLowerCase().includes(keyword.toLowerCase())
      );
      
      // Detect built-in cameras by common names
      const builtInKeywords = [
        'integrated', 'built-in', 'facetime', 'internal', 'webcam',
        'usb', 'logitech', 'microsoft', 'hp truevision', 'lenovo'
      ];
      
      const isProbablyBuiltIn = builtInKeywords.some(keyword => 
        label.toLowerCase().includes(keyword.toLowerCase())
      ) || (!isVirtualCamera && device.deviceId !== 'default');

      return {
        deviceId: device.deviceId,
        label,
        isDefault: device.deviceId === 'default',
        isProbablyBuiltIn: !isVirtualCamera
      };
    });
  } catch (error) {
    console.error('Error enumerating camera devices:', error);
    return [];
  }
};

/**
 * Get the best camera to use, prioritizing built-in webcams
 */
export const getPreferredCamera = async (): Promise<string | null> => {
  const cameras = await getAvailableCameras();
  
  if (cameras.length === 0) {
    return null;
  }

  console.log('📷 Available cameras:', cameras);

  // Priority order:
  // 1. Built-in cameras that are not virtual
  // 2. Any non-virtual camera
  // 3. Default camera as fallback
  // 4. Any camera

  const builtInCamera = cameras.find(cam => cam.isProbablyBuiltIn && !cam.label.toLowerCase().includes('camo'));
  if (builtInCamera) {
    console.log('✅ Selected built-in camera:', builtInCamera.label);
    return builtInCamera.deviceId;
  }

  const nonVirtualCamera = cameras.find(cam => cam.isProbablyBuiltIn);
  if (nonVirtualCamera) {
    console.log('✅ Selected non-virtual camera:', nonVirtualCamera.label);
    return nonVirtualCamera.deviceId;
  }

  const defaultCamera = cameras.find(cam => cam.isDefault);
  if (defaultCamera && !defaultCamera.label.toLowerCase().includes('camo')) {
    console.log('✅ Selected default camera:', defaultCamera.label);
    return defaultCamera.deviceId;
  }

  // Last resort - use first available camera
  console.log('⚠️ Using first available camera:', cameras[0].label);
  return cameras[0].deviceId;
};

/**
 * Create video constraints with preferred camera
 */
export const createCameraConstraints = async (preferredDeviceId?: string) => {
  const deviceId = preferredDeviceId || await getPreferredCamera();
  
  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 480 },
      height: { ideal: 640 },
      facingMode: 'user'
    },
    audio: false
  };

  // Add device ID constraint if we have a preferred camera
  if (deviceId && deviceId !== 'default') {
    (constraints.video as MediaTrackConstraints).deviceId = { exact: deviceId };
  }

  return constraints;
};

/**
 * Test camera access with fallback options
 */
export const testCameraWithFallback = async (): Promise<MediaStream | null> => {
  try {
    // First try with preferred camera
    const preferredId = await getPreferredCamera();
    if (preferredId) {
      try {
        const constraints = await createCameraConstraints(preferredId);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Successfully opened preferred camera');
        return stream;
      } catch (error) {
        console.warn('⚠️ Preferred camera failed, trying fallback:', error);
      }
    }

    // Fallback to default constraints
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 480 },
        height: { ideal: 640 },
        facingMode: 'user'
      },
      audio: false
    });
    
    console.log('✅ Successfully opened fallback camera');
    return stream;
    
  } catch (error) {
    console.error('❌ All camera options failed:', error);
    return null;
  }
};
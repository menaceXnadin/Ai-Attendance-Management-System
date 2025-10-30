import { useState, useRef } from 'react';

export default function FaceRegistrationDebugPage() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 640, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Unable to access camera');
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);

    // Stop camera
    const stream = video.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCapturing(false);
  };

  const testFaceDetection = async () => {
    if (!capturedImage) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/face-recognition/detect-faces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ image_data: capturedImage }),
      });

      const data = await response.json();
      setResult({ type: 'detection', data });

      alert(`Face Detection Complete: ${data.faces_detected} faces detected`);
    } catch (error) {
      console.error('Detection error:', error);
      alert('Failed to detect faces');
    } finally {
      setIsProcessing(false);
    }
  };

  const testFaceRegistration = async () => {
    if (!capturedImage) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/face-recognition/register-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ image_data: capturedImage }),
      });

      const data = await response.json();
      setResult({ type: 'registration', data });

      alert(`Registration ${data.success ? 'Success' : 'Failed'}: ${data.message}`);
    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to register face');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '16px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📷 Face Registration Debug Tool
        </h1>

        {/* Camera Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            1. Capture Image
          </h3>

          {!isCapturing && !capturedImage && (
            <button
              onClick={startCamera}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📷 Start Camera
            </button>
          )}

          {isCapturing && (
            <div style={{ marginBottom: '16px' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  marginBottom: '16px'
                }}
              />
              <br />
              <button
                onClick={captureImage}
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                📸 Capture Photo
              </button>
            </div>
          )}

          {capturedImage && (
            <div style={{ marginBottom: '16px' }}>
              <img
                src={capturedImage}
                alt="Captured"
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  marginBottom: '16px'
                }}
              />
              <br />
              <button
                onClick={() => { setCapturedImage(''); setResult(null); }}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🔄 Retake Photo
              </button>
            </div>
          )}
        </div>

        {/* Testing Section */}
        {capturedImage && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              2. Test Face Recognition
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={testFaceDetection}
                disabled={isProcessing}
                style={{
                  backgroundColor: isProcessing ? '#9ca3af' : '#f59e0b',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                🔍 Test Face Detection
              </button>
              <button
                onClick={testFaceRegistration}
                disabled={isProcessing}
                style={{
                  backgroundColor: isProcessing ? '#9ca3af' : '#ef4444',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                ✅ Test Face Registration
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              3. Results
            </h3>
            <div style={{
              backgroundColor: '#f3f4f6',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              overflow: 'auto'
            }}>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
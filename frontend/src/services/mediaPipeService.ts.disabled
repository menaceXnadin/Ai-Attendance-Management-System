// MediaPipe Face Detection Service with Caching
// This will prevent re-downloading models on every page refresh

// Type definitions for MediaPipe
interface MediaPipeInputs {
  image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageData;
}

interface MediaPipeFaceDetection {
  setOptions(options: {
    model: string;
    minDetectionConfidence: number;
  }): void;
  onResults(callback: (results: unknown) => void): void;
  send(inputs: MediaPipeInputs): Promise<void>;
  close(): void;
}

class MediaPipeFaceDetectionService {
  private static instance: MediaPipeFaceDetectionService;
  private faceDetection: MediaPipeFaceDetection | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): MediaPipeFaceDetectionService {
    if (!MediaPipeFaceDetectionService.instance) {
      MediaPipeFaceDetectionService.instance = new MediaPipeFaceDetectionService();
    }
    return MediaPipeFaceDetectionService.instance;
  }

  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized && this.faceDetection) {
      console.log('✅ MediaPipe already initialized, using cached instance');
      return;
    }

    // If currently initializing, wait for that to complete
    if (this.isInitializing && this.initPromise) {
      console.log('⏳ MediaPipe initialization in progress, waiting...');
      return this.initPromise;
    }

    // Start initialization
    this.isInitializing = true;
    console.log('🚀 Initializing MediaPipe Face Detection...');

    this.initPromise = this.doInitialize();
    await this.initPromise;
    
    this.isInitializing = false;
    this.isInitialized = true;
    console.log('✅ MediaPipe Face Detection initialized and cached!');
  }

  private async doInitialize(): Promise<void> {
    try {
      const { FaceDetection } = await import('@mediapipe/face_detection');
      
      this.faceDetection = new FaceDetection({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
      });

      await new Promise<void>((resolve, reject) => {
        this.faceDetection.setOptions({
          model: 'short',  // Faster model for real-time detection
          minDetectionConfidence: 0.5,
        });

        // Test initialization
        this.faceDetection.onResults(() => {
          resolve();
        });

        // Initialize with empty image to trigger model load
        this.faceDetection.send({ image: new ImageData(1, 1) });
        
        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('MediaPipe initialization timeout')), 10000);
      });

    } catch (error) {
      console.error('❌ Failed to initialize MediaPipe:', error);
      this.isInitialized = false;
      this.isInitializing = false;
      throw error;
    }
  }

  getFaceDetection(): MediaPipeFaceDetection {
    if (!this.isInitialized || !this.faceDetection) {
      throw new Error('MediaPipe not initialized. Call initialize() first.');
    }
    return this.faceDetection;
  }

  isReady(): boolean {
    return this.isInitialized && this.faceDetection !== null;
  }
}

// Export singleton instance
export const mediaPipeService = MediaPipeFaceDetectionService.getInstance();

import { GestureController } from './GestureController.js';
import { INTENTS, CONTROLLER_STATES, GESTURE_ERRORS } from './types.js';

/**
 * Webcam Gesture Controller (Worker-Optimized)
 * Mediates between MediaPipe (Detector) and GestureWorker (Processor)
 */
export class WebcamGestureController extends GestureController {
  constructor(config, intentBus) {
    super(config, intentBus);
    this.source = 'webcam';
    this.stream = null;
    this.video = null;
    this.hands = null;
    this.camera = null;
    this.worker = null;
    this.zoomLevel = 1.0;
    this.lastPalm = null;
    this.smoothedPosition = { x: 0.5, y: 0.5 };
    
    this.initWorker();
  }

  /**
   * Initialize processing worker
   */
  initWorker() {
    this.worker = new Worker(new URL('./GestureWorker.js', import.meta.url));
    this.worker.onmessage = (e) => this.handleWorkerResults(e.data);
    this.worker.postMessage({ type: 'INIT', payload: { config: this.config } });
  }

  /**
   * Initialize hardware and MediaPipe
   */
  async initialize() {
    this.setState(CONTROLLER_STATES.INITIALIZING);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.config.webcam.width },
          height: { ideal: this.config.webcam.height },
          facingMode: this.config.webcam.facingMode,
        },
      });
      
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true');
      this.video.style.display = 'none';
      document.body.appendChild(this.video);
      await this.video.play();
      
      await this.initMediaPipe();
      this.isInitialized = true;
      this.setState(CONTROLLER_STATES.IDLE);
      return { success: true };
    } catch (error) {
      console.error('[Gesture] Initialization failed:', error);
      this.setState(CONTROLLER_STATES.ERROR, GESTURE_ERRORS.INITIALIZATION_FAILED);
      return { success: false, error: GESTURE_ERRORS.INITIALIZATION_FAILED };
    }
  }

  /**
   * Initialize MediaPipe Hands
   */
  async initMediaPipe() {
    const handsModule = await import('@mediapipe/hands');
    const cameraModule = await import('@mediapipe/camera_utils');
    const Hands = handsModule.Hands || handsModule.default?.Hands || window.Hands;
    const Camera = cameraModule.Camera || cameraModule.default?.Camera || window.Camera;

    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });

    this.hands.setOptions({
      maxNumHands: this.config.mediapipe.maxNumHands,
      modelComplexity: 1,
      minDetectionConfidence: this.config.mediapipe.minDetectionConfidence,
      minTrackingConfidence: this.config.mediapipe.minTrackingConfidence,
    });

    this.hands.onResults((results) => {
      // 1. Store landmarks for UI status tracking
      this.lastLandmarks = (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) 
        ? results.multiHandLandmarks 
        : null;

      // 2. Send to worker for intensive processing
      if (this.worker && results.multiHandLandmarks) {
        this.worker.postMessage({ 
          type: 'PROCESS', 
          payload: { 
            multiHandLandmarks: results.multiHandLandmarks,
            multiHandedness: results.multiHandedness
          } 
        });
      }
      // 3. HUD Preview callback
      if (this.onResultsCallback) {
        this.onResultsCallback(results);
      }
    });

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        if (this.isActive && this.hands) {
          await this.hands.send({ image: this.video });
        }
      },
      width: this.config.webcam.width,
      height: this.config.webcam.height,
    });
  }

  /**
   * Handle synthesized intents back from worker
   */
  handleWorkerResults(data) {
    if (data.type !== 'RESULTS') {
      if (data.type === 'ERROR') console.error('[Controller] Worker Error:', data.payload);
      return;
    }
    const { activeStates, pos, zoomScale } = data;

    if (pos) {
      // Clamp position to [0, 1] to prevent "hiding behind screen"
      this.smoothedPosition = {
        x: Math.max(0, Math.min(1, pos.x)),
        y: Math.max(0, Math.min(1, pos.y))
      };
      this.emitIntent(INTENTS.HOVER_FOCUS, this.smoothedPosition);
    }

    activeStates.forEach(state => {
      const stab = this.config.stabilization;
      switch (state) {
        case 'NAV_PAN':
            if (this.lastPalm) {
                const dx = this.smoothedPosition.x - this.lastPalm.x;
                const dy = this.smoothedPosition.y - this.lastPalm.y;
                
                // Deadzone check
                if (Math.abs(dx) > stab.panDeadzone || Math.abs(dy) > stab.panDeadzone) {
                    const finalDx = dx * (1/this.zoomLevel) * 2;
                    const finalDy = dy * (1/this.zoomLevel) * 2;
                    this.emitIntent(INTENTS.PAN, { deltaX: finalDx, deltaY: finalDy });
                }
            }
            break;
        case 'PRECISION_ROTATE':
            if (this.lastPalm) {
                const dx = this.smoothedPosition.x - this.lastPalm.x;
                
                // Deadzone check
                if (Math.abs(dx) > stab.rotateDeadzone) {
                    this.emitIntent(INTENTS.ROTATE, { deltaX: dx });
                }
            }
            break;
        case 'LOCK_MODE':
            this.emitIntent(INTENTS.LOCK);
            break;
      }
    });

    if (zoomScale && zoomScale !== 1) {
        const scaleDelta = Math.abs(zoomScale - 1);
        if (scaleDelta > this.config.stabilization.zoomDeadzone) {
            this.emitIntent(INTENTS.ZOOM, { scale: zoomScale });
        }
    }

    this.lastPalm = { ...this.smoothedPosition };
  }

  setZoomLevel(level) {
    this.zoomLevel = level;
  }

  setOnResultsCallback(callback) {
    this.onResultsCallback = callback;
  }

  start() {
    this.isActive = true;
    this.setState(CONTROLLER_STATES.ACTIVE);
    if (this.camera) this.camera.start();
  }

  stop() {
    this.isActive = false;
    this.setState(CONTROLLER_STATES.IDLE);
    if (this.camera) this.camera.stop();
  }

  destroy() {
    this.stop();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.hands) this.hands.close();
    if (this.worker) this.worker.terminate();
    if (this.video) this.video.remove();
    this.isInitialized = false;
  }
}

export default WebcamGestureController;

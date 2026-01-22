/**
 * Webcam Gesture Controller
 * Implements hand gesture detection using MediaPipe Hands
 */

import { GestureController } from './GestureController.js';
import { INTENTS, CONTROLLER_STATES, GESTURE_ERRORS } from './types.js';

/**
 * Hand landmark indices for gesture detection
 * @see https://google.github.io/mediapipe/solutions/hands.html
 */
const LANDMARKS = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
};

/**
 * Calculate distance between two landmarks
 * @param {Object} a - First landmark {x, y, z}
 * @param {Object} b - Second landmark {x, y, z}
 * @returns {number}
 */
function distance(a, b) {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) + 
    Math.pow(a.y - b.y, 2) + 
    Math.pow(a.z - b.z, 2)
  );
}

/**
 * Calculate centroid of multiple landmarks
 * @param {Object[]} landmarks
 * @returns {{x: number, y: number, z: number}}
 */
function centroid(landmarks) {
  const sum = landmarks.reduce(
    (acc, l) => ({ x: acc.x + l.x, y: acc.y + l.y, z: acc.z + l.z }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / landmarks.length,
    y: sum.y / landmarks.length,
    z: sum.z / landmarks.length,
  };
}

export class WebcamGestureController extends GestureController {
  constructor(config, intentBus) {
    super(config, intentBus);
    this.source = 'webcam';
    
    /** @type {MediaStream|null} */
    this.stream = null;
    
    /** @type {HTMLVideoElement|null} */
    this.video = null;
    
    /** @type {Object|null} MediaPipe Hands instance */
    this.hands = null;
    
    /** @type {number|null} */
    this.animationFrameId = null;
    
    /** @type {Object|null} */
    this.lastLandmarks = null;
    
    /** @type {number} */
    this.lastIntentTime = 0;
    
    /** @type {Array} */
    this.positionHistory = [];
    
    /** @type {Object} */
    this.smoothedPosition = { x: 0.5, y: 0.5 };
  }
  
  /**
   * Initialize webcam and MediaPipe
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async initialize() {
    this.setState(CONTROLLER_STATES.INITIALIZING);
    
    try {
      // Request webcam access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.config.webcam.width },
          height: { ideal: this.config.webcam.height },
          facingMode: this.config.webcam.facingMode,
        },
      });
      
      // Create hidden video element
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true');
      this.video.style.display = 'none';
      document.body.appendChild(this.video);
      await this.video.play();
      
      // Initialize MediaPipe Hands (lazy load)
      await this.initMediaPipe();
      
      this.isInitialized = true;
      this.setState(CONTROLLER_STATES.IDLE);
      
      return { success: true };
    } catch (error) {
      const errorType = error.name === 'NotAllowedError' 
        ? GESTURE_ERRORS.PERMISSION_DENIED 
        : GESTURE_ERRORS.INITIALIZATION_FAILED;
      
      this.setState(
        error.name === 'NotAllowedError' 
          ? CONTROLLER_STATES.PERMISSION_DENIED 
          : CONTROLLER_STATES.ERROR,
        errorType
      );
      
      return { success: false, error: errorType };
    }
  }
  
  /**
   * Initialize MediaPipe Hands
   * @private
   */
  async initMediaPipe() {
    // Dynamically import MediaPipe if available
    // Falls back to mock implementation for testing/development
    try {
      const { Hands } = await import('@mediapipe/hands');
      const { Camera } = await import('@mediapipe/camera_utils');
      
      this.hands = new Hands({
        locateFile: (file) => 
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      
      this.hands.setOptions({
        maxNumHands: this.config.mediapipe.maxNumHands,
        modelComplexity: 1,
        minDetectionConfidence: this.config.mediapipe.minDetectionConfidence,
        minTrackingConfidence: this.config.mediapipe.minTrackingConfidence,
      });
      
      this.hands.onResults((results) => this.onHandResults(results));
      
      // Use MediaPipe Camera utility for efficient frame capture
      this.camera = new Camera(this.video, {
        onFrame: async () => {
          if (this.isActive && this.hands) {
            await this.hands.send({ image: this.video });
          }
        },
        width: this.config.webcam.width,
        height: this.config.webcam.height,
      });
    } catch {
      console.warn('MediaPipe not available, using fallback hand detection');
      // In production, you might want to show a message to install dependencies
      // For now, we'll use a mock that doesn't detect hands
      this.hands = {
        setOptions: () => {},
        onResults: () => {},
        send: () => Promise.resolve(),
      };
    }
  }
  
  /**
   * Process hand detection results
   * @private
   * @param {Object} results - MediaPipe results
   */
  onHandResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.handleNoHands();
      return;
    }
    
    const landmarks = results.multiHandLandmarks[0];
    this.processLandmarks(landmarks);
  }
  
  /**
   * Handle case when no hands detected
   * @private
   */
  handleNoHands() {
    const now = Date.now();
    if (now - this.lastIntentTime > this.config.thresholds.idleTimeout) {
      this.emitIntent(INTENTS.IDLE);
      this.lastIntentTime = now;
    }
    this.lastLandmarks = null;
  }
  
  /**
   * Process hand landmarks and detect gestures
   * @private
   * @param {Object[]} landmarks
   */
  processLandmarks(landmarks) {
    // Apply smoothing
    const palm = centroid([
      landmarks[LANDMARKS.WRIST],
      landmarks[LANDMARKS.INDEX_MCP],
      landmarks[LANDMARKS.MIDDLE_MCP],
    ]);
    
    if (this.config.smoothing.enabled) {
      const factor = this.config.smoothing.factor;
      this.smoothedPosition.x = this.smoothedPosition.x * (1 - factor) + palm.x * factor;
      this.smoothedPosition.y = this.smoothedPosition.y * (1 - factor) + palm.y * factor;
    } else {
      this.smoothedPosition = { x: palm.x, y: palm.y };
    }
    
    // Store position history for velocity calculation
    this.positionHistory.push({
      x: this.smoothedPosition.x,
      y: this.smoothedPosition.y,
      time: Date.now(),
    });
    
    if (this.positionHistory.length > this.config.smoothing.historySize) {
      this.positionHistory.shift();
    }
    
    // Detect gestures
    const gesture = this.detectGesture(landmarks);
    
    if (gesture) {
      this.emitIntent(gesture.intent, gesture.payload);
      this.lastIntentTime = Date.now();
    }
    
    this.lastLandmarks = landmarks;
  }
  
  /**
   * Detect current gesture from landmarks
   * @private
   * @param {Object[]} landmarks
   * @returns {{intent: string, payload: Object}|null}
   */
  detectGesture(landmarks) {
    const thumbTip = landmarks[LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[LANDMARKS.INDEX_TIP];
    // middleTip reserved for future gesture detection
    
    // Pinch detection (thumb + index close together) -> ZOOM
    const pinchDist = distance(thumbTip, indexTip);
    if (pinchDist < this.config.thresholds.pinchDistance) {
      // Calculate zoom scale from pinch distance change
      const scale = this.lastLandmarks 
        ? distance(
            this.lastLandmarks[LANDMARKS.THUMB_TIP],
            this.lastLandmarks[LANDMARKS.INDEX_TIP]
          ) / pinchDist
        : 1;
      
      return {
        intent: INTENTS.ZOOM,
        payload: {
          scale: 1 + (scale - 1) * this.config.thresholds.zoomSensitivity,
          deltaX: 0,
          deltaY: 0,
        },
      };
    }
    
    // Calculate velocity for PAN/ROTATE detection
    if (this.positionHistory.length >= 2) {
      const oldest = this.positionHistory[0];
      const newest = this.positionHistory[this.positionHistory.length - 1];
      const dt = (newest.time - oldest.time) / 1000;
      
      if (dt > 0) {
        const vx = (newest.x - oldest.x) / dt;
        const vy = (newest.y - oldest.y) / dt;
        const velocity = Math.sqrt(vx * vx + vy * vy);
        
        if (velocity > this.config.thresholds.panVelocity) {
          // Determine if it's a rotation (horizontal) or pan (vertical emphasis)
          const isRotation = Math.abs(vx) > Math.abs(vy) * 1.5;
          
          if (isRotation) {
            return {
              intent: INTENTS.ROTATE,
              payload: {
                deltaX: (newest.x - oldest.x) * 2 - 1, // Normalize to -1 to 1
                deltaY: 0,
                rotation: (newest.x - oldest.x) * this.config.thresholds.rotationAngle,
              },
            };
          } else {
            return {
              intent: INTENTS.PAN,
              payload: {
                deltaX: (newest.x - oldest.x) * 2 - 1,
                deltaY: (newest.y - oldest.y) * 2 - 1,
              },
            };
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Start gesture detection
   */
  start() {
    if (!this.isInitialized) {
      console.warn('WebcamGestureController: Cannot start before initialization');
      return;
    }
    
    this.isActive = true;
    this.setState(CONTROLLER_STATES.ACTIVE);
    
    if (this.camera?.start) {
      this.camera.start();
    }
  }
  
  /**
   * Stop gesture detection
   */
  stop() {
    this.isActive = false;
    this.setState(CONTROLLER_STATES.IDLE);
    
    if (this.camera?.stop) {
      this.camera.stop();
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.video) {
      this.video.remove();
      this.video = null;
    }
    
    if (this.hands?.close) {
      this.hands.close();
    }
    
    this.hands = null;
    this.camera = null;
    this.isInitialized = false;
  }
}

export default WebcamGestureController;

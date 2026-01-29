/**
 * Gesture Interaction Configuration
 * All thresholds and settings for gesture-based 3D interaction
 */

/**
 * @typedef {Object} GestureThresholds
 * @property {number} pinchDistance - Normalized distance for pinch detection (0-1)
 * @property {number} rotationAngle - Degrees for rotation intent trigger
 * @property {number} panVelocity - Normalized velocity for pan detection
 * @property {number} idleTimeout - Milliseconds before emitting IDLE intent
 * @property {number} zoomSensitivity - Multiplier for zoom scaling
 */

/**
 * @typedef {Object} SmoothingConfig
 * @property {boolean} enabled - Enable exponential smoothing
 * @property {number} factor - Smoothing factor (0-1, lower = smoother)
 * @property {number} historySize - Frames for velocity calculation
 */

/**
 * @typedef {Object} WebcamConfig
 * @property {number} width - Video width
 * @property {number} height - Video height
 * @property {string} facingMode - Camera facing mode
 */

/**
 * @typedef {Object} MediaPipeConfig
 * @property {number} maxNumHands - Maximum hands to detect
 * @property {number} minDetectionConfidence - Detection threshold (0-1)
 * @property {number} minTrackingConfidence - Tracking threshold (0-1)
 */

// Parse sensitivity from environment (0.0 - 1.0)
const parseSensitivity = () => {
  const value = parseFloat(import.meta.env.VITE_GESTURE_SENSITIVITY);
  if (isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
};

const sensitivity = parseSensitivity();

/**
 * Gesture configuration object
 * @type {Object}
 */
export const gestureConfig = {
  // Feature flag - disabled by default
  enabled: import.meta.env.VITE_ENABLE_GESTURE === 'true',
  
  // Controller type (swappable: webcam, mouse, vr)
  controller: import.meta.env.VITE_GESTURE_CONTROLLER || 'webcam',
  
  // Detection thresholds (adjusted by sensitivity)
  thresholds: {
    pinchDistance: 0.05 * (2 - sensitivity),
    rotationAngle: 15 * (2 - sensitivity),
    panVelocity: 0.02 * (2 - sensitivity),
    idleTimeout: 500,
    zoomSensitivity: 0.5 + sensitivity,
  },
  
  // Smoothing settings
  smoothing: {
    enabled: true,
    factor: 0.3,           // Alpha for position
    beta: 0.1,             // Beta for trend/velocity (Double Exponential)
    historySize: 10,
  },
  
  // Advanced Multi-Hand Gesture Settings
  multiHand: {
    zoomSensitivity: 1.5 * (0.5 + sensitivity),
    rotationSensitivity: 1.2 * (0.5 + sensitivity),
    minPalmDistance: 0.1, // Minimum distance between palms for 2-hand gestures
  },

  // Phase 16: Stability & Performance Tuning
  stabilization: {
    panDeadzone: 0.005,      // Minimum delta to trigger PAN
    rotateDeadzone: 0.003,   // Minimum delta to trigger ROTATE
    zoomDeadzone: 0.002,     // Minimum scale change to trigger ZOOM
    zoomAlpha: 0.2,          // Smoothing for zoomScale (Worker side)
    adaptiveSmoothing: true, // Use velocity to adjust alpha
  },
  
  // Webcam settings
  webcam: {
    width: 640,
    height: 480,
    facingMode: 'user',
  },
  
  // MediaPipe Hands settings
  mediapipe: {
    maxNumHands: 2, 
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  },


  // Phase 9 & 10: Advanced Vocabulary & Invent Integration
  stateMachine: {
    holdDuration: 100, // Faster response
    gracePeriod: 250,  // How long to wait before dropping a lost state
    exitDuration: 300,
    cooldown: 500,
    confidenceThreshold: 0.7,
  },
  
  vocabulary: {
    PRECISION_ROTATE: { enabled: true, sensitivity: 1.0 },
    FINE_ZOOM: { enabled: true, sensitivity: 0.8 },
    LOCK_MODE: { enabled: true },
    SPATIAL_SCALE: { enabled: true },
    AXIAL_ROLL: { enabled: true },
    PIVOT_MOVE: { enabled: true },
    HOVER_FOCUS: { enabled: true, holdTime: 800 },
  },

  invent: {
    gestureInteraction: {
      enabled: true,
      groups: {
        navigation: true,    // Pan, Zoom, Rotate
        exploration: true,   // Focus, Expand, Cluster control
        modeControl: true,   // Pause, Lock, Idle
      },
      zoomAware: true,       // Scale thresholds based on canvas zoom
      baseSensitivity: 0.5,
    }
  },
  
  // Debug options
  debug: {
    showLandmarks: import.meta.env.VITE_DEBUG_MODE === 'true',
    logIntents: import.meta.env.VITE_DEBUG_MODE === 'true',
  },
};

/**
 * Validate gesture configuration
 * @returns {{valid: boolean, warnings: string[]}}
 */
export const validateGestureConfig = () => {
  const warnings = [];
  
  if (gestureConfig.enabled && gestureConfig.controller === 'webcam') {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      warnings.push('Webcam API not available in this browser');
    }
  }
  
  if (gestureConfig.thresholds.pinchDistance <= 0) {
    warnings.push('Pinch distance threshold must be positive');
  }
  
  if (gestureConfig.smoothing.factor < 0 || gestureConfig.smoothing.factor > 1) {
    warnings.push('Smoothing factor should be between 0 and 1');
  }
  
  return { valid: warnings.length === 0, warnings };
};

export default gestureConfig;

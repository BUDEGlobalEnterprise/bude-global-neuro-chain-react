/**
 * Gesture Type Definitions
 * JSDoc types for gesture interaction system
 */

/**
 * @typedef {'ROTATE' | 'ZOOM' | 'PAN' | 'IDLE' | 'SELECT' | 'ROTATE_AXIS' | 'ZOOM_FINE' | 'LOCK' | 'SCALE_WORLD' | 'ROLL_CAMERA' | 'MODE_ENTER' | 'PAUSE' | 'HOVER_FOCUS' | 'EXPAND_DETAILS' | 'CLUSTER_EXPAND' | 'CLUSTER_COLLAPSE' | 'INSPECT_PRECISE'} GestureIntent
 */

/**
 * @typedef {Object} IntentPayload
 * @property {number} deltaX - Normalized X delta (-1 to 1)
 * @property {number} deltaY - Normalized Y delta (-1 to 1)
 * @property {number} scale - Zoom scale factor (1.0 = no change)
 * @property {number} [rotation] - Rotation angle in degrees
 */

/**
 * @typedef {Object} IntentEvent
 * @property {GestureIntent} intent - The gesture intent type
 * @property {IntentPayload} payload - Intent data payload
 * @property {number} timestamp - Event timestamp
 * @property {string} [source] - Controller source identifier
 */

/**
 * @typedef {Object} HandLandmark
 * @property {number} x - Normalized X coordinate (0-1)
 * @property {number} y - Normalized Y coordinate (0-1)
 * @property {number} z - Normalized Z coordinate (depth)
 */

/**
 * @typedef {Object} NormalizedLandmarks
 * @property {HandLandmark[]} landmarks - Array of 21 hand landmarks
 * @property {number} confidence - Detection confidence (0-1)
 * @property {'left' | 'right'} handedness - Which hand
 */

/**
 * @typedef {Object} GestureControllerStatus
 * @property {boolean} isActive - Controller is running
 * @property {boolean} isInitialized - Controller has been initialized
 * @property {string} [error] - Error message if failed
 * @property {string} state - Current state: 'idle' | 'initializing' | 'active' | 'error' | 'permission_denied'
 */

/**
 * Intent type constants
 * @readonly
 * @enum {string}
 */
export const INTENTS = Object.freeze({
  ROTATE: 'ROTATE',
  ZOOM: 'ZOOM',
  PAN: 'PAN',
  IDLE: 'IDLE',
  SELECT: 'SELECT',
  ROTATE_AXIS: 'ROTATE_AXIS',
  ZOOM_FINE: 'ZOOM_FINE',
  LOCK: 'LOCK',
  SCALE_WORLD: 'SCALE_WORLD',
  ROLL_CAMERA: 'ROLL_CAMERA',
  MODE_ENTER: 'MODE_ENTER',
  PAUSE: 'PAUSE',
  HOVER_FOCUS: 'HOVER_FOCUS',
  EXPAND_DETAILS: 'EXPAND_DETAILS',
  CLUSTER_EXPAND: 'CLUSTER_EXPAND',
  CLUSTER_COLLAPSE: 'CLUSTER_COLLAPSE',
  INSPECT_PRECISE: 'INSPECT_PRECISE',
});

/**
 * Controller state constants
 * @readonly
 * @enum {string}
 */
export const CONTROLLER_STATES = Object.freeze({
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  ACTIVE: 'active',
  ERROR: 'error',
  PERMISSION_DENIED: 'permission_denied',
});

/**
 * Error type constants
 * @readonly
 * @enum {string}
 */
export const GESTURE_ERRORS = Object.freeze({
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  STREAM_ERROR: 'STREAM_ERROR',
});

/**
 * Create a default intent payload
 * @returns {IntentPayload}
 */
export function createDefaultPayload() {
  return {
    deltaX: 0,
    deltaY: 0,
    scale: 1.0,
    rotation: 0,
  };
}

/**
 * Create an intent event
 * @param {GestureIntent} intent
 * @param {Partial<IntentPayload>} [payload]
 * @param {string} [source]
 * @returns {IntentEvent}
 */
export function createIntentEvent(intent, payload = {}, source = 'unknown') {
  return {
    intent,
    payload: { ...createDefaultPayload(), ...payload },
    timestamp: Date.now(),
    source,
  };
}

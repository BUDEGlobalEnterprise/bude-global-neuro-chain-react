/**
 * Feature Registry
 * Centralized initialization for optional features
 */

import { gestureConfig, validateGestureConfig } from './gesture.js';
import { debug } from './env.js';

// Controller implementations will be lazy-loaded
const controllerModules = {
  webcam: () => import('../gesture/WebcamGestureController.js'),
  // Future: mouse, vr, leapmotion
};

/**
 * @typedef {Object} FeatureInitResult
 * @property {boolean} success
 * @property {string} [error]
 * @property {Object} [controller]
 */

/**
 * @typedef {Object} FeaturesResult
 * @property {FeatureInitResult|null} gesture
 */

// Store active controllers for cleanup
const activeControllers = new Map();

/**
 * Initialize all enabled features
 * @returns {Promise<FeaturesResult>}
 */
export async function initializeFeatures() {
  const results = {
    gesture: null,
  };
  
  // Initialize gesture feature if enabled
  if (gestureConfig.enabled) {
    results.gesture = await initializeGestureFeature();
  } else {
    debug.log('Gesture feature disabled');
  }
  
  return results;
}

/**
 * Initialize gesture feature
 * @returns {Promise<FeatureInitResult>}
 */
async function initializeGestureFeature() {
  debug.log('Initializing gesture feature...');
  
  // Validate config first
  const validation = validateGestureConfig();
  if (!validation.valid) {
    debug.warn('Gesture config validation warnings:', validation.warnings);
  }
  
  // Get controller loader
  const loader = controllerModules[gestureConfig.controller];
  if (!loader) {
    return {
      success: false,
      error: `Unknown gesture controller: ${gestureConfig.controller}`,
    };
  }
  
  try {
    // Lazy load the controller module
    const { WebcamGestureController } = await loader();
    const { intentBus } = await import('../gesture/IntentBus.js');
    
    // Create and initialize controller
    const controller = new WebcamGestureController(gestureConfig, intentBus);
    const initResult = await controller.initialize();
    
    if (initResult.success) {
      controller.start();
      activeControllers.set('gesture', controller);
      debug.log('Gesture feature initialized successfully');
    } else {
      debug.warn('Gesture initialization failed:', initResult.error);
    }
    
    return {
      ...initResult,
      controller: initResult.success ? controller : null,
    };
  } catch (error) {
    debug.error('Gesture feature initialization error:', error);
    return {
      success: false,
      error: error.message || 'INITIALIZATION_FAILED',
    };
  }
}

/**
 * Cleanup all active features
 */
export function cleanupFeatures() {
  activeControllers.forEach((controller, name) => {
    try {
      controller.destroy();
      debug.log(`Feature ${name} cleaned up`);
    } catch (error) {
      debug.error(`Error cleaning up feature ${name}:`, error);
    }
  });
  activeControllers.clear();
}

/**
 * Get active controller by name
 * @param {string} name
 * @returns {Object|undefined}
 */
export function getController(name) {
  return activeControllers.get(name);
}

export default {
  initializeFeatures,
  cleanupFeatures,
  getController,
};

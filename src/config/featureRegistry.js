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
// Tracking initialization attempts to avoid races and zombies
let initCount = 0;
let currentInitId = 0;

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
    if (activeControllers.has('gesture')) {
      debug.log('Gesture feature already initialized');
      return { gesture: { success: true, controller: activeControllers.get('gesture') } };
    }
    
    const initId = ++initCount;
    currentInitId = initId;
    
    debug.log(`Starting gesture initialization (Attempt #${initId})`);
    
    results.gesture = await initializeGestureFeature(initId);
    
    // If we were superseded by a newer init or cleaned up, result is irrelevant
    if (initId !== currentInitId) {
      debug.log(`Gesture initialization #${initId} superseded or aborted`);
      return { gesture: null };
    }
  } else {
    debug.log('Gesture feature disabled');
  }
  
  return results;
}

/**
 * Initialize gesture feature
 * @param {number} initId
 * @returns {Promise<FeatureInitResult>}
 */
async function initializeGestureFeature(initId) {
  debug.log('Loading gesture modules...');
  
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
    const [{ WebcamGestureController }, { intentBus }] = await Promise.all([
      loader(),
      import('../gesture/IntentBus.js')
    ]);
    
    // Check if we were superseded while waiting for imports
    if (initId !== currentInitId) {
      return { success: false, error: 'SUPERSEDED' };
    }

    // Create and initialize controller
    const controller = new WebcamGestureController(gestureConfig, intentBus);
    
    const initResult = await controller.initialize();
    
    // Final check before starting and registering
    if (initId !== currentInitId) {
      debug.log('Destroying superseded gesture controller');
      controller.destroy();
      return { success: false, error: 'SUPERSEDED' };
    }

    if (initResult.success) {
      controller.start();
      activeControllers.set('gesture', controller);
      
      // Initialize Invent Adapter
      if (gestureConfig.invent.gestureInteraction.enabled) {
        const { InventInteractionAdapter } = await import('../gesture/InventInteractionAdapter.js');
        const adapter = new InventInteractionAdapter({}); // Platform to be connected later
        adapter.start();
        activeControllers.set('inventAdapter', adapter);
      }

      debug.log(`Gesture feature initialized successfully (Attempt #${initId})`);
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
 * Sync zoom level to the active gesture controller
 * @param {number} level 
 */
export function syncGestureZoom(level) {
  const controller = activeControllers.get('gesture');
  if (controller && controller.setZoomLevel) {
    controller.setZoomLevel(level);
  }
}

/**
 * Cleanup all active features
 */
export function cleanupFeatures() {
  debug.log('Cleaning up all features...');
  currentInitId = 0; // Abort any pending initializations
  
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

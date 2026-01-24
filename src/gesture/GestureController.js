/**
 * Gesture Controller Base Class
 * Abstract interface for swappable gesture input controllers
 */

import { CONTROLLER_STATES, createIntentEvent } from './types.js';

/**
 * @typedef {import('./types.js').GestureIntent} GestureIntent
 * @typedef {import('./types.js').IntentPayload} IntentPayload
 * @typedef {import('./types.js').GestureControllerStatus} GestureControllerStatus
 * @typedef {import('./IntentBus.js').IntentBus} IntentBus
 */

/**
 * @typedef {Object} InitializationResult
 * @property {boolean} success
 * @property {string} [error]
 */

/**
 * Abstract base class for gesture controllers
 * Extend this to implement webcam, mouse, VR, or other input methods
 */
export class GestureController {
  /**
   * @param {Object} config - Controller configuration
   * @param {IntentBus} intentBus - Intent event bus
   */
  constructor(config, intentBus) {
    if (new.target === GestureController) {
      throw new Error('GestureController is abstract and cannot be instantiated directly');
    }
    
    /** @type {Object} */
    this.config = config;
    
    /** @type {IntentBus} */
    this.intentBus = intentBus;
    
    /** @type {boolean} */
    this.isActive = false;
    
    /** @type {boolean} */
    this.isInitialized = false;
    
    /** @type {string} */
    this.state = CONTROLLER_STATES.IDLE;
    
    /** @type {string|null} */
    this.errorMessage = null;
    
    /** @type {string} */
    this.source = 'base';
  }
  
  /**
   * Initialize the controller (e.g., request camera permissions)
   * @abstract
   * @returns {Promise<InitializationResult>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }
  
  /**
   * Start gesture detection
   * @abstract
   */
  start() {
    throw new Error('start() must be implemented by subclass');
  }
  
  /**
   * Stop gesture detection
   * @abstract
   */
  stop() {
    throw new Error('stop() must be implemented by subclass');
  }
  
  /**
   * Cleanup and release resources
   * @abstract
   */
  destroy() {
    throw new Error('destroy() must be implemented by subclass');
  }
  
  /**
   * Get current controller status
   * @returns {GestureControllerStatus}
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isInitialized: this.isInitialized,
      state: this.state,
      error: this.errorMessage,
    };
  }
  
  /**
   * Emit a gesture intent
   * @protected
   * @param {GestureIntent} intent
   * @param {Partial<IntentPayload>} [payload]
   */
  emitIntent(intent, payload = {}) {
    const event = createIntentEvent(intent, payload, this.source);
    this.intentBus.emit(event);
    
    // Always log for now to debug production
    console.log(`[Gesture] Intent: ${intent}`, payload);

    if (this.config.debug?.logIntents) {
      console.log(`[Gesture Trace] ${intent}:`, payload);
    }
  }
  
  /**
   * Set controller state
   * @protected
   * @param {string} state
   * @param {string} [error]
   */
  setState(state, error = null) {
    this.state = state;
    this.errorMessage = error;
    
    if (state === CONTROLLER_STATES.ACTIVE) {
      this.isActive = true;
    } else if (state === CONTROLLER_STATES.ERROR || state === CONTROLLER_STATES.PERMISSION_DENIED) {
      this.isActive = false;
    }
  }
}

export default GestureController;

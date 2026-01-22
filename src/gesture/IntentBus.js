/**
 * Intent Bus
 * Lightweight pub/sub event system for gesture intents
 * Decouples gesture detection from rendering logic
 */

/**
 * @typedef {import('./types.js').IntentEvent} IntentEvent
 * @typedef {import('./types.js').GestureIntent} GestureIntent
 */

/**
 * @callback IntentCallback
 * @param {IntentEvent} event
 */

class IntentBus {
  constructor() {
    /** @type {Map<string, Set<IntentCallback>>} */
    this.listeners = new Map();
    
    /** @type {IntentEvent|null} */
    this.lastEvent = null;
    
    /** @type {boolean} */
    this.paused = false;
  }
  
  /**
   * Subscribe to a specific intent or all intents ('*')
   * @param {GestureIntent | '*'} intent - Intent type or '*' for all
   * @param {IntentCallback} callback - Handler function
   * @returns {() => void} Unsubscribe function
   */
  subscribe(intent, callback) {
    if (!this.listeners.has(intent)) {
      this.listeners.set(intent, new Set());
    }
    this.listeners.get(intent).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(intent);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(intent);
        }
      }
    };
  }
  
  /**
   * Emit an intent event to all subscribers
   * @param {IntentEvent} event
   */
  emit(event) {
    if (this.paused) return;
    
    this.lastEvent = event;
    
    // Notify specific intent listeners
    const specificListeners = this.listeners.get(event.intent);
    if (specificListeners) {
      specificListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`IntentBus: Error in ${event.intent} listener:`, error);
        }
      });
    }
    
    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('IntentBus: Error in wildcard listener:', error);
        }
      });
    }
  }
  
  /**
   * Pause event emission
   */
  pause() {
    this.paused = true;
  }
  
  /**
   * Resume event emission
   */
  resume() {
    this.paused = false;
  }
  
  /**
   * Get the last emitted event
   * @returns {IntentEvent|null}
   */
  getLastEvent() {
    return this.lastEvent;
  }
  
  /**
   * Get subscriber count for an intent
   * @param {GestureIntent | '*'} intent
   * @returns {number}
   */
  subscriberCount(intent) {
    return this.listeners.get(intent)?.size || 0;
  }
  
  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
    this.lastEvent = null;
  }
  
  /**
   * Remove all listeners for a specific intent
   * @param {GestureIntent | '*'} intent
   */
  clearIntent(intent) {
    this.listeners.delete(intent);
  }
}

// Singleton instance
export const intentBus = new IntentBus();

// Also export class for testing
export { IntentBus };

export default intentBus;

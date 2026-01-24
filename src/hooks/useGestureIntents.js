/**
 * useGestureIntents Hook
 * React hook for subscribing to gesture intents
 */

import { useEffect, useRef, useState } from 'react';
import { intentBus } from '../gesture/IntentBus.js';
import { gestureConfig } from '../config/gesture.js';
import { INTENTS } from '../gesture/types.js';

/**
 * @typedef {import('../gesture/types.js').IntentEvent} IntentEvent
 * @typedef {import('../gesture/types.js').GestureIntent} GestureIntent
 */

/**
 * @typedef {Object} GestureHandlers
 * @property {(event: IntentEvent) => void} [ROTATE]
 * @property {(event: IntentEvent) => void} [ZOOM]
 * @property {(event: IntentEvent) => void} [PAN]
 * @property {(event: IntentEvent) => void} [IDLE]
 * @property {(event: IntentEvent) => void} [SELECT]
 * @property {(event: IntentEvent) => void} ['*'] - Wildcard handler for all intents
 */

/**
 * @typedef {Object} UseGestureIntentsOptions
 * @property {boolean} [enabled=true] - Enable/disable gesture subscription
 * @property {boolean} [pauseOnBlur=true] - Pause when window loses focus
 */

/**
 * Hook for subscribing to gesture intents
 * @param {GestureHandlers} handlers - Intent handlers
 * @param {UseGestureIntentsOptions} [options]
 * @returns {{lastIntent: GestureIntent|null, isActive: boolean}}
 */
export function useGestureIntents(handlers = {}, options = {}) {
  const { enabled = true, pauseOnBlur = true } = options;
  
  const handlersRef = useRef(handlers);
  
  // Update handlers ref in effect to avoid render-time ref access
  useEffect(() => {
    handlersRef.current = handlers;
  });
  
  const [lastIntent, setLastIntent] = useState(null);
  // Initialize based on config to avoid setState in effect
  const [isActive, setIsActive] = useState(() => gestureConfig.enabled && enabled);
  
  // Handle window focus/blur
  useEffect(() => {
    if (!pauseOnBlur) return;
    
    const handleBlur = () => intentBus.pause();
    const handleFocus = () => intentBus.resume();
    
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pauseOnBlur]);
  
  // Subscribe to intents
  useEffect(() => {
    // Don't subscribe if feature is disabled or hook is disabled
    if (!gestureConfig.enabled || !enabled) {
      return;
    }
    
    setIsActive(true);
    
    const unsubscribes = [];
    
    // Subscribe to each intent handler
    Object.entries(handlersRef.current).forEach(([intent, handler]) => {
      if (typeof handler === 'function') {
        const unsub = intentBus.subscribe(intent, (event) => {
          setLastIntent(event.intent);
          handler(event);
        });
        unsubscribes.push(unsub);
      }
    });
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
      setIsActive(false);
    };
  }, [enabled]);
  
  return { lastIntent, isActive };
}

/**
 * Hook for a single intent subscription
 * @param {GestureIntent} intent
 * @param {(event: IntentEvent) => void} handler
 * @param {UseGestureIntentsOptions} [options]
 */
export function useGestureIntent(intent, handler, options = {}) {
  const handlerRef = useRef(handler);
  
  // Update handler ref in effect to avoid render-time ref access
  useEffect(() => {
    handlerRef.current = handler;
  });
  
  useGestureIntents(
    { [intent]: (event) => handlerRef.current(event) },
    options
  );
}

/**
 * Hook to get current gesture state without handlers
 * @returns {{lastIntent: GestureIntent|null, isEnabled: boolean}}
 */
export function useGestureState() {
  const [lastIntent, setLastIntent] = useState(null);
  
  useEffect(() => {
    if (!gestureConfig.enabled) return;
    
    const unsub = intentBus.subscribe('*', (event) => {
      setLastIntent(event.intent);
    });
    
    return unsub;
  }, []);
  
  return {
    lastIntent,
    isEnabled: gestureConfig.enabled,
  };
}

export default useGestureIntents;

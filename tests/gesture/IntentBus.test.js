/**
 * IntentBus Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentBus } from '../../src/gesture/IntentBus.js';
import { INTENTS, createIntentEvent } from '../../src/gesture/types.js';

describe('IntentBus', () => {
  let bus;

  beforeEach(() => {
    bus = new IntentBus();
  });

  describe('subscribe', () => {
    it('should subscribe to a specific intent', () => {
      const handler = vi.fn();
      bus.subscribe(INTENTS.ROTATE, handler);
      
      expect(bus.subscriberCount(INTENTS.ROTATE)).toBe(1);
    });

    it('should return an unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe(INTENTS.ZOOM, handler);
      
      expect(bus.subscriberCount(INTENTS.ZOOM)).toBe(1);
      unsubscribe();
      expect(bus.subscriberCount(INTENTS.ZOOM)).toBe(0);
    });

    it('should support wildcard subscriptions', () => {
      const handler = vi.fn();
      bus.subscribe('*', handler);
      
      expect(bus.subscriberCount('*')).toBe(1);
    });
  });

  describe('emit', () => {
    it('should call handlers for the specific intent', () => {
      const handler = vi.fn();
      bus.subscribe(INTENTS.ROTATE, handler);
      
      const event = createIntentEvent(INTENTS.ROTATE, { deltaX: 0.5 });
      bus.emit(event);
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should call wildcard handlers for any intent', () => {
      const wildcardHandler = vi.fn();
      bus.subscribe('*', wildcardHandler);
      
      const event = createIntentEvent(INTENTS.PAN, { deltaX: 0.1, deltaY: 0.2 });
      bus.emit(event);
      
      expect(wildcardHandler).toHaveBeenCalledWith(event);
    });

    it('should not call handlers for different intents', () => {
      const rotateHandler = vi.fn();
      const zoomHandler = vi.fn();
      
      bus.subscribe(INTENTS.ROTATE, rotateHandler);
      bus.subscribe(INTENTS.ZOOM, zoomHandler);
      
      bus.emit(createIntentEvent(INTENTS.ROTATE));
      
      expect(rotateHandler).toHaveBeenCalledTimes(1);
      expect(zoomHandler).not.toHaveBeenCalled();
    });

    it('should store the last emitted event', () => {
      const event = createIntentEvent(INTENTS.IDLE);
      bus.emit(event);
      
      expect(bus.getLastEvent()).toBe(event);
    });

    it('should not emit when paused', () => {
      const handler = vi.fn();
      bus.subscribe(INTENTS.ZOOM, handler);
      
      bus.pause();
      bus.emit(createIntentEvent(INTENTS.ZOOM));
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit after resume', () => {
      const handler = vi.fn();
      bus.subscribe(INTENTS.ZOOM, handler);
      
      bus.pause();
      bus.resume();
      bus.emit(createIntentEvent(INTENTS.ZOOM));
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      bus.subscribe(INTENTS.ROTATE, vi.fn());
      bus.subscribe(INTENTS.ZOOM, vi.fn());
      bus.subscribe('*', vi.fn());
      
      bus.clear();
      
      expect(bus.subscriberCount(INTENTS.ROTATE)).toBe(0);
      expect(bus.subscriberCount(INTENTS.ZOOM)).toBe(0);
      expect(bus.subscriberCount('*')).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should catch and log errors in handlers without stopping other handlers', () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const successHandler = vi.fn();
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      bus.subscribe(INTENTS.PAN, errorHandler);
      bus.subscribe(INTENTS.PAN, successHandler);
      
      bus.emit(createIntentEvent(INTENTS.PAN));
      
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});

describe('createIntentEvent', () => {
  it('should create an event with default payload', () => {
    const event = createIntentEvent(INTENTS.IDLE);
    
    expect(event.intent).toBe(INTENTS.IDLE);
    expect(event.payload.deltaX).toBe(0);
    expect(event.payload.deltaY).toBe(0);
    expect(event.payload.scale).toBe(1);
    expect(event.timestamp).toBeDefined();
  });

  it('should merge custom payload with defaults', () => {
    const event = createIntentEvent(INTENTS.ZOOM, { scale: 1.5 });
    
    expect(event.payload.scale).toBe(1.5);
    expect(event.payload.deltaX).toBe(0);
  });
});

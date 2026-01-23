/**
 * Invent Interaction Adapter
 * Mediates between Gesture IntentBus and Invent Platform Actions
 */

import { intentBus } from './IntentBus.js';
import { INTENTS } from './types.js';
import { gestureConfig } from '../config/gesture.js';

export class InventInteractionAdapter {
  constructor(platform) {
    this.platform = platform; // e.g., CanvasNetwork instance or global app controller
    this.config = gestureConfig.invent.gestureInteraction;
    this.unsubscribes = [];
    this.isMouseMoving = false;
    this.mouseThrottleTimer = null;

    // Inertia state
    this.velocity = { x: 0, y: 0, zoom: 0 };
    this.friction = 0.92; // Decay factor per frame (lower = more friction)
    this.threshold = 0.0001;
    this.animationId = null;
    this.lastFrameTime = performance.now();
  }

  /**
   * Start listening for gesture intents
   */
  start() {
    if (!this.config.enabled) return;

    // Navigation Group
    if (this.config.groups.navigation) {
      this.unsubscribes.push(intentBus.subscribe(INTENTS.PAN, (e) => this.handlePan(e)));
      this.unsubscribes.push(intentBus.subscribe(INTENTS.ZOOM, (e) => this.handleZoom(e)));
      this.unsubscribes.push(intentBus.subscribe(INTENTS.ROTATE, (e) => this.handleRotate(e)));
    }

    // Exploration Group
    if (this.config.groups.exploration) {
      this.unsubscribes.push(intentBus.subscribe(INTENTS.SELECT, (e) => this.handleSelect(e)));
      this.unsubscribes.push(intentBus.subscribe(INTENTS.HOVER_FOCUS, (e) => this.handleHover(e)));
      this.unsubscribes.push(intentBus.subscribe(INTENTS.EXPAND_DETAILS, () => this.handleExpandDetails()));
      this.unsubscribes.push(intentBus.subscribe(INTENTS.CLUSTER_EXPAND, () => this.handleClusterExpand()));
      this.unsubscribes.push(intentBus.subscribe(INTENTS.CLUSTER_COLLAPSE, () => this.handleClusterCollapse()));
    }

    // Mode Control Group
    if (this.config.groups.modeControl) {
      this.unsubscribes.push(intentBus.subscribe(INTENTS.PAUSE, () => this.handlePause()));
      this.unsubscribes.push(intentBus.subscribe(INTENTS.LOCK, () => this.handleLock()));
    }

    // Listen for mouse movement to implement "Mouse Priority"
    window.addEventListener('mousemove', this.onMouseMove.bind(this));

    // Start physics loop
    this.runPhysicsLoop();
  }

  /**
   * Stop listening
   */
  stop() {
    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];
    window.removeEventListener('mousemove', this.onMouseMove);
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  /**
   * Physics loop for inertia
   */
  runPhysicsLoop() {
    const loop = (now) => {
      const dt = (now - this.lastFrameTime) / 16.67; // Normalize to 60fps
      this.lastFrameTime = now;

      if (this.isMouseMoving) {
        this.animationId = requestAnimationFrame(loop);
        return;
      }

      let active = false;

      // Apply pan inertia
      if (Math.abs(this.velocity.x) > this.threshold || Math.abs(this.velocity.y) > this.threshold) {
        if (this.platform.pan) {
          this.platform.pan(this.velocity.x * dt, this.velocity.y * dt);
        }
        this.velocity.x *= Math.pow(this.friction, dt);
        this.velocity.y *= Math.pow(this.friction, dt);
        active = true;
      }

      // Apply zoom inertia
      if (Math.abs(this.velocity.zoom) > this.threshold) {
        if (this.platform.zoom) {
          // Zoom velocity is additive to 1.0 (no movement = 1.0)
          this.platform.zoom(1 + this.velocity.zoom * dt);
        }
        this.velocity.zoom *= Math.pow(this.friction, dt);
        active = true;
      }

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * Implementation of "Mouse Priority"
   */
  onMouseMove() {
    this.isMouseMoving = true;
    if (this.mouseThrottleTimer) clearTimeout(this.mouseThrottleTimer);
    
    // Throttle gestures for 2 seconds after mouse movement
    this.mouseThrottleTimer = setTimeout(() => {
      this.isMouseMoving = false;
    }, 2000);
  }

  /**
   * Handle Pan intent
   */
  handlePan(event) {
    if (this.isMouseMoving) return;
    
    // Inject velocity for inertia
    this.velocity.x = event.payload.deltaX;
    this.velocity.y = event.payload.deltaY;

    if (this.platform.pan) {
      this.platform.pan(event.payload.deltaX, event.payload.deltaY);
    }
  }

  /**
   * Handle Zoom intent
   */
  handleZoom(event) {
    if (this.isMouseMoving) return;

    // Inject zoom velocity: scale of 1.05 means +0.05 velocity
    this.velocity.zoom = event.payload.scale - 1;

    if (this.platform.zoom) {
      this.platform.zoom(event.payload.scale);
    }
  }

  /**
   * Handle Rotate intent
   */
  handleRotate(event) {
    if (this.isMouseMoving) return;
    if (this.platform.rotate) {
      this.platform.rotate(event.payload.rotation || event.payload.deltaX);
    }
  }

  /**
   * Handle Hover intent
   */
  handleHover(event) {
    if (this.isMouseMoving) return;
    if (this.platform.hoverNode) {
      this.platform.hoverNode(event.payload.x, event.payload.y);
    }
  }

  /**
   * Handle detail expansion
   */
  handleExpandDetails() {
    if (this.isMouseMoving) return;
    if (this.platform.toggleDetailPanel) {
      this.platform.toggleDetailPanel(true);
    }
  }

  /**
   * Handle cluster expansion
   */
  handleClusterExpand() {
    if (this.isMouseMoving) return;
    if (this.platform.expandCluster) {
      this.platform.expandCluster();
    }
  }

  /**
   * Handle cluster collapse
   */
  handleClusterCollapse() {
    if (this.isMouseMoving) return;
    if (this.platform.collapseCluster) {
      this.platform.collapseCluster();
    }
  }

  handlePause() {
    intentBus.pause();
    setTimeout(() => intentBus.resume(), 1000); // Resume after pause gesture clears
  }

  handleLock() {
    if (this.platform.toggleLock) {
      this.platform.toggleLock();
    }
  }
}

export default InventInteractionAdapter;

/**
 * Gesture State Machine
 * Handles state transitions and temporal stabilization for gestures
 */

export const GESTURE_STATES = {
  IDLE: 'IDLE',
  POTENTIAL: 'POTENTIAL',
  ACTIVE: 'ACTIVE',
  EXIT_PENDING: 'EXIT_PENDING',
};

export class GestureStateMachine {
  constructor(config) {
    this.config = config;
    this.states = new Map(); // gestureName -> { state, startTime, lastSeenTime }
    this.cooldowns = new Map(); // gestureName -> lastExitTime
  }

  /**
   * Update state machine with current detections
   * @param {Set<string>} detectedGestures - Set of recognized gesture names in this frame
   * @returns {Set<string>} - Set of gestures currently in ACTIVE state
   */
  update(detectedGestures) {
    const now = Date.now();
    const activeGestures = new Set();

    // Process all gestures in the vocabulary config
    const allPossibleGestures = Object.keys(this.config.vocabulary);

    for (const gestureName of allPossibleGestures) {
      if (!this.config.vocabulary[gestureName].enabled) continue;

      let current = this.states.get(gestureName) || {
        state: GESTURE_STATES.IDLE,
        startTime: 0,
        lastSeenTime: 0
      };

      const isSeen = detectedGestures.has(gestureName);

      // State Transition Logic
      switch (current.state) {
        case GESTURE_STATES.IDLE:
          if (isSeen && !this.isInCooldown(gestureName, now)) {
            current.state = GESTURE_STATES.POTENTIAL;
            current.startTime = now;
            current.lastSeenTime = now;
          }
          break;

        case GESTURE_STATES.POTENTIAL:
          if (isSeen) {
            current.lastSeenTime = now;
            if (now - current.startTime >= this.config.stateMachine.holdDuration) {
              current.state = GESTURE_STATES.ACTIVE;
              current.startTime = now; // Mark start of active phase
            }
          } else {
            current.state = GESTURE_STATES.IDLE;
          }
          break;

        case GESTURE_STATES.ACTIVE:
          if (isSeen) {
            current.lastSeenTime = now;
            activeGestures.add(gestureName);
          } else {
            current.state = GESTURE_STATES.EXIT_PENDING;
            current.startTime = now; // Mark start of exit pending
          }
          break;

        case GESTURE_STATES.EXIT_PENDING:
          if (isSeen) {
            current.state = GESTURE_STATES.ACTIVE;
            current.lastSeenTime = now;
            activeGestures.add(gestureName);
          } else if (now - current.startTime >= this.config.stateMachine.exitDuration) {
            current.state = GESTURE_STATES.IDLE;
            this.cooldowns.set(gestureName, now);
          }
          break;
      }

      this.states.set(gestureName, current);
    }

    return activeGestures;
  }

  isInCooldown(gestureName, now) {
    const lastExit = this.cooldowns.get(gestureName) || 0;
    return now - lastExit < this.config.stateMachine.cooldown;
  }

  reset() {
    this.states.clear();
    this.cooldowns.clear();
  }
}

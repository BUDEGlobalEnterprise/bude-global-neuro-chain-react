/**
 * Gesture Worker
 * Off-main-thread processing for MediaPipe and State Machine
 */

const EPSILON = 1e-6;

const LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
};

const GESTURE_KEYS = ['NAV_PAN', 'POINTING_MODE', 'INSPECT_MODE', 'LOCK_MODE', 'PUSH_CLICK'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

const subtract = (a, b) => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: (a.z || 0) - (b.z || 0),
});

const add = (a, b) => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: (a.z || 0) + (b.z || 0),
});

const scale = (vector, value) => ({
  x: vector.x * value,
  y: vector.y * value,
  z: (vector.z || 0) * value,
});

const dot = (a, b) => a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);

const cross = (a, b) => ({
  x: a.y * (b.z || 0) - (a.z || 0) * b.y,
  y: (a.z || 0) * b.x - a.x * (b.z || 0),
  z: a.x * b.y - a.y * b.x,
});

const magnitude = (vector) => Math.sqrt(dot(vector, vector));

const normalize = (vector) => {
  const mag = magnitude(vector);
  if (mag < EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }
  return scale(vector, 1 / mag);
};

const distance3 = (a, b) => magnitude(subtract(a, b));

const centroid = (points) => {
  let sum = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < points.length; i += 1) {
    sum = add(sum, points[i]);
  }
  return scale(sum, 1 / Math.max(points.length, 1));
};

const confidenceFromThreshold = (value, threshold, softness = 0.18) => {
  if (threshold <= EPSILON) {
    return 0;
  }
  return clamp((value - threshold) / Math.max(threshold * softness, EPSILON), 0, 1);
};

const invertConfidence = (value, threshold, softness = 0.2) => {
  if (threshold <= EPSILON) {
    return 0;
  }
  return clamp((threshold - value) / Math.max(threshold * softness, EPSILON), 0, 1);
};

class DoubleExponentialFilter2D {
  constructor(options) {
    this.options = options;
    this.level = null;
    this.trend = { x: 0, y: 0 };
    this.lastTime = 0;
  }

  reset(value = null) {
    this.level = value ? { ...value } : null;
    this.trend = { x: 0, y: 0 };
    this.lastTime = 0;
  }

  update(value, confidence = 1, now = performance.now()) {
    if (!this.level) {
      this.level = { ...value };
      this.lastTime = now;
      return { ...value };
    }

    const dt = Math.max((now - this.lastTime) / 16.67, 0.5);
    const delta = Math.hypot(value.x - this.level.x, value.y - this.level.y);
    const speed = delta / dt;
    const alphaBoost = this.options.adaptiveSmoothing ? speed * (this.options.velocityGain || 0) : 0;
    const alphaBase = clamp(this.options.factor + alphaBoost, this.options.minAlpha, this.options.maxAlpha);
    const alpha = clamp(alphaBase * lerp(0.7, 1.05, confidence), this.options.minAlpha, this.options.maxAlpha);
    const beta = this.options.beta;

    const previousLevel = { ...this.level };
    this.level.x = alpha * value.x + (1 - alpha) * (this.level.x + this.trend.x * dt);
    this.level.y = alpha * value.y + (1 - alpha) * (this.level.y + this.trend.y * dt);
    this.trend.x = beta * ((this.level.x - previousLevel.x) / dt) + (1 - beta) * this.trend.x * this.options.trendDamping;
    this.trend.y = beta * ((this.level.y - previousLevel.y) / dt) + (1 - beta) * this.trend.y * this.options.trendDamping;
    this.lastTime = now;

    return {
      x: this.level.x + this.trend.x * this.options.prediction,
      y: this.level.y + this.trend.y * this.options.prediction,
    };
  }
}

class DoubleExponentialFilter1D {
  constructor(alpha, beta, damping = 0.82) {
    this.alpha = alpha;
    this.beta = beta;
    this.damping = damping;
    this.level = null;
    this.trend = 0;
  }

  reset(value = null) {
    this.level = value;
    this.trend = 0;
  }

  update(value) {
    if (this.level === null || Number.isNaN(this.level)) {
      this.level = value;
      return value;
    }

    const previousLevel = this.level;
    this.level = this.alpha * value + (1 - this.alpha) * (this.level + this.trend);
    this.trend = this.beta * (this.level - previousLevel) + (1 - this.beta) * this.trend * this.damping;
    return this.level + this.trend * 0.25;
  }
}

class GestureTransitionMachine {
  constructor(config) {
    this.config = config;
    this.states = new Map();
    this.cooldowns = new Map();
  }

  getConfig(name) {
    const gestureConfig = this.config.gestures?.[name] || {};
    return {
      holdDuration: gestureConfig.holdDuration ?? this.config.holdDuration ?? 100,
      gracePeriod: gestureConfig.gracePeriod ?? this.config.gracePeriod ?? 0,
      exitDuration: gestureConfig.exitDuration ?? this.config.exitDuration ?? this.config.gracePeriod ?? 0,
      cooldown: gestureConfig.cooldown ?? this.config.cooldown ?? 0,
      confidenceThreshold: gestureConfig.confidenceThreshold ?? this.config.confidenceThreshold ?? 0.7,
    };
  }

  update(scores, now = performance.now()) {
    const activeStates = new Set();
    const justActivated = [];
    const gestureMeta = {};
    const names = new Set([...GESTURE_KEYS, ...this.states.keys(), ...Object.keys(scores)]);

    for (const name of names) {
      const cfg = this.getConfig(name);
      const score = scores[name] || 0;
      const seen = score >= cfg.confidenceThreshold;
      const cooldownUntil = this.cooldowns.get(name) || 0;
      let current = this.states.get(name) || {
        phase: 'idle',
        enteredAt: now,
        lastSeenAt: 0,
        score: 0,
      };

      current.score = score;

      switch (current.phase) {
        case 'idle':
          if (seen && now >= cooldownUntil) {
            current.phase = 'potential';
            current.enteredAt = now;
            current.lastSeenAt = now;
          }
          break;
        case 'potential':
          if (seen) {
            current.lastSeenAt = now;
            if (now - current.enteredAt >= cfg.holdDuration) {
              current.phase = 'active';
              current.enteredAt = now;
              justActivated.push(name);
            }
          } else {
            current.phase = 'idle';
            current.enteredAt = now;
          }
          break;
        case 'active':
          if (seen) {
            current.lastSeenAt = now;
          } else {
            current.phase = 'exit_pending';
            current.enteredAt = now;
          }
          break;
        case 'exit_pending':
          if (seen) {
            current.phase = 'active';
            current.lastSeenAt = now;
          } else if (now - current.enteredAt >= cfg.exitDuration) {
            current.phase = 'idle';
            current.enteredAt = now;
            this.cooldowns.set(name, now + cfg.cooldown);
          }
          break;
      }

      const holdProgress = current.phase === 'potential'
        ? clamp((now - current.enteredAt) / Math.max(cfg.holdDuration, 1), 0, 1)
        : current.phase === 'active'
          ? 1
          : 0;

      const graceProgress = current.phase === 'exit_pending'
        ? 1 - clamp((now - current.enteredAt) / Math.max(cfg.exitDuration, 1), 0, 1)
        : current.phase === 'active'
          ? 1
          : 0;

      if (current.phase === 'active' || current.phase === 'exit_pending') {
        activeStates.add(name);
      }

      if (current.phase === 'idle' && score === 0) {
        this.states.delete(name);
      } else {
        this.states.set(name, current);
      }

      gestureMeta[name] = {
        confidence: Number(score.toFixed(3)),
        phase: current.phase,
        holdProgress: Number(holdProgress.toFixed(3)),
        graceProgress: Number(graceProgress.toFixed(3)),
        threshold: cfg.confidenceThreshold,
      };
    }

    return {
      activeStates,
      justActivated,
      gestureMeta,
    };
  }
}

const fingerTriplets = {
  thumb: [LANDMARKS.THUMB_TIP, LANDMARKS.THUMB_IP, LANDMARKS.THUMB_MCP],
  index: [LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_MCP],
  middle: [LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_MCP],
  ring: [LANDMARKS.RING_TIP, LANDMARKS.RING_PIP, LANDMARKS.RING_MCP],
  pinky: [LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_MCP],
};

const buildHandFeatures = (landmarks) => {
  const wrist = landmarks[LANDMARKS.WRIST];
  const indexMcp = landmarks[LANDMARKS.INDEX_MCP];
  const middleMcp = landmarks[LANDMARKS.MIDDLE_MCP];
  const pinkyMcp = landmarks[LANDMARKS.PINKY_MCP];
  const palmCenter = centroid([wrist, indexMcp, middleMcp, pinkyMcp]);
  const palmWidth = distance3(indexMcp, pinkyMcp);
  const palmHeight = distance3(wrist, middleMcp);
  const palmScale = Math.max((palmWidth + palmHeight) * 0.5, EPSILON);
  const lateral = normalize(subtract(indexMcp, pinkyMcp));
  const forward = normalize(subtract(middleMcp, wrist));
  const normal = normalize(cross(lateral, forward));

  const fingerStates = {};
  for (const [name, [tipIdx, pipIdx, mcpIdx]] of Object.entries(fingerTriplets)) {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];
    const mcpToPip = normalize(subtract(pip, mcp));
    const pipToTip = normalize(subtract(tip, pip));
    const mcpToTip = normalize(subtract(tip, mcp));
    const straightness = clamp((dot(mcpToPip, pipToTip) + 1) * 0.5, 0, 1);
    const extension = distance3(tip, mcp) / Math.max(distance3(pip, mcp), EPSILON);
    const forwardness = clamp((dot(mcpToTip, forward) + 1) * 0.5, 0, 1);
    const awayFromPalm = distance3(tip, palmCenter) / palmScale;

    fingerStates[name] = {
      straightness,
      extension,
      forwardness,
      awayFromPalm,
      direction: mcpToTip,
      tip,
    };
  }

  return {
    palmCenter,
    palmScale,
    basis: { forward, lateral, normal },
    fingerStates,
  };
};

const scoreHandGestures = (features, geometryConfig) => {
  const { fingerStates, basis, palmScale } = features;
  const index = fingerStates.index;
  const middle = fingerStates.middle;
  const ring = fingerStates.ring;
  const pinky = fingerStates.pinky;
  const thumb = fingerStates.thumb;

  const fingerSpread = distance3(index.tip, pinky.tip) / palmScale;
  const extensionThreshold = geometryConfig.extensionThreshold || 0.78;
  const curledThreshold = geometryConfig.curledFingerThreshold || 0.58;
  const pointingAlignment = geometryConfig.pointingAlignment || 0.72;

  const extensionScores = {
    index: clamp(((index.extension / 1.7) * 0.6) + (index.straightness * 0.4), 0, 1),
    middle: clamp(((middle.extension / 1.7) * 0.6) + (middle.straightness * 0.4), 0, 1),
    ring: clamp(((ring.extension / 1.7) * 0.6) + (ring.straightness * 0.4), 0, 1),
    pinky: clamp(((pinky.extension / 1.7) * 0.6) + (pinky.straightness * 0.4), 0, 1),
    thumb: clamp(((thumb.extension / 1.7) * 0.5) + (thumb.awayFromPalm / 2.2) * 0.5, 0, 1),
  };

  const openFingerCount = ['index', 'middle', 'ring', 'pinky']
    .reduce((count, key) => count + (extensionScores[key] >= extensionThreshold ? 1 : 0), 0);

  const openPalmScore = clamp(
    (openFingerCount / Math.max(geometryConfig.openPalmFingerThreshold || 3, 1)) * 0.5 +
    clamp(fingerSpread / Math.max(geometryConfig.fingerSeparationThreshold || 0.12, 0.01), 0, 1) * 0.25 +
    extensionScores.thumb * 0.25,
    0,
    1,
  );

  const pointingScore = clamp(
    extensionScores.index * 0.45 +
    confidenceFromThreshold(index.forwardness, pointingAlignment) * 0.25 +
    confidenceFromThreshold(index.awayFromPalm, 1.4) * 0.1 +
    invertConfidence(extensionScores.middle, curledThreshold) * 0.08 +
    invertConfidence(extensionScores.ring, curledThreshold) * 0.06 +
    invertConfidence(extensionScores.pinky, curledThreshold) * 0.06,
    0,
    1,
  );

  const twoFingerScore = clamp(
    extensionScores.index * 0.34 +
    extensionScores.middle * 0.34 +
    confidenceFromThreshold(distance3(index.tip, middle.tip) / palmScale, 0.45) * 0.12 +
    invertConfidence(extensionScores.ring, curledThreshold) * 0.1 +
    invertConfidence(extensionScores.pinky, curledThreshold) * 0.1,
    0,
    1,
  );

  const fistCompactness = (
    thumb.awayFromPalm +
    index.awayFromPalm +
    middle.awayFromPalm +
    ring.awayFromPalm +
    pinky.awayFromPalm
  ) / 5;

  const fistScore = clamp(
    invertConfidence(fistCompactness, 1.15) * 0.55 +
    invertConfidence(extensionScores.index, 0.52) * 0.12 +
    invertConfidence(extensionScores.middle, 0.52) * 0.12 +
    invertConfidence(extensionScores.ring, 0.52) * 0.11 +
    invertConfidence(extensionScores.pinky, 0.52) * 0.1,
    0,
    1,
  );

  return {
    palm: features.palmCenter,
    basis,
    fingerStates,
    scores: {
      openPalm: openPalmScore,
      pointing: pointingScore,
      twoFinger: twoFingerScore,
      fist: fistScore,
    },
  };
};

let config = null;
let stateMachine = null;
let positionFilter = null;
let zoomFilter = null;
let depthFilter = null;
let lastPalmDistance = null;
let lastFrameAt = 0;
let baselineDepth = 0;
let lastDepth = 0;

onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === 'INIT') {
    config = payload.config;
    stateMachine = new GestureTransitionMachine(config.stateMachine);
    positionFilter = new DoubleExponentialFilter2D({
      ...config.smoothing,
      adaptiveSmoothing: config.stabilization?.adaptiveSmoothing,
      velocityGain: config.stabilization?.velocityGain ?? 2.4,
    });
    zoomFilter = new DoubleExponentialFilter1D(
      config.smoothing.zoomAlpha ?? 0.24,
      0.08,
      config.smoothing.trendDamping ?? 0.82,
    );
    depthFilter = new DoubleExponentialFilter1D(
      config.smoothing.depthAlpha ?? 0.28,
      0.12,
      config.smoothing.trendDamping ?? 0.82,
    );
    return;
  }

  if (type !== 'PROCESS' || !config || !stateMachine || !positionFilter || !zoomFilter || !depthFilter) {
    return;
  }

  const now = performance.now();
  const dt = Math.max(now - (lastFrameAt || now - 16.67), 1);
  lastFrameAt = now;

  const { multiHandLandmarks = [], multiHandedness = [] } = payload;
  const handCount = multiHandLandmarks.length;

  if (!handCount) {
    lastPalmDistance = null;
    baselineDepth = 0;
    lastDepth = 0;
    positionFilter.reset();
    zoomFilter.reset(1);
    depthFilter.reset(0);
    const transition = stateMachine.update({}, now);
    postMessage({
      type: 'RESULTS',
      activeStates: Array.from(transition.activeStates),
      pos: null,
      zoomScale: 1,
      inspectPos: null,
      handCount: 0,
      gestureMeta: transition.gestureMeta,
      justActivated: transition.justActivated,
      primaryGesture: null,
      multiHandLandmarks,
      multiHandedness,
    });
    return;
  }

  try {
    const hands = multiHandLandmarks.map((landmarks) => {
      const features = buildHandFeatures(landmarks);
      return {
        landmarks,
        ...scoreHandGestures(features, config.geometry || {}),
      };
    });

    const palmTarget = handCount === 2
      ? centroid([hands[0].palm, hands[1].palm])
      : hands[0].palm;

    const primaryConfidence = Math.max(
      hands[0]?.scores.openPalm || 0,
      hands[0]?.scores.pointing || 0,
      hands[0]?.scores.twoFinger || 0,
      hands[0]?.scores.fist || 0,
    );

    const pos = positionFilter.update(
      { x: 1 - palmTarget.x, y: palmTarget.y },
      Math.max(primaryConfidence, config.stabilization?.confidenceJitterGate || 0.55),
      now,
    );

    let inspectPos = null;
    const scores = {
      NAV_PAN: 0,
      POINTING_MODE: 0,
      INSPECT_MODE: 0,
      LOCK_MODE: 0,
      PUSH_CLICK: 0,
    };

    for (let i = 0; i < hands.length; i += 1) {
      scores.NAV_PAN = Math.max(scores.NAV_PAN, hands[i].scores.openPalm);
      scores.POINTING_MODE = Math.max(scores.POINTING_MODE, hands[i].scores.pointing);
      scores.LOCK_MODE = Math.max(scores.LOCK_MODE, hands[i].scores.fist);
    }

    if (scores.POINTING_MODE >= scores.NAV_PAN) {
      const pointerHand = hands.reduce((best, hand) => (
        hand.scores.pointing > best.scores.pointing ? hand : best
      ), hands[0]);
      inspectPos = pointerHand.landmarks[LANDMARKS.INDEX_TIP];
    }

    let zoomScale = 1;
    if (handCount === 2) {
      const inspectCombos = [
        {
          pointer: hands[1],
          score: Math.min(Math.max(hands[0].scores.openPalm, hands[0].scores.fist), hands[1].scores.twoFinger),
        },
        {
          pointer: hands[0],
          score: Math.min(Math.max(hands[1].scores.openPalm, hands[1].scores.fist), hands[0].scores.twoFinger),
        },
      ];
      const bestCombo = inspectCombos[0].score >= inspectCombos[1].score ? inspectCombos[0] : inspectCombos[1];
      scores.INSPECT_MODE = bestCombo.score;
      if (bestCombo.score >= 0.45) {
        inspectPos = bestCombo.pointer.landmarks[LANDMARKS.INDEX_TIP];
      }

      const palmDistance = distance3(hands[0].palm, hands[1].palm);
      if (lastPalmDistance !== null) {
        const rawScale = palmDistance / Math.max(lastPalmDistance, EPSILON);
        lastPalmDistance = palmDistance;
        scores.NAV_PAN = Math.max(scores.NAV_PAN, Math.min(scores.INSPECT_MODE + 0.05, 1));
        zoomScale = zoomFilter.update(rawScale);
      } else {
        lastPalmDistance = palmDistance;
      }
    } else {
      lastPalmDistance = null;
    }

    const pointerCandidate = inspectPos ? (
      hands.find((hand) => hand.landmarks[LANDMARKS.INDEX_TIP] === inspectPos) ||
      hands.reduce((best, hand) => hand.scores.pointing > best.scores.pointing ? hand : best, hands[0])
    ) : hands[0];

    const pushConfig = config.depthGestures?.pushClick;
    if (pushConfig?.enabled) {
      const pointerPalm = pointerCandidate.palm;
      const pointerTip = pointerCandidate.landmarks[LANDMARKS.INDEX_TIP];
      const relativeDepth = (pointerPalm.z - pointerTip.z) / Math.max(pointerCandidate.fingerStates.index.awayFromPalm, 0.8);
      const smoothedDepth = depthFilter.update(relativeDepth);
      const depthVelocity = (smoothedDepth - lastDepth) / dt;
      const deltaFromBaseline = smoothedDepth - baselineDepth;
      lastDepth = smoothedDepth;

      if (scores.POINTING_MODE > 0.5 || scores.INSPECT_MODE > 0.5) {
        baselineDepth = lerp(baselineDepth, smoothedDepth, 0.04);
      } else {
        baselineDepth = lerp(baselineDepth, smoothedDepth, 0.18);
      }

      const depthScore = confidenceFromThreshold(deltaFromBaseline, pushConfig.activationThreshold, 0.28);
      const velocityScore = confidenceFromThreshold(depthVelocity, pushConfig.minVelocity, 0.35);
      scores.PUSH_CLICK = clamp(
        Math.max(scores.POINTING_MODE, scores.INSPECT_MODE) * 0.45 +
        depthScore * 0.4 +
        velocityScore * 0.15,
        0,
        1,
      );

      if (deltaFromBaseline < pushConfig.releaseThreshold) {
        scores.PUSH_CLICK *= 0.5;
      }
    }

    const transition = stateMachine.update(scores, now);
    const sortedGestures = Object.entries(transition.gestureMeta)
      .sort((a, b) => b[1].confidence - a[1].confidence);
    const primaryGesture = sortedGestures[0]?.[0] || null;

    postMessage({
      type: 'RESULTS',
      activeStates: Array.from(transition.activeStates),
      pos,
      zoomScale,
      inspectPos,
      handCount,
      gestureMeta: transition.gestureMeta,
      justActivated: transition.justActivated,
      primaryGesture,
      multiHandLandmarks,
      multiHandedness,
    });
  } catch (error) {
    postMessage({
      type: 'ERROR',
      payload: {
        message: error.message,
      },
    });
  }
};

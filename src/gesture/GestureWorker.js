/**
 * Gesture Worker
 * Off-main-thread processing for MediaPipe and State Machine
 */

// --- SELF-CONTAINED GEOMETRY UTILS ---
const distance = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const centroid = (points) => {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
};

const LANDMARKS = {
    WRIST: 0, THUMB_TIP: 4, INDEX_TIP: 8, INDEX_PIP: 6, INDEX_MCP: 5,
    MIDDLE_TIP: 12, MIDDLE_PIP: 10, MIDDLE_MCP: 9, RING_TIP: 16, RING_PIP: 14,
    RING_MCP: 13, PINKY_TIP: 20, PINKY_PIP: 18, PINKY_MCP: 17
};

const VOCABULARY = {
    isExtended: (landmarks, tip, pip, mcp) => {
        const tipPip = distance(landmarks[tip], landmarks[pip]);
        const pipMcp = distance(landmarks[pip], landmarks[mcp]);
        // Threshold 0.7 is more forgiving than 0.8
        return tipPip > pipMcp * 0.7;
    },
    isPointing: (landmarks) => {
        // Only Index is extended
        const index = VOCABULARY.isExtended(landmarks, LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_MCP);
        const middle = VOCABULARY.isExtended(landmarks, LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_MCP);
        const ring = VOCABULARY.isExtended(landmarks, LANDMARKS.RING_TIP, LANDMARKS.RING_PIP, LANDMARKS.RING_MCP);
        const pinky = VOCABULARY.isExtended(landmarks, LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_MCP);
        return index && !middle && !ring && !pinky;
    },
    isTwoFingerPoint: (landmarks) => {
        // Index and Middle are extended
        const index = VOCABULARY.isExtended(landmarks, LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_MCP);
        const middle = VOCABULARY.isExtended(landmarks, LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_MCP);
        const ring = VOCABULARY.isExtended(landmarks, LANDMARKS.RING_TIP, LANDMARKS.RING_PIP, LANDMARKS.RING_MCP);
        const pinky = VOCABULARY.isExtended(landmarks, LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_MCP);
        return index && middle && !ring && !pinky;
    },
    isOpenPalm: (landmarks) => {
        const fingers = [
            [LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_MCP],
            [LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_MCP],
            [LANDMARKS.RING_TIP, LANDMARKS.RING_PIP, LANDMARKS.RING_MCP],
            [LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_MCP]
        ];
        const extendedCount = fingers.filter(([t, p, m]) => VOCABULARY.isExtended(landmarks, t, p, m)).length;
        // Require at least 3 fingers to be extended (Relaxed from 4)
        return extendedCount >= 3;
    },
    isFist: (landmarks, threshold = 0.1) => {
        const p = centroid([landmarks[0], landmarks[5], landmarks[9]]);
        const tips = [LANDMARKS.THUMB_TIP, LANDMARKS.INDEX_TIP, LANDMARKS.MIDDLE_TIP, LANDMARKS.RING_TIP, LANDMARKS.PINKY_TIP];
        const avg = tips.reduce((s, t) => s + distance(landmarks[t], p), 0) / tips.length;
        return avg < threshold;
    }
};

// --- STATE MACHINE ---
class StateMachine {
    constructor(config) {
        this.config = config;
        this.activeStates = new Map(); // state -> { startTime, lastSeen }
    }
    update(detectedThisFrame) {
        const now = Date.now();
        const active = new Set();
        
        detectedThisFrame.forEach(state => {
            if (!this.activeStates.has(state)) {
                this.activeStates.set(state, { startTime: now, lastSeen: now });
            } else {
                this.activeStates.get(state).lastSeen = now;
            }
            
            const stateData = this.activeStates.get(state);
            if (now - stateData.startTime > this.config.holdDuration) {
                active.add(state);
            }
        });

        // Cleanup old states with grace period
        for (const [state, data] of this.activeStates.entries()) {
            if (!detectedThisFrame.has(state)) {
                const timeSinceSeen = now - data.lastSeen;
                if (timeSinceSeen > (this.config.gracePeriod || 0)) {
                    this.activeStates.delete(state);
                } else if (now - data.startTime > this.config.holdDuration) {
                    active.add(state);
                }
            }
        }
        return active;
    }
}

// --- DOUBLE EXPONENTIAL SMOOTHING ---
class Smoother {
    constructor(alpha, beta) {
        this.alpha = alpha;
        this.beta = beta;
        this.s = null;
        this.b = { x: 0, y: 0 };
    }
    update(pos) {
        if (!this.s) { this.s = { ...pos }; return this.s; }
        const prevS = { ...this.s };
        this.s.x = this.alpha * pos.x + (1 - this.alpha) * (prevS.x + this.b.x);
        this.s.y = this.alpha * pos.y + (1 - this.alpha) * (prevS.y + this.b.y);
        this.b.x = this.beta * (this.s.x - prevS.x) + (1 - this.beta) * this.b.x;
        this.b.y = this.beta * (this.s.y - prevS.y) + (1 - this.beta) * this.b.y;
        return this.s;
    }
}

let config = null;
let sm = null;
let smoother = null;
let zoomSmoother = null;
let lastPalmDist = null;
let lastSmoothedPos = null;
let lastZoomScale = 1;

onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === 'INIT') {
        config = payload.config;
        sm = new StateMachine(config.stateMachine);
        smoother = new Smoother(config.smoothing.factor, config.smoothing.beta);
        zoomSmoother = new Smoother(config.stabilization.zoomAlpha, 0.05);
        return;
    }

    if (type === 'PROCESS') {
        if (!sm || !smoother || !zoomSmoother) {
            console.warn('[Worker] PROCESS received before INIT');
            return;
        }
        
        const { multiHandLandmarks } = payload;
        const activeStates = new Set();
        const rawDetected = new Set();
        let inspectPos = null;

        if (multiHandLandmarks && multiHandLandmarks.length > 0) {
            try {
                const handStates = multiHandLandmarks.map(landmarks => ({
                    isPointing: VOCABULARY.isPointing(landmarks),
                    isTwoFinger: VOCABULARY.isTwoFingerPoint(landmarks),
                    isFist: VOCABULARY.isFist(landmarks),
                    isOpen: VOCABULARY.isOpenPalm(landmarks),
                    pos: centroid([landmarks[0], landmarks[5], landmarks[9]])
                }));

                handStates.forEach((state) => {
                    if (state.isPointing) rawDetected.add('PRECISION_ROTATE');
                    if (state.isFist) {
                        rawDetected.add('LOCK_MODE');
                    }
                    if (state.isOpen) rawDetected.add('NAV_PAN');
                });

                // Dual-Hand Coordination: Precision Inspection Mode
                if (multiHandLandmarks.length === 2) {
                    const [h0, h1] = handStates;
                    // Case 1: Hand 0 holds, Hand 1 points
                    if ((h0.isOpen || h0.isFist) && h1.isTwoFinger) {
                        rawDetected.add('INSPECT_MODE');
                        inspectPos = h1.pos;
                    } 
                    // Case 2: Hand 1 holds, Hand 0 points
                    else if ((h1.isOpen || h1.isFist) && h0.isTwoFinger) {
                        rawDetected.add('INSPECT_MODE');
                        inspectPos = h0.pos;
                    }
                }

                // Midpoint Panning (Dr. Strange Style)
                let rawPalm;
                if (multiHandLandmarks.length === 2) {
                    rawPalm = centroid([handStates[0].pos, handStates[1].pos]);
                } else {
                    rawPalm = handStates[0].pos;
                }
                
                // Adaptive Smoothing: Adjust alpha based on distance from last position
                if (config.stabilization.adaptiveSmoothing && lastSmoothedPos) {
                    const dist = distance(rawPalm, lastSmoothedPos);
                    // If moving fast, increase alpha (less lag); if slow, decrease alpha (more stability)
                    const adaptiveAlpha = Math.min(0.8, config.smoothing.factor + dist * 2);
                    smoother.alpha = adaptiveAlpha;
                }

                lastSmoothedPos = smoother.update({ x: 1 - rawPalm.x, y: rawPalm.y });

                if (multiHandLandmarks.length === 2) {
                    const dist = distance(centroid(multiHandLandmarks[0]), centroid(multiHandLandmarks[1]));
                    if (lastPalmDist) {
                        const rawScale = dist / lastPalmDist;
                        const smoothedScale = zoomSmoother.update({ x: rawScale, y: 0 }).x;
                        lastZoomScale = smoothedScale;
                    }
                    lastPalmDist = dist;
                } else {
                    lastPalmDist = null;
                    lastZoomScale = 1;
                }
            } catch (err) {
                console.error('[Worker] Processing error:', err);
            }
        } else {
            lastPalmDist = null;
            lastZoomScale = 1;
        }

        sm.update(rawDetected).forEach(s => activeStates.add(s));

        postMessage({ 
            type: 'RESULTS', 
            activeStates: Array.from(activeStates), 
            pos: lastSmoothedPos,
            zoomScale: lastZoomScale,
            inspectPos: inspectPos,
            handCount: multiHandLandmarks.length,
            multiHandLandmarks: multiHandLandmarks,
            multiHandedness: payload.multiHandedness
        });
    }
};

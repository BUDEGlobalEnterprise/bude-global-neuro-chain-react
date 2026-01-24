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
let lastPalmDist = null;
let lastSmoothedPos = null;
let lastZoomScale = 1;

onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === 'INIT') {
        config = payload.config;
        sm = new StateMachine(config.stateMachine);
        smoother = new Smoother(config.smoothing.factor, config.smoothing.beta);
        return;
    }

    if (type === 'PROCESS') {
        if (!sm || !smoother) {
            console.warn('[Worker] PROCESS received before INIT');
            return;
        }
        
        const { multiHandLandmarks } = payload;
        const activeStates = new Set();
        const rawDetected = new Set();

        if (multiHandLandmarks && multiHandLandmarks.length > 0) {
            try {
                multiHandLandmarks.forEach(landmarks => {
                    if (VOCABULARY.isPointing(landmarks)) rawDetected.add('PRECISION_ROTATE');
                    if (VOCABULARY.isFist(landmarks)) rawDetected.add('LOCK_MODE');
                    if (VOCABULARY.isOpenPalm(landmarks)) rawDetected.add('NAV_PAN');
                });

                if (rawDetected.size > 0) {
                    console.log(`[Worker] Raw Detected: ${Array.from(rawDetected).join(', ')}`);
                }

                const rawPalm = centroid([multiHandLandmarks[0][0], multiHandLandmarks[0][5], multiHandLandmarks[0][9]]);
                lastSmoothedPos = smoother.update({ x: 1 - rawPalm.x, y: rawPalm.y });

                if (multiHandLandmarks.length === 2) {
                    const dist = distance(centroid(multiHandLandmarks[0]), centroid(multiHandLandmarks[1]));
                    if (lastPalmDist) lastZoomScale = dist / lastPalmDist;
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

        if (activeStates.size > 0) {
            console.log(`[Worker] Active States: ${Array.from(activeStates).join(', ')}`);
        }

        postMessage({ 
            type: 'RESULTS', 
            activeStates: Array.from(activeStates), 
            pos: lastSmoothedPos,
            zoomScale: lastZoomScale
        });
    }
};

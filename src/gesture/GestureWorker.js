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
        return tipPip > pipMcp * 0.8;
    },
    isPointing: (landmarks) => {
        const index = VOCABULARY.isExtended(landmarks, LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_MCP);
        const middle = VOCABULARY.isExtended(landmarks, LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_MCP);
        const ring = VOCABULARY.isExtended(landmarks, LANDMARKS.RING_TIP, LANDMARKS.RING_PIP, LANDMARKS.RING_MCP);
        const pinky = VOCABULARY.isExtended(landmarks, LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_MCP);
        return index && !middle && !ring && !pinky;
    },
    isOpenPalm: (landmarks) => {
        return [
            [LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_MCP],
            [LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_MCP],
            [LANDMARKS.RING_TIP, LANDMARKS.RING_PIP, LANDMARKS.RING_MCP],
            [LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_MCP]
        ].every(([t, p, m]) => VOCABULARY.isExtended(landmarks, t, p, m));
    },
    isFist: (landmarks, threshold = 0.08) => {
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
        this.activeStates = new Map(); // state -> startTime
    }
    update(detectedThisFrame) {
        const now = Date.now();
        const active = new Set();
        detectedThisFrame.forEach(state => {
            if (!this.activeStates.has(state)) {
                this.activeStates.set(state, now);
            }
            if (now - this.activeStates.get(state) > this.config.holdDuration) {
                active.add(state);
            }
        });
        // Cleanup old states
        for (const state of this.activeStates.keys()) {
            if (!detectedThisFrame.has(state)) this.activeStates.delete(state);
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
        // payload = { multiHandLandmarks, multiHandedness }
        const { multiHandLandmarks } = payload;
        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            postMessage({ type: 'RESULTS', activeStates: [], pos: null });
            return;
        }

        const activeStates = new Set();
        try {
            multiHandLandmarks.forEach(landmarks => {
                const detected = new Set();
                if (VOCABULARY.isPointing(landmarks)) detected.add('PRECISION_ROTATE');
                if (VOCABULARY.isFist(landmarks)) detected.add('LOCK_MODE');
                if (VOCABULARY.isOpenPalm(landmarks)) detected.add('NAV_PAN');
                sm.update(detected).forEach(s => activeStates.add(s));
            });

            // Positional Smoothing
            const rawPalm = centroid([multiHandLandmarks[0][0], multiHandLandmarks[0][5], multiHandLandmarks[0][9]]);
            const smoothed = smoother.update({ x: 1 - rawPalm.x, y: rawPalm.y });

            // Multi-hand extensions (Zoom)
            let zoomScale = 1;
            if (multiHandLandmarks.length === 2) {
                const dist = distance(centroid(multiHandLandmarks[0]), centroid(multiHandLandmarks[1]));
                if (lastPalmDist) zoomScale = dist / lastPalmDist;
                lastPalmDist = dist;
            } else {
                lastPalmDist = null;
            }

            if (multiHandLandmarks.length > 0 && activeStates.size > 0) {
                // Log only if states are found to avoid spam
                console.debug(`[Worker] Detected: ${Array.from(activeStates).join(', ')}`);
            }

            postMessage({ 
                type: 'RESULTS', 
                activeStates: Array.from(activeStates), 
                pos: smoothed,
                zoomScale
            });
        } catch (err) {
            console.error('[Worker] Processing error:', err);
            postMessage({ type: 'ERROR', payload: err.message });
        }
    }
};

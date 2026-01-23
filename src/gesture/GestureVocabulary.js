/**
 * Gesture Vocabulary
 * Geometric rules for detecting hand signs and spatial gestures
 */

export const LANDMARKS = {
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

/**
 * Calculate distance between two landmarks
 */
export function distance(a, b) {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) + 
    Math.pow(a.y - b.y, 2) + 
    Math.pow(a.z - b.z, 2)
  );
}

/**
 * Calculate centroid of multiple landmarks
 */
export function centroid(landmarks) {
  const sum = landmarks.reduce(
    (acc, l) => ({ x: acc.x + l.x, y: acc.y + l.y, z: acc.z + l.z }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / landmarks.length,
    y: sum.y / landmarks.length,
    z: sum.z / landmarks.length,
  };
}

/**
 * Predicates for gesture detection
 * Using relative geometry for orientation invariance
 */
export const VOCABULARY = {
  /**
   * Check if a finger is extended relative to the palm
   * @param {Object[]} landmarks 
   * @param {number} tip - Tip index
   * @param {number} pip - PIP index
   * @param {number} mcp - MCP index
   */
  isExtended: (landmarks, tip, pip, mcp) => {
    const tipPip = distance(landmarks[tip], landmarks[pip]);
    const pipMcp = distance(landmarks[pip], landmarks[mcp]);
    // A finger is extended if the tip is significantly further from the PIP than the MCP is
    return tipPip > pipMcp * 0.8;
  },

  /**
   * Index finger pointing, other fingers curled
   */
  isPointing: (landmarks) => {
    const index = VOCABULARY.isExtended(landmarks, LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_MCP);
    const middle = VOCABULARY.isExtended(landmarks, LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_MCP);
    const ring = VOCABULARY.isExtended(landmarks, LANDMARKS.RING_TIP, LANDMARKS.RING_PIP, LANDMARKS.RING_MCP);
    const pinky = VOCABULARY.isExtended(landmarks, LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_MCP);
    
    return index && !middle && !ring && !pinky;
  },

  /**
   * Thumb and middle finger pinching
   */
  isTMPinch: (landmarks, threshold = 0.05) => {
    return distance(landmarks[LANDMARKS.THUMB_TIP], landmarks[LANDMARKS.MIDDLE_TIP]) < threshold;
  },

  /**
   * All fingers curled towards the palm
   */
  isFist: (landmarks, threshold = 0.08) => {
    const palm = centroid([
      landmarks[LANDMARKS.WRIST],
      landmarks[LANDMARKS.INDEX_MCP],
      landmarks[LANDMARKS.MIDDLE_MCP]
    ]);
    const fingerTips = [
      LANDMARKS.THUMB_TIP,
      LANDMARKS.INDEX_TIP,
      LANDMARKS.MIDDLE_TIP,
      LANDMARKS.RING_TIP,
      LANDMARKS.PINKY_TIP
    ];
    const avgDist = fingerTips.reduce((sum, tip) => sum + distance(landmarks[tip], palm), 0) / fingerTips.length;
    return avgDist < threshold;
  },

  /**
   * All fingers extended and palm open
   */
  isOpenPalm: (landmarks) => {
    return [
      [LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_MCP],
      [LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_MCP],
      [LANDMARKS.RING_TIP, LANDMARKS.RING_PIP, LANDMARKS.RING_MCP],
      [LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_MCP]
    ].every(([t, p, m]) => VOCABULARY.isExtended(landmarks, t, p, m));
  },

  /**
   * Thumb extended away from palm
   */
  isThumbExtended: (landmarks) => {
    const thumbDistance = distance(landmarks[LANDMARKS.THUMB_TIP], landmarks[LANDMARKS.INDEX_MCP]);
    return thumbDistance > 0.12; 
  },

  /**
   * Palm facing the camera (hand open and depth visibility)
   */
  isPalmFacing: (landmarks) => {
    const isVisible = landmarks[LANDMARKS.INDEX_MCP].z < landmarks[LANDMARKS.WRIST].z;
    return VOCABULARY.isOpenPalm(landmarks) && isVisible;
  },

  /**
   * Two hands moving apart or together
   */
  detectExpansion: (hand1, hand2, prevDist) => {
    const currDist = distance(centroid(hand1), centroid(hand2));
    if (!prevDist) return 'NONE';
    const diff = currDist - prevDist;
    if (diff > 0.03) return 'EXPAND'; // Lowered threshold for responsiveness
    if (diff < -0.03) return 'COLLAPSE';
    return 'NONE';
  }
};

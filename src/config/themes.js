export const THEMES = {
  default: {
    label: 'Neuro',
    layout: 'force',
    background: '#040406', // Deep dark blue/black
    nodeBase: '#888888',
    edgeBase: '#666666',
    text: '#e8e6e3',
    glow: true,
    pulses: true,
    draggable: true, 
    font: "'JetBrains Mono', monospace",
    physics: { 
        repulsion: 8000, 
        spring: 0.004, 
        centerGravity: 0.0001
    }
  },
  obsidian: {
    label: 'Obsidian',
    layout: 'force',
    background: '#000000', // Absolute black
    nodeBase: '#444444', 
    edgeBase: '#333333',
    text: '#888888',
    glow: false, // Minimalist
    pulses: false,
    font: "'Inter', sans-serif",
    physics: { repulsion: 6000, spring: 0.01 } // Very spacious
  },
  cyber: {
    label: 'Cyberpunk',
    layout: 'grid',
    background: '#0d0221', // Dark violet
    nodeBase: '#00ffff', // Cyan
    edgeBase: '#ff00ff', // Magenta
    text: '#00ffff',
    glow: true,
    pulses: true,
    font: "'Orbitron', sans-serif",
    physics: { repulsion: 3000, spring: 0.04 }
  },
  blueprint: {
    label: 'Blueprint',
    layout: 'grid',
    background: '#1a3c6e', // Blueprint blue
    nodeBase: '#ffffff',
    edgeBase: '#aaccff',
    text: '#ffffff',
    glow: false,
    pulses: false,
    font: "'Courier New', monospace",
    physics: { repulsion: 2000, spring: 0.05 }
  },
  matrix: {
    label: 'Matrix',
    layout: 'grid',
    background: '#000800', // Dark green tint
    nodeBase: '#00ff00',
    edgeBase: '#003300',
    text: '#00ff00',
    glow: true,
    pulses: true,
    font: "'Courier', monospace",
    physics: { repulsion: 2000, spring: 0.05 }
  },
  cosmos: {
    label: 'Cosmos',
    layout: 'radial',
    background: '#050510', // Deep space
    nodeBase: '#ffffff',
    edgeBase: '#4b0082', // Indigo
    text: '#aaaaff', 
    glow: true, 
    pulses: true,
    font: "'Exo 2', sans-serif",
    physics: { repulsion: 1000, spring: 0.02 }
  },
  minimal: {
    label: 'Minimal Light',
    layout: 'force',
    background: '#ffffff',
    nodeBase: '#333333',
    edgeBase: '#dddddd',
    text: '#000000',
    glow: false,
    pulses: false,
    font: "'Helvetica Neue', sans-serif",
    physics: { repulsion: 2500, spring: 0.03 }
  },
  forest: {
    label: 'Forest',
    layout: 'force',
    background: '#0a1a0a', // Dark forest green
    nodeBase: '#4caf50',
    edgeBase: '#2e7d32',
    text: '#a5d6a7',
    glow: true,
    pulses: true,
    font: "'Karma', serif",
    physics: { repulsion: 2200, spring: 0.03 }
  },
  sunset: {
    label: 'Sunset',
    layout: 'force',
    background: '#1a0b0b', // Dark red base
    nodeBase: '#ff9800', // Orange
    edgeBase: '#e91e63', // Pink
    text: '#ffcc80',
    glow: true,
    pulses: true,
    font: "'Poppins', sans-serif",
    physics: { repulsion: 2400, spring: 0.04 }
  },
  terminal: {
    label: 'Terminal',
    layout: 'grid',
    background: '#0c0c0c',
    nodeBase: '#33ff33', // Phosphor green
    edgeBase: '#1a4d1a',
    text: '#33ff33',
    glow: true,
    pulses: false,
    font: "'VT323', monospace",
    physics: { repulsion: 2000, spring: 0.05 }
  },
  paper: {
    label: 'Paper',
    layout: 'force',
    background: '#fdf6e3', // Solarized light / sepia
    nodeBase: '#586e75',
    edgeBase: '#93a1a1',
    text: '#657b83',
    glow: false,
    pulses: false,
    font: "'Garamond', serif",
    physics: { repulsion: 2500, spring: 0.03 }
  },
  void: {
    label: 'Void',
    layout: 'radial',
    background: '#000000', // Pure black
    nodeBase: '#333333', // Dark gray nodes
    edgeBase: '#111111', // Almost invisible edges
    text: '#444444',
    glow: false,
    pulses: false,
    font: "'Roboto', sans-serif",
    physics: { repulsion: 4000, spring: 0.01 } // Extremely spaced
  },
  structure: {
    label: 'Structure',
    layout: 'force',
    background: '#0c0c12', /* Same as Minimap background for consistency */
    nodeBase: '#2a9d8f',   /* Teal/Cyan structural feel */
    edgeBase: '#1a3c6e',   /* Subtle blueprint blue */
    text: '#00ffff',
    glow: true,
    pulses: false,         /* Static, map-like */
    draggable: false,      /* Locked like a map? maybe not, le'ts keep readable */
    font: "'JetBrains Mono', monospace",
    physics: {
        repulsion: 3000,
        spring: 0.01,
        centerGravity: 0.05 /* Tighter pack like a map? */
    }
  }
};

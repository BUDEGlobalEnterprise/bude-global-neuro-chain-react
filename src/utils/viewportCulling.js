/**
 * Viewport culling - only render nodes visible in current viewport
 * Significantly improves performance for large datasets (10k+ nodes)
 */
/**
 * Checks if a point is within the visible viewport plus a margin
 */
export const isPointVisible = (x, y, camera, zoom, width, height, margin = 100) => {
  const left = (-camera.x - margin) / zoom;
  const right = (width - camera.x + margin) / zoom;
  const top = (-camera.y - margin) / zoom;
  const bottom = (height - camera.y + margin) / zoom;

  return x >= left && x <= right && y >= top && y <= bottom;
};

export const getVisibleNodes = (nodes, camera, zoom, width, height, margin = 200) => {
  const viewportLeft = (-camera.x - margin) / zoom;
  const viewportRight = (width - camera.x + margin) / zoom;
  const viewportTop = (-camera.y - margin) / zoom;
  const viewportBottom = (height - camera.y + margin) / zoom;

  return nodes.filter(node => {
    return node.x >= viewportLeft &&
           node.x <= viewportRight &&
           node.y >= viewportTop &&
           node.y <= viewportBottom;
  });
};

/**
 * Get visible edges (endpoints are used to determine visibility)
 * Optimized for performance by using a visibility set
 */
export const getVisibleEdges = (edges, visibleNodeIds) => {
  // If we have 20k edges, we only want to process them if at least one end is visible
  if (visibleNodeIds.size === 0) return [];
  
  return edges.filter(edge => {
    return visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target);
  });
};

/**
 * Level of Detail (LOD) - adjust rendering quality based on zoom level
 * OPTIMIZED for large datasets (715+ nodes, 1500+ edges)
 */
export const getLODSettings = (zoom) => {
  if (zoom < 0.15) {
    return {
      renderNodes: true,
      renderEdges: false,
      renderLabels: false,
      renderGlow: false,
      renderPulses: false,
      edgeWidth: 0,
      simplifiedNodes: true,
      skipPhysics: true // Can be used to pause layout at extreme zoom
    };
  } else if (zoom < 0.4) {
    return {
      renderNodes: true,
      renderEdges: true,
      renderLabels: false,
      renderGlow: false,
      renderPulses: false,
      edgeWidth: 0.3,
      simplifiedNodes: true,
      maxEdges: 500,
      straightEdges: true // Draw lines instead of curves
    };
  } else if (zoom < 0.8) {
    return {
      renderNodes: true,
      renderEdges: true,
      renderLabels: false,
      renderGlow: true,
      renderPulses: false,
      edgeWidth: 0.7,
      simplifiedNodes: false,
      maxEdges: 2000
    };
  } else {
    return {
      renderNodes: true,
      renderEdges: true,
      renderLabels: true,
      renderGlow: true,
      renderPulses: true,
      edgeWidth: 1.0,
      simplifiedNodes: false,
      maxEdges: Infinity
    };
  }
};

/**
 * Spatial hash grid for fast proximity queries
 * Useful for hover detection with large node counts
 */
export class SpatialHash {
  constructor(cellSize = 100) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  insert(node) {
    const cellX = Math.floor(node.x / this.cellSize);
    const cellY = Math.floor(node.y / this.cellSize);
    const key = `${cellX},${cellY}`;

    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(node);
  }

  queryRange(x1, y1, x2, y2) {
    const results = [];
    const minX = Math.floor(x1 / this.cellSize);
    const maxX = Math.floor(x2 / this.cellSize);
    const minY = Math.floor(y1 / this.cellSize);
    const maxY = Math.floor(y2 / this.cellSize);

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.grid.get(key);
        if (cell) {
          results.push(...cell);
        }
      }
    }
    return results;
  }

  query(x, y, radius) {
    const results = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerX = Math.floor(x / this.cellSize);
    const centerY = Math.floor(y / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${centerX + dx},${centerY + dy}`;
        const cell = this.grid.get(key);
        if (cell) {
          results.push(...cell);
        }
      }
    }

    return results;
  }

  build(nodes) {
    this.clear();
    nodes.forEach(node => this.insert(node));
  }
}

/* eslint-disable no-restricted-globals */

// Physics constants
const REPULSION_FORCE = 4000;
const SPRING_LENGTH = 120;
const SPRING_FORCE = 0.08;
const CENTER_FORCE = 0.005;
const DAMPING = 0.85;

let nodes = [];
let edges = [];
let nodeMap = new Map();

self.onmessage = (e) => {
    const { type, payload } = e.data;

    if (type === 'INIT_DATA' || type === 'UPDATE_DATA') {
        nodes = payload.nodes;
        edges = payload.edges;
        nodeMap.clear();
        nodes.forEach(n => nodeMap.set(n.id, n));
    }
    else if (type === 'STEP') {
        const { layoutMode, clusterKeys } = payload;
        
        if (nodes.length === 0) return;

        // --- Layout / Physics Step ---
        if (layoutMode === 'grid') {
             // Grid Layout
             const GRID_COLS = Math.ceil(Math.sqrt(nodes.length * 1.5));
             const GRID_SPACING = 150;

             nodes.forEach((node, index) => {
                 const col = index % GRID_COLS;
                 const row = Math.floor(index / GRID_COLS);
                 const targetX = (col - GRID_COLS / 2) * GRID_SPACING;
                 const targetY = (row - GRID_COLS / 2) * GRID_SPACING;
                 
                 const dx = targetX - node.x;
                 const dy = targetY - node.y;
                 node.vx += dx * 0.05;
                 node.vy += dy * 0.05;
             });

        } else if (layoutMode === 'radial') {
             // Radial Layout
             nodes.forEach(node => {
                 const clusterIndex = clusterKeys ? clusterKeys.indexOf(node.cluster) : -1;
                 const ringIndex = clusterIndex === -1 ? (clusterKeys ? clusterKeys.length : 0) : clusterIndex;
                 const radius = 200 + (ringIndex * 150);
                 
                 const angle = (node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360) * (Math.PI / 180);
                 const targetX = Math.cos(angle) * radius;
                 const targetY = Math.sin(angle) * radius;
                 
                 const dx = targetX - node.x;
                 const dy = targetY - node.y;
                 node.vx += dx * 0.05;
                 node.vy += dy * 0.05;
             });

        } else {
            // Force Directed (Default)
            
            // 1. Repulsion
            for (let i = 0; i < nodes.length; i++) {
                const nodeA = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const nodeB = nodes[j];
                    const dx = nodeA.x - nodeB.x;
                    const dy = nodeA.y - nodeB.y;
                    const distSq = dx * dx + dy * dy;
                    
                    const dist = Math.sqrt(distSq) + 0.1;
                    
                    const force = REPULSION_FORCE / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    nodeA.vx += fx;
                    nodeA.vy += fy;
                    nodeB.vx -= fx;
                    nodeB.vy -= fy;
                }
            }

            // 2. Attraction
            edges.forEach(edge => {
                const source = nodeMap.get(edge.source);
                const target = nodeMap.get(edge.target);
                if (!source || !target) return;

                const dx = source.x - target.x;
                const dy = source.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                const force = (dist - SPRING_LENGTH) * SPRING_FORCE;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                source.vx -= fx;
                source.vy -= fy;
                target.vx += fx;
                target.vy += fy;
            });
        }

        // 3. Center Gravity & Damping (Apply to all modes to stabilize)
        nodes.forEach(node => {
            node.vx -= node.x * CENTER_FORCE;
            node.vy -= node.y * CENTER_FORCE;

            node.vx *= DAMPING;
            node.vy *= DAMPING;
            
            // Limit Speed
            const vMag = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
            if (vMag > 50) {
                node.vx = (node.vx / vMag) * 50;
                node.vy = (node.vy / vMag) * 50;
            }
            if (vMag < 0.1) {
               node.vx = 0; node.vy = 0;
            }

            node.x += node.vx;
            node.y += node.vy;
        });

        // Compute total kinetic energy
        let totalEnergy = 0;
        nodes.forEach(n => {
            totalEnergy += (n.vx * n.vx + n.vy * n.vy);
        });

        // Post back updated positions
        self.postMessage({ type: 'TICK', nodes, totalEnergy });
    }
};

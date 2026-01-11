import React, { useRef, useEffect, useState, useMemo } from 'react';
import styles from '../styles/components/CanvasNetwork.module.css';
import { getVisibleNodes, getVisibleEdges, getLODSettings, SpatialHash } from '../utils/viewportCulling';
import { soundManager } from '../utils/SoundManager';
import { config } from '../config/env';
import { THEMES } from '../config/themes';

const CanvasNetwork = React.memo(({
  data,
  hoveredNode,
  setHoveredNode,
  setMousePos,
  animating,
  cameraTarget,
  canvasRef: externalCanvasRef,
  onNodeClick,
  viewSettings = { renderLabels: true, renderGlow: true, renderPulses: true, theme: 'default' },
  searchState = { term: '', matchedIds: [] },
  hiddenClusters = new Set(),
  maxYear = 2050
}) => {
  const internalCanvasRef = useRef(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false); // For cursor style only
  const isPanningRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 }); // For panning
  const dragRef = useRef(null); // For node dragging
  
  const timeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const spatialHashRef = useRef(new SpatialHash(100));
  
  // Visual effects state
  // Visual effects state
  // Visual effects state
  const pulsesRef = useRef([]); 
  const workerRef = useRef(null);
  const simulationActiveRef = useRef(true);

  
  // Search Filtering Logic (MOVED TO TOP LEVEL)
  const matchedSet = useMemo(() => new Set(searchState.matchedIds), [searchState]);
  const isSearchActive = searchState && searchState.term && searchState.term.length > 0;


  // Filter valid nodes and edges respecting hiddenClusters AND Year
  const processedNodes = useMemo(() => {
    return data.nodes.filter(n => {
        // 1. Cluster check
        if (hiddenClusters.has(n.cluster)) return false;
        // 2. Year check (if node has year, it must be <= maxYear)
        // If node has NO year, assume it's timeless/always visible? Or hide? 
        // Let's assume most have years. If not, default to visible.
        if (n.year !== undefined && n.year > maxYear) return false;
        return true;
    }).map(n => ({
      ...n,
      originalX: n.x,
      originalY: n.y,
      vx: 0,
      vy: 0
    }));
  }, [data.nodes, hiddenClusters]);

  // Build spatial hash from visible nodes
  useEffect(() => {
      spatialHashRef.current.build(processedNodes);
  }, [processedNodes]);

  // Create node map for O(1) lookups
  const nodeMap = useMemo(() => {
    return new Map(processedNodes.map(n => [n.id, n]));
  }, [processedNodes]);

  const processedEdges = useMemo(() => {
    return data.edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));
  }, [data.edges, nodeMap]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({ width, height });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const targetRef = useRef(cameraTarget);

  // Sync target with prop updates (e.g. from search or reset)
  useEffect(() => {
    targetRef.current = cameraTarget;
  }, [cameraTarget]);

  // Smooth camera interpolation
  useEffect(() => {
    const interval = setInterval(() => {
      setCamera(prev => {
        // If we are close enough, snap to target to save calculation? 
        // For now, keep continuous for smoothness
        const dx = targetRef.current.x - prev.x;
        const dy = targetRef.current.y - prev.y;
        
        return {
          x: prev.x + dx * 0.1,
          y: prev.y + dy * 0.1
        };
      });
    }, 16);

    return () => clearInterval(interval);
  }, []);

  // Screen to world coordinates
  const screenToWorld = (sx, sy) => {
    return {
      x: (sx - dimensions.width / 2 - camera.x) / zoom,
      y: (sy - dimensions.height / 2 - camera.y) / zoom
    };
  };

  // Mouse move handler
  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setMousePos({ x: e.clientX, y: e.clientY });

    // Handle Node Dragging (Synchronous)
    if (dragRef.current) {
        const world = screenToWorld(mouseX, mouseY);
        dragRef.current.node.x = world.x;
        dragRef.current.node.y = world.y;
        dragRef.current.node.vx = 0; 
        dragRef.current.node.vy = 0;
        return;
    }

    // Handle Canvas Panning (Synchronous Ref Check)
    if (isPanningRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      // Update camera functionally to avoid stale state closure
      setCamera(prev => {
          const newCam = { x: prev.x + dx, y: prev.y + dy };
          targetRef.current = newCam; // Sync target
          return newCam;
      });
      
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const world = screenToWorld(mouseX, mouseY);
    let found = null;

    // Use spatial hash for query optimization
    for (const node of processedNodes) {
      const dx = world.x - node.x;
      const dy = world.y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) < node.size * 1.5) { 
        found = node;
        break;
      }
    }

    if (found?.id !== hoveredNode?.id && !isPanningRef.current) {
      setHoveredNode(found);
      if (found) {
        soundManager.playHover();
      }
    }
  };

  // Mouse handlers
  const handleMouseDown = (e) => {
    // 1. Check for Node Click
    if (hoveredNode) {
      const currentTheme = THEMES[viewSettings.theme] || THEMES.default;
      
      if (onNodeClick) onNodeClick(hoveredNode);

      if (currentTheme.draggable !== false) {
          soundManager.playClick();
          setIsDragging(true); // Update Cursor
          hoveredNode.isDragging = true;
          
          const rect = canvasRef.current.getBoundingClientRect();
          const x = (e.clientX - rect.left - dimensions.width / 2 - camera.x) / zoom;
          const y = (e.clientY - rect.top - dimensions.height / 2 - camera.y) / zoom;
          
          // Signal Propagation Animation (Send pulses to connected nodes)
          processedEdges.forEach(edge => {
             let neighborId = null;
             // Check if this edge is connected to the clicked node
             if (edge.source === hoveredNode.id) neighborId = edge.target;
             else if (edge.target === hoveredNode.id) neighborId = edge.source;
             
             if (neighborId) {
                 const neighbor = nodeMap.get(neighborId);
                 const edgeSourceNode = nodeMap.get(edge.source); // CRITICAL: Defines the curve phase

                 if (neighbor && edgeSourceNode) {
                     pulsesRef.current.push({
                         source: hoveredNode, 
                         target: neighbor,
                         edgeSource: edgeSourceNode, // Pass this to render loop
                         startTime: timeRef.current,
                         color: currentTheme.nodeBase
                     });
                 }
             }
          });

          dragRef.current = { node: hoveredNode, startX: x, startY: y };
          // Do NOT set isPanningRef here
      }
    } else {
      // 2. Background Click -> Pan Start
      setIsDragging(true); // Update Cursor
      isPanningRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    // Clear Node Drag
    if (hoveredNode) hoveredNode.isDragging = false;
    if (dragRef.current?.node) dragRef.current.node.isDragging = false;
    dragRef.current = null;
    
    // Clear Pan
    isPanningRef.current = false;
    
    // Update Cursor
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.25, Math.min(3, prev * (e.deltaY > 0 ? 0.92 : 1.08))));
  };

    // --- WORKER INTEGRATION ---


    // Initialize Worker
    useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/physics.worker.js', import.meta.url), { type: 'module' });
        
        workerRef.current.onmessage = (e) => {
            if (e.data.type === 'TICK') {
                const { nodes: updatedNodes, totalEnergy } = e.data;
                
                // Sync positions
                updatedNodes.forEach(uNode => {
                    const localNode = nodeMap.get(uNode.id);
                    if (localNode) {
                        localNode.x = uNode.x;
                        localNode.y = uNode.y;
                    }
                });

                // Auto-sleep if stable
                if (totalEnergy < 0.1 && simulationActiveRef.current) {
                    simulationActiveRef.current = false;
                }
            }
        };

        return () => {
            workerRef.current.terminate();
        };
    }, []);

    // Send data to worker when it changes
    useEffect(() => {
        simulationActiveRef.current = true; // Wake up on data change
        if (workerRef.current && processedNodes.length > 0) {
            const nodesPayload = processedNodes.map(n => ({
                id: n.id, x: n.x, y: n.y, vx: n.vx || 0, vy: n.vy || 0
            }));
            const edgesPayload = processedEdges.map(e => ({
                source: typeof e.source === 'object' ? e.source.id : e.source,
                target: typeof e.target === 'object' ? e.target.id : e.target
            }));
            
            workerRef.current.postMessage({ 
                type: 'UPDATE_DATA', 
                payload: { nodes: nodesPayload, edges: edgesPayload } 
            });
        }
    }, [processedNodes, processedEdges]);

    // Render Loop
    useEffect(() => {
      const animate = () => {
        // Trigger stepping in worker ONLY if active
        // Also wake up if dragging
        if (isDragging) simulationActiveRef.current = true;

        const currentTheme = THEMES[viewSettings.theme] || THEMES.default;
        const layoutMode = currentTheme.layout || 'force';
        const clusterKeys = Object.keys(data.clusters);

        if (animating && workerRef.current && simulationActiveRef.current) {
             workerRef.current.postMessage({ 
                 type: 'STEP', 
                 payload: { 
                     width: dimensions.width, 
                     height: dimensions.height,
                     layoutMode,
                     clusterKeys
                 } 
             });
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Ensure canvas size
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            // Updating state here causes infinite loop: setDimensions({ width: rect.width, height: rect.height });
        }

        // Clear canvas
        ctx.fillStyle = currentTheme.background;
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);
        
        ctx.save();
        ctx.translate(dimensions.width / 2 + camera.x, dimensions.height / 2 + camera.y);
        ctx.scale(zoom, zoom);

        const lod = getLODSettings(zoom);
        const renderLabels = viewSettings.renderLabels; 
        const renderGlow = viewSettings.renderGlow && currentTheme.glow; 
        
        const getOpacity = (id) => {
            if (!isSearchActive) return 1;
            if (matchedSet.has(id)) return 1;
            return 0.1;
        };

        // Draw Edges
        processedEdges.forEach(edge => {
            const source = nodeMap.get(typeof edge.source === 'object' ? edge.source.id : edge.source);
            const target = nodeMap.get(typeof edge.target === 'object' ? edge.target.id : edge.target);
            
            if (!source || !target) return;
            
            const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
            const alphaS = getOpacity(source.id);
            const alphaT = getOpacity(target.id);
            const edgeAlpha = Math.min(alphaS, alphaT) * 0.4;
            
            // Use theme color
            const sColor = currentTheme.edgeBase;
            const tColor = currentTheme.edgeBase;
            
            gradient.addColorStop(0, sColor + Math.floor(255 * edgeAlpha).toString(16).padStart(2, '0'));
            gradient.addColorStop(1, tColor + Math.floor(255 * edgeAlpha).toString(16).padStart(2, '0'));
            
            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = (edge.type === 'backlink' ? 1.5 : 1) * lod.edgeWidth;

            if (edge.type === 'backlink') {
                ctx.setLineDash([4, 4]); 
            } else if (edge.type === 'accelerates') {
                ctx.setLineDash([2, 6]); 
            } else if (edge.type === 'inhibits') {
                ctx.setLineDash([10, 2]); 
            } else {
                ctx.setLineDash([]); 
            }

            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // Draw Nodes
        processedNodes.forEach(node => {
          const liveNode = nodeMap.get(node.id); 
          if (!liveNode) return;
          
          const x = liveNode.x;
          const y = liveNode.y;
          const radius = node.size * lod.nodeScale; 
          const opacity = getOpacity(node.id);
          
          if (opacity < 0.05) return;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          
          const clusterColor = data.clusters[node.cluster]?.color || '#888';
          ctx.fillStyle = clusterColor;
          ctx.globalAlpha = opacity;
          ctx.fill();
          
          // Glow
          if (renderGlow && lod.renderGlow && opacity > 0.5) {
             const glowSize = (hoveredNode && hoveredNode.id === node.id) ? 20 : 0;
             if (glowSize > 0) {
                 ctx.shadowBlur = 15; 
                 ctx.shadowColor = clusterColor;
                 ctx.stroke(); 
                 ctx.shadowBlur = 0;
             }
          }
          
          // Label
          if (renderLabels && lod.renderLabels && opacity > 0.2) {
             const fontSize = Math.max(10, radius); 
             ctx.font = `${fontSize}px "JetBrains Mono"`;
             ctx.fillStyle = currentTheme.text;
             ctx.fillText(node.label, x, y + radius + 12);
          }
          ctx.globalAlpha = 1;
        });

        ctx.restore();
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
      return () => {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

    }, [dimensions, camera, zoom, animating, processedNodes, processedEdges, nodeMap, data.clusters, hoveredNode, matchedSet, isSearchActive]);

  return (
    <div className={styles.canvasContainer}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : (hoveredNode ? 'pointer' : 'grab') }}
      />
    </div>
  );
});

CanvasNetwork.displayName = 'CanvasNetwork';

export default CanvasNetwork;

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import styles from '../styles/components/CanvasNetwork.module.css';
import { getLODSettings, SpatialHash } from '../utils/viewportCulling';
import { soundManager } from '../utils/SoundManager';
import { THEMES } from '../config/themes';
import { useGestureIntents } from '../hooks/useGestureIntents';
import { INTENTS } from '../gesture/types.js';
import { getController } from '../config/featureRegistry';

const CanvasNetwork = React.memo(({
  data,
  hoveredNode,
  setHoveredNode,
  setMousePos,
  animating,
  cameraTarget,
  canvasRef: externalCanvasRef,
  onNodeClick,
  onNodesUpdate,
  onCameraChange,
  onZoomChange,
  viewSettings = { renderLabels: true, renderGlow: true, renderPulses: true, theme: 'default' },
  searchState = { term: '', matchedIds: [] },
  hiddenClusters = new Set(),
  maxYear = 2050,
  gesturesEnabled = false
}) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const cameraPosRef = useRef({ x: 0, y: 0 }); // Use ref for smooth, non-reactive camera updates
  const [zoom, setZoom] = useState(0.1);
  const [energy, setEnergy] = useState(100); // Physics "heat" for cooling simulation

  // Screen to world coordinates helper
  const screenToWorld = useCallback((sx, sy) => {
    return {
      x: (sx - (dimensions?.width || 0) / 2 - cameraPosRef.current.x) / zoom,
      y: (sy - (dimensions?.height || 0) / 2 - cameraPosRef.current.y) / zoom
    };
  }, [dimensions, zoom]);

  const internalCanvasRef = useRef(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;

  const [isDragging, setIsDragging] = useState(false);
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [ripples, setRipples] = useState([]);
  
  // Dynamic LOD adjustment
  const lod = useMemo(() => {
    const baseLOD = getLODSettings(zoom);
    if (!isGestureActive) return baseLOD;
    
    return {
        ...baseLOD,
        renderEdges: zoom > 0.4,
        renderGlow: false,
        maxEdges: Math.min(baseLOD.maxEdges || 1000, 200),
        edgeWidth: (baseLOD.edgeWidth || 1) * 0.8
    };
  }, [zoom, isGestureActive]);

  // --- DATA PROCESSING (UPFRONT) ---
  
  // Filter valid nodes and edges respecting hiddenClusters AND Year
  const processedNodes = useMemo(() => {
    return data.nodes.filter(n => {
        if (hiddenClusters.has(n.cluster)) return false;
        if (n.year !== undefined && n.year > maxYear) return false;
        return true;
    }).map(n => ({
      ...n,
      originalX: n.x,
      originalY: n.y,
      vx: 0,
      vy: 0
    }));
  }, [data.nodes, hiddenClusters, maxYear]);

  // Create node map for O(1) lookups
  const nodeMap = useMemo(() => {
    return new Map(processedNodes.map(n => [n.id, n]));
  }, [processedNodes]);

  const processedEdges = useMemo(() => {
    return data.edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));
  }, [data.edges, nodeMap]);

  // GALACTIC LAYOUT: Fixed Orchestration of Clusters and Departments
  const layoutCalculations = useMemo(() => {
    const clusterMap = {};
    const keys = Object.keys(data.clusters);
    const galacticRadius = 3000;
    const deptRadius = 600;

    keys.forEach((cKey, i) => {
      const cAngle = (i / keys.length) * Math.PI * 2;
      const cX = Math.cos(cAngle) * galacticRadius;
      const cY = Math.sin(cAngle) * galacticRadius;
      
      const depts = data.clusters[cKey].departments || {};
      const dKeys = Object.keys(depts);
      const deptTargets = {};
      
      dKeys.forEach((dKey, j) => {
        const dAngle = (j / dKeys.length) * Math.PI * 2;
        deptTargets[dKey] = {
            x: cX + Math.cos(dAngle) * deptRadius,
            y: cY + Math.sin(dAngle) * deptRadius
        };
      });

      clusterMap[cKey] = {
        x: cX,
        y: cY,
        departments: deptTargets
      };
    });
    return clusterMap;
  }, [data.clusters]);

  // HIERARCHICAL AGGREGATION
  const hierarchicalData = useMemo(() => {
    const clusters = new Map();
    
    processedNodes.forEach(node => {
      if (!clusters.has(node.cluster)) {
        clusters.set(node.cluster, {
          id: node.cluster,
          x: 0, y: 0, count: 0, 
          label: data.clusters[node.cluster]?.label || node.cluster,
          color: data.clusters[node.cluster]?.color || '#ffffff',
          departments: new Map(),
          targetX: layoutCalculations[node.cluster]?.x || 0,
          targetY: layoutCalculations[node.cluster]?.y || 0
        });
      }
      const c = clusters.get(node.cluster);
      c.x += node.x;
      c.y += node.y;
      c.count++;
      
      const subId = node.subcluster || 'general';
      if (!c.departments.has(subId)) {
        c.departments.set(subId, {
          id: `${node.cluster}-${subId}`,
          label: data.clusters[node.cluster]?.departments?.[subId] || subId,
          x: 0, y: 0, count: 0, clusterId: node.cluster,
          targetX: layoutCalculations[node.cluster]?.departments?.[subId]?.x || c.targetX,
          targetY: layoutCalculations[node.cluster]?.departments?.[subId]?.y || c.targetY
        });
      }
      const d = c.departments.get(subId);
      d.x += node.x;
      d.y += node.y;
      d.count++;
    });
    
    // Finalize
    const clusterNodes = [];
    const departmentNodes = [];
    clusters.forEach(c => {
      c.x /= c.count; c.y /= c.count;
      clusterNodes.push(c);
      c.departments.forEach(d => {
        d.x /= d.count; d.y /= d.count;
        departmentNodes.push(d);
      });
    });
    
    return { clusterNodes, departmentNodes };
  }, [processedNodes, data.clusters, layoutCalculations]);

  // Search Filtering Logic
  const matchedSet = useMemo(() => new Set(searchState.matchedIds), [searchState]);
  const isSearchActive = searchState && searchState.term && searchState.term.length > 0;

  const targetRef = useRef(cameraTarget);
  const isPanningRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 }); // For panning
  const dragRef = useRef(null); // For node dragging
  
  // Mobile Interaction Refs
  const pinchStartDistRef = useRef(0);
  const initialZoomRef = useRef(1);
  const lastTouchTimeRef = useRef(0);
  
  const timeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const spatialHashRef = useRef(new SpatialHash(100));
  
  // Visual effects state
  const pulsesRef = useRef([]); 
  
  // Gesture intent handlers - subscribe to high-level intents only
  useGestureIntents({
    ROTATE: (event) => {
      cameraPosRef.current.x += event.payload.deltaX * 50;
      cameraPosRef.current.y += event.payload.deltaY * 25;
      targetRef.current = { ...cameraPosRef.current };
    },
    ZOOM: (event) => {
      setZoom(prev => Math.max(0.05, Math.min(4, prev * event.payload.scale)));
    },
    PAN: (event) => {
      cameraPosRef.current.x += event.payload.deltaX * 100;
      cameraPosRef.current.y += event.payload.deltaY * 100;
      targetRef.current = { ...cameraPosRef.current };
    },
    SELECT: (event) => {
      if (event.payload.grabbed) {
          const px = event.payload.x * dimensions.width;
          const py = event.payload.y * dimensions.height;
          const world = screenToWorld(px, py);
          let found = null;
          for (const node of processedNodes || []) {
            const dx = world.x - node.x;
            const dy = world.y - node.y;
            if (Math.sqrt(dx * dx + dy * dy) < node.size * 2.5) { 
              found = node;
              break;
            }
          }
          if (found && onNodeClick) {
            onNodeClick(found);
            soundManager.playClick();
          }
      }
    },
    '*': (event) => {
      if (event.intent !== INTENTS.IDLE) {
        setIsGestureActive(true);
        // Clear activity after a timeout if no new intents arrive
        setTimeout(() => setIsGestureActive(false), 200);
        
        // Create ripple for specific interaction intents
        if (event.intent === INTENTS.SELECT || event.intent === INTENTS.CLUSTER_EXPAND) {
            const rx = event.payload.x * dimensions.width;
            const ry = event.payload.y * dimensions.height;
            const world = screenToWorld(rx, ry);
            setRipples(prev => [...prev, { x: world.x, y: world.y, startTime: performance.now(), id: Math.random() }]);
        }
      }
    }
  });

  // Register this canvas as the platform for the gesture adapter
  useEffect(() => {
    if (!gesturesEnabled) return;

    const adapter = getController('inventAdapter');
    if (adapter && adapter.setPlatform) {
      adapter.setPlatform({
        pan: (dx, dy) => {
          cameraPosRef.current.x += dx * 100;
          cameraPosRef.current.y += dy * 100;
          targetRef.current = { ...cameraPosRef.current };
        },
        zoom: (scale) => {
          setZoom(prev => Math.max(0.25, Math.min(3, prev * scale)));
        },
        rotate: (delta) => {
          cameraPosRef.current.x += delta * 50;
          targetRef.current = { ...cameraPosRef.current };
        },
        hoverNode: (x, y) => {
           const px = x * dimensions.width;
           const py = y * dimensions.height;
           const world = screenToWorld(px, py);
           let found = null;
           for (const node of processedNodes || []) {
             const dx = world.x - node.x;
             const dy = world.y - node.y;
             if (Math.sqrt(dx * dx + dy * dy) < node.size * 2.5) { 
               found = node;
               break;
             }
           }
           setHoveredNode(found?.id || null);
        },
        toggleDetailPanel: () => {
          if (hoveredNode && onNodeClick) {
            const node = (data.nodes || []).find(n => n.id === hoveredNode);
            if (node) onNodeClick(node);
          }
        }
      });
    }

    return () => {
      if (adapter && adapter.setPlatform) adapter.setPlatform(null);
    };
  }, [gesturesEnabled, dimensions, processedNodes, hoveredNode, onNodeClick, data.nodes, screenToWorld, setHoveredNode]);

  // Build spatial hash from visible nodes
  useEffect(() => {
    spatialHashRef.current.build(processedNodes);
  }, [processedNodes]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({ width, height });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Phase 15: Start Cinematic Ambience
    soundManager.startAmbience();

    return () => {
        window.removeEventListener('resize', handleResize);
        soundManager.stopAmbience();
    };
  }, []);

  // Sync target with prop updates (e.g. from search or reset)
  useEffect(() => {
    targetRef.current = cameraTarget;
  }, [cameraTarget]);


  // Broadcast camera changes incrementally if parent really needs it (Throttled via frequency check)
  useEffect(() => {
    // We skip this to avoid infinite render loops when using Ref-based camera
  }, [onCameraChange]);

  // Broadcast zoom changes
  useEffect(() => {
    if (onZoomChange) {
      onZoomChange(zoom);
    }
    
    // Phase 10: Sync with gesture controller for zoom-aware sensitivity
    import('../config/featureRegistry').then(({ syncGestureZoom }) => {
      syncGestureZoom(zoom);
    });

    // Phase 15: Sync with SoundManager for ambience pitch modulation
    soundManager.updateAmbience(zoom);
  }, [zoom, onZoomChange]);


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
      
      // Update camera ref directly to avoid stale state closure
      cameraPosRef.current.x += dx;
      cameraPosRef.current.y += dy;
      targetRef.current = { ...cameraPosRef.current }; // Sync target
      
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
  const handleMouseDown = useCallback((e) => {
    // 1. Check for Node Click
    if (hoveredNode) {
      const currentTheme = THEMES[viewSettings.theme] || THEMES.default;
      
      if (onNodeClick) onNodeClick(hoveredNode);

      if (currentTheme.draggable !== false) {
          soundManager.playClick();
          setIsDragging(true); // Update Cursor
          hoveredNode.isDragging = true;
          
          const rect = canvasRef.current.getBoundingClientRect();
          const x = (e.clientX - rect.left - dimensions.width / 2 - cameraPosRef.current.x) / zoom;
          const y = (e.clientY - rect.top - dimensions.height / 2 - cameraPosRef.current.y) / zoom;
          
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
  }, [hoveredNode, viewSettings, onNodeClick, canvasRef, dimensions, zoom, processedEdges, nodeMap]);

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

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.25, Math.min(3, prev * (e.deltaY > 0 ? 0.92 : 1.08))));
  }, [setZoom]);

  // --- TOUCH HANDLERS (MOBILE) ---

  const getTouchDist = (touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const tx = touch.clientX - rect.left;
      const ty = touch.clientY - rect.top;

      // Handle Node Hover/Highlight on Tap
      const world = screenToWorld(tx, ty);
      let found = null;
      for (const node of processedNodes) {
        const dx = world.x - node.x;
        const dy = world.y - node.y;
        if (Math.sqrt(dx * dx + dy * dy) < node.size * 2) {
          found = node;
          break;
        }
      }

      if (found) {
        setHoveredNode(found);
        // Double tap or specific logic for selection
        const now = Date.now();
        if (now - lastTouchTimeRef.current < 300) {
            handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY }); // Trigger selection logic
        }
        lastTouchTimeRef.current = now;
      } else {
        setHoveredNode(null);
        isPanningRef.current = true;
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      }
    } else if (e.touches.length === 2) {
      isPanningRef.current = false;
      pinchStartDistRef.current = getTouchDist(e.touches);
      initialZoomRef.current = zoom;
    }
  }, [canvasRef, screenToWorld, processedNodes, setHoveredNode, handleMouseDown, zoom]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 1 && isPanningRef.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        
        cameraPosRef.current.x += dx;
        cameraPosRef.current.y += dy;
        targetRef.current = { ...cameraPosRef.current };
        
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
        const currentDist = getTouchDist(e.touches);
        if (pinchStartDistRef.current > 0) {
            const scale = currentDist / pinchStartDistRef.current;
            setZoom(Math.max(0.15, Math.min(4, initialZoomRef.current * scale)));
        }
    }
  }, [setZoom]);

  const handleTouchEnd = useCallback(() => {
    isPanningRef.current = false;
    pinchStartDistRef.current = 0;
  }, []);

  // Handle Wheel and Touch manually to support preventDefault (non-passive)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      handleWheel(e);
    };

    const onTouchStart = (e) => {
      // Prevent default on multi-touch to stop browser zoom/gestures
      if (e.touches.length > 1) e.preventDefault();
      handleTouchStart(e);
    };

    const onTouchMove = (e) => {
      // Prevent default to stop browser scroll/bounce
      e.preventDefault();
      handleTouchMove(e);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, canvasRef]);

  // Pre-process edges into adjacency list for $O(visible\_nodes)$ edge lookup
  const nodeEdges = useMemo(() => {
    const map = new Map();
    processedEdges.forEach(e => {
      if (!map.has(e.source)) map.set(e.source, []);
      map.get(e.source).push(e);
    });
    return map;
  }, [processedEdges]);

  // Animation and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Performance optimization: disable alpha for background
    const dpr = window.devicePixelRatio || 1;

    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = dimensions.width + 'px';
    canvas.style.height = dimensions.height + 'px';
    ctx.scale(dpr, dpr);

    const animate = () => {
      const now = performance.now();
      
      // Simulation Cooling
      if (animating && energy > 1) {
        setEnergy(prev => prev * 0.99);
      }
      
      if (animating) {
        timeRef.current += 0.006;
      }

      const time = timeRef.current;

      // Smooth camera interpolation via Ref (No React state update)
      const camDx = targetRef.current.x - cameraPosRef.current.x;
      const camDy = targetRef.current.y - cameraPosRef.current.y;
      if (Math.abs(camDx) > 0.05 || Math.abs(camDy) > 0.05) {
        cameraPosRef.current.x += camDx * 0.25;
        cameraPosRef.current.y += camDy * 0.25;
        if (energy < 40) setEnergy(40);
      }

      const currentTheme = THEMES[viewSettings.theme] || THEMES.default;
      const layoutMode = currentTheme.layout || 'force';

      // 1. SPATIAL HASH BUILDING (Only if animating or energy > 0.5)
      const shouldSimulate = animating && energy > 0.5;
      spatialHashRef.current.build(processedNodes);

      // 2. VIEWPORT CULLING (Ultra-Fast via Spatial Hash)
      const margin = 200 / zoom;
      const vLeft = (-cameraPosRef.current.x - dimensions.width / 2) / zoom - margin;
      const vRight = (dimensions.width / 2 - cameraPosRef.current.x) / zoom + margin;
      const vTop = (-cameraPosRef.current.y - dimensions.height / 2) / zoom - margin;
      const vBottom = (dimensions.height / 2 - cameraPosRef.current.y) / zoom + margin;
      
      const visibleNodes = spatialHashRef.current.queryRange(vLeft, vTop, vRight, vBottom);

      // 3. PHYSICS
      if (shouldSimulate) {
        if (layoutMode === 'force') {
            processedNodes.forEach(a => {
              if (a.isDragging) return;
              const neighbors = spatialHashRef.current.query(a.x, a.y, 100);
              neighbors.forEach(b => {
                if (a === b) return;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distSq = dx * dx + dy * dy + 1;
                if (distSq < 10000) {
                    const dist = Math.sqrt(distSq);
                    a.vx += (dx / dist) * (600 / distSq);
                    a.vy += (dy / dist) * (600 / distSq);
                }
              });
            });
            
            processedEdges.forEach(edge => {
              const s = nodeMap.get(edge.source);
              const t = nodeMap.get(edge.target);
              if (!s || !t) return;
              const dx = t.x - s.x;
              const dy = t.y - s.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (dist - 120) * 0.04;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              if (!s.isDragging) { s.vx += fx; s.vy += fy; }
              if (!t.isDragging) { t.vx -= fx; t.vy -= fy; }
            });
            
            processedNodes.forEach(node => {
               if (node.isDragging) return;
               const clusterLayout = layoutCalculations[node.cluster];
               const target = clusterLayout?.departments?.[node.subcluster] || clusterLayout || { x: 0, y: 0 };
               
               // Stronger, snappier gravity for "gaming engine" feel
               node.vx -= (node.x - target.x) * 0.008;
               node.vy -= (node.y - target.y) * 0.008;
               
               node.vx *= 0.75; // More damping for stability
               node.vy *= 0.75;
               node.x += node.vx;
               node.y += node.vy;
            });
        }
      }

      // 4. RENDERING BATCHES
      ctx.fillStyle = currentTheme.background;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      
      ctx.save();
      ctx.translate(dimensions.width / 2 + cameraPosRef.current.x, dimensions.height / 2 + cameraPosRef.current.y);
      ctx.scale(zoom, zoom);

      const getOpacity = (id) => {
          if (!isSearchActive) return 1;
          if (matchedSet.has(id)) return 1;
          return 0.1;
      };

      // --- FLATTENED RENDERING ---
      // We no longer hide nodes/edges based on zoom.
      const macroAlpha = 0; // Hide hierarchical clusters
      const midAlpha = 0;   // Hide hierarchical departments
      const microAlpha = 1; // Always show all nodes/edges

      // 1. Render Macro Clusters
      if (macroAlpha > 0.01) {
        // Sort clusters to ensure consistent drawing order/collision handling
        const sortedClusters = [...hierarchicalData.clusterNodes].sort((a,b) => a.id.localeCompare(b.id));
        
        // Final position for each label to prevent overlap
        const labelPositions = sortedClusters.map(c => ({
            id: c.id,
            x: c.targetX * 0.7 + c.x * 0.3, // Blend target and actual for smooth leading
            y: c.targetY * 0.7 + c.y * 0.3,
            label: c.label,
            count: c.count,
            color: c.color,
            offsetY: 0
        }));

        // Simple vertical stacking for overlapping labels
        for (let i = 0; i < labelPositions.length; i++) {
            for (let j = i + 1; j < labelPositions.length; j++) {
                const a = labelPositions[i];
                const b = labelPositions[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distSq = dx * dx + dy * dy;
                const threshold = 180 / zoom; // Large threshold for macro view
                if (distSq < threshold * threshold) {
                    // Offset the one that is "below" or smaller ID
                    if (a.y < b.y) b.offsetY += 40 / zoom;
                    else a.offsetY += 40 / zoom;
                }
            }
        }

        labelPositions.forEach(c => {
          const size = 70 / zoom;
          const opacity = macroAlpha * 0.8;
          const drawY = c.y + c.offsetY;
          
          // Glow
          const grad = ctx.createRadialGradient(c.x, drawY, 0, c.x, drawY, size * 2.5);
          grad.addColorStop(0, c.color + Math.floor(opacity * 255).toString(16).padStart(2, '0'));
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(c.x, drawY, size * 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Label
          ctx.font = `bold ${24 / zoom}px ${currentTheme.font}`;
          ctx.fillStyle = currentTheme.text + Math.floor(opacity * 255).toString(16).padStart(2, '0');
          ctx.textAlign = 'center';
          ctx.fillText(c.label.toUpperCase(), c.x, drawY);
          ctx.font = `${14 / zoom}px ${currentTheme.font}`;
          ctx.fillText(`${c.count} INNOVATIONS`, c.x, drawY + 30 / zoom);
        });
      }

      // 2. Render Mid Departments
      if (midAlpha > 0.01) {
        hierarchicalData.departmentNodes.forEach(d => {
          const color = data.clusters[d.clusterId]?.color || '#ffffff';
          const size = 30 / zoom;
          const opacity = midAlpha * 0.7;
          
          // Use Target position for stable interaction
          const drawX = d.targetX;
          const drawY = d.targetY;

          ctx.beginPath();
          ctx.fillStyle = color + Math.floor(opacity * 100).toString(16).padStart(2, '0');
          ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = `${14 / zoom}px ${currentTheme.font}`;
          ctx.fillStyle = currentTheme.text + Math.floor(opacity * 255).toString(16).padStart(2, '0');
          ctx.textAlign = 'center';
          ctx.fillText(d.label, drawX, drawY + size + 15 / zoom);
        });
      }

      // 3. Render Micro (Nodes & Edges) - only if visible
      if (microAlpha > 0.01) {
          const globalAlpha = ctx.globalAlpha;
          ctx.globalAlpha = microAlpha;

          // BATCHED EDGE RENDERING
          if (lod.renderEdges) {
            ctx.lineCap = 'round';
            ctx.lineWidth = lod.edgeWidth;
            
            const edgeBatches = new Map();
            visibleNodes.forEach(sourceNode => {
              const edges = nodeEdges.get(sourceNode.id);
              if (!edges) return;
              edges.forEach(edge => {
                const target = nodeMap.get(edge.target);
                if (!target) return;
                const color = data.clusters[sourceNode.cluster]?.color || currentTheme.edgeBase;
                const opacity = Math.min(getOpacity(sourceNode.id), getOpacity(target.id)) * 0.4;
                const hexOpacity = Math.floor(255 * opacity).toString(16).padStart(2, '0');
                const style = color + hexOpacity;
                if (!edgeBatches.has(style)) edgeBatches.set(style, []);
                edgeBatches.get(style).push({ s: sourceNode, t: target });
              });
            });
            
            edgeBatches.forEach((batch, style) => {
              ctx.beginPath();
              ctx.strokeStyle = style;
              batch.forEach(({ s, t }) => {
                if (lod.straightEdges) {
                  ctx.moveTo(s.x, s.y);
                  ctx.lineTo(t.x, t.y);
                } else {
                  const midX = (s.x + t.x) / 2;
                  const midY = (s.y + t.y) / 2;
                  const offset = Math.sin(time * 2 + s.x * 0.05) * 8;
                  ctx.moveTo(s.x, s.y);
                  ctx.quadraticCurveTo(midX + offset, midY + offset, t.x, t.y);
                }
              });
              ctx.stroke();
            });
          }

          // BATCHED NODE RENDERING
          const nodeBatches = new Map();
          const glowBatches = new Map();
          const labels = [];

          visibleNodes.forEach(node => {
            const isHovered = hoveredNode?.id === node.id;
            const opacity = getOpacity(node.id);
            const size = isHovered ? node.size * 1.5 : node.size;
            const color = data.clusters[node.cluster]?.color || currentTheme.nodeBase;
            const hexOpacity = Math.floor(255 * opacity).toString(16).padStart(2, '0');
            const style = color + hexOpacity;

            if (!nodeBatches.has(style)) nodeBatches.set(style, []);
            nodeBatches.get(style).push({ x: node.x, y: node.y, r: size });

            if ((viewSettings.renderGlow && lod.renderGlow && opacity > 0.5) || isHovered) {
              const gSize = size * (isHovered ? 4 : 2);
              if (!glowBatches.has(color)) glowBatches.set(color, []);
              glowBatches.get(color).push({ x: node.x, y: node.y, r: gSize, alpha: isHovered ? 0.3 : 0.15 });
            }

            if ((lod.renderLabels && viewSettings.renderLabels) || isHovered) {
              labels.push({ x: node.x, y: node.y, size, label: node.label, isHovered });
            }
          });

          // Render Glows
          glowBatches.forEach((batch, color) => {
            batch.forEach(g => {
              const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
              grad.addColorStop(0, color + Math.floor(g.alpha * 255).toString(16).padStart(2, '0'));
              grad.addColorStop(1, 'transparent');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
              ctx.fill();
            });
          });

          // Render Node Bodies
          nodeBatches.forEach((batch, style) => {
            ctx.beginPath();
            ctx.fillStyle = style;
            batch.forEach(n => {
              ctx.moveTo(n.x + n.r, n.y);
              ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            });
            ctx.fill();
          });

          // Render Labels
          ctx.textAlign = 'center';
          labels.forEach(l => {
            ctx.font = `${l.isHovered ? '12px' : '9px'} ${currentTheme.font}, monospace`;
            ctx.fillStyle = currentTheme.text;
            ctx.fillText(l.label, l.x, l.y + l.size + 15);
          });

          ctx.globalAlpha = globalAlpha;
      }

      ctx.restore();

      // FPS Debug Info
      if (viewSettings.debugMode) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(10, 10, 220, 100);
        ctx.fillStyle = '#00f2ff';
        ctx.font = '11px monospace';
        const fps = 1000 / (now - lastFrameTime.current);
        ctx.fillText(`FPS: ${fps.toFixed(1)}`, 20, 30);
        ctx.fillText(`Cull: ${visibleNodes.length} / ${processedNodes.length}`, 20, 50);
        ctx.fillText(`Heat: ${energy.toFixed(1)}%`, 20, 70);
        ctx.fillText(`Mode: ${zoom < 0.2 ? 'MACRO' : zoom < 0.6 ? 'DEPT' : 'MICRO'}`, 20, 90);
        lastFrameTime.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const lastFrameTime = { current: performance.now() };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    dimensions, zoom, animating, processedNodes, processedEdges, nodeMap, 
    data.clusters, hoveredNode, matchedSet, isSearchActive, 
    canvasRef, onNodesUpdate, viewSettings, lod, ripples, energy, nodeEdges, hierarchicalData, layoutCalculations
  ]);

  return (
    <div className={styles.canvasContainer}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : (hoveredNode ? 'pointer' : 'grab'), touchAction: 'none' }}
      />
      
      {/* Phase 15: Cinematic HUD Overlay */}
      <div className={`${styles.hudOverlay} ${gesturesEnabled ? styles.hudActive : ''}`} />
    </div>
  );
});

CanvasNetwork.displayName = 'CanvasNetwork';

export default CanvasNetwork;

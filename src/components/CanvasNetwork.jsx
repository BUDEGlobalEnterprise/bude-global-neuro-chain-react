import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import styles from '../styles/components/CanvasNetwork.module.css';
import { getLODSettings, SpatialHash } from '../utils/viewportCulling';
import { soundManager } from '../utils/SoundManager';
import { THEMES } from '../config/themes';
import { useGestureIntents } from '../hooks/useGestureIntents';
import { INTENTS } from '../gesture/types.js';

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
  const internalCanvasRef = useRef(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false); // For cursor style only
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [ripples, setRipples] = useState([]);
  
  // Dynamic LOD adjustment: Simplify rendering when gesture is active
  const dynamicLOD = useMemo(() => {
    const baseLOD = getLODSettings(zoom);
    if (!isGestureActive) return baseLOD;
    
    // Simplify during active gesture to maintain 60FPS
    return {
        ...baseLOD,
        renderEdges: zoom > 0.4, // Hide edges if zoomed out enough and moving
        renderGlow: false,       // Always disable glow during movement
        maxEdges: Math.min(baseLOD.maxEdges || 1000, 200),
        edgeWidth: baseLOD.edgeWidth * 0.8
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

  // Search Filtering Logic
  const matchedSet = useMemo(() => new Set(searchState.matchedIds), [searchState]);
  const isSearchActive = searchState && searchState.term && searchState.term.length > 0;

  const isPanningRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 }); // For panning
  const dragRef = useRef(null); // For node dragging
  const targetRef = useRef(cameraTarget);
  
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
      setCamera(prev => ({
        x: prev.x + event.payload.deltaX * 50,
        y: prev.y + event.payload.deltaY * 25,
      }));
    },
    ZOOM: (event) => {
      setZoom(prev => Math.max(0.25, Math.min(3, prev * event.payload.scale)));
    },
    PAN: (event) => {
      setCamera(prev => {
        const newCam = {
          x: prev.x + event.payload.deltaX * 100,
          y: prev.y + event.payload.deltaY * 100,
        };
        targetRef.current = newCam;
        return newCam;
      });
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

  // Smooth camera interpolation
  useEffect(() => {
    const interval = setInterval(() => {
      setCamera(prev => {
        const dx = targetRef.current.x - prev.x;
        const dy = targetRef.current.y - prev.y;
        
        // Stop updating if close enough to avoid micro-updates
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
             return prev;
        }

        const newCamera = {
          x: prev.x + dx * 0.1,
          y: prev.y + dy * 0.1
        };
        
        return newCamera;
      });
    }, 16);

    return () => clearInterval(interval);
  }, []);

  // Broadcast camera changes to parent
  useEffect(() => {
    if (onCameraChange) {
      onCameraChange(camera);
    }
  }, [camera, onCameraChange]);

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

  // Screen to world coordinates
  const screenToWorld = useCallback((sx, sy) => {
    return {
      x: (sx - dimensions.width / 2 - camera.x) / zoom,
      y: (sy - dimensions.height / 2 - camera.y) / zoom
    };
  }, [dimensions, camera, zoom]);

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
  }, [hoveredNode, viewSettings, onNodeClick, canvasRef, dimensions, camera, zoom, processedEdges, nodeMap]);

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
        
        setCamera(prev => {
            const newCam = { x: prev.x + dx, y: prev.y + dy };
            targetRef.current = newCam;
            return newCam;
        });
        
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
        const currentDist = getTouchDist(e.touches);
        if (pinchStartDistRef.current > 0) {
            const scale = currentDist / pinchStartDistRef.current;
            setZoom(Math.max(0.15, Math.min(4, initialZoomRef.current * scale)));
        }
    }
  }, [setCamera, setZoom]);

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

  // Animation and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = dimensions.width + 'px';
    canvas.style.height = dimensions.height + 'px';
    ctx.scale(dpr, dpr);

    const animate = () => {
      const now = performance.now();
      if (animating) {
        timeRef.current += 0.006;
      }

      const time = timeRef.current;

      // Physics Simulation Parameters
      // Get parameters from current theme or fall back to defaults
      const currentTheme = THEMES[viewSettings.theme] || THEMES.default;
      const layoutMode = currentTheme.layout || 'force';

      const REPULSION = currentTheme.physics?.repulsion || 1000;
      const SPRING_LENGTH = 120;
      const SPRING_STRENGTH = currentTheme.physics?.spring || 0.05;
      const CENTER_GRAVITY = currentTheme.physics?.centerGravity !== undefined ? currentTheme.physics.centerGravity : 0.01;
      const DAMPING = 0.85;

      // Layout Target Calculations (Memoized ideally, but for now in animate loop with checks)
      // Since processedNodes reference is stable unless data changes, we can compute once per theme switch?
      // For simplicity in this loop, we'll compute on the fly or use simple math.
      
      // GRID LAYOUT CONSTANTS
      const GRID_COLS = Math.ceil(Math.sqrt(processedNodes.length * 1.5));
      const GRID_SPACING = 150;
      
      // RADIAL LAYOUT CONSTANTS
      const CLUSTER_KEYS = Object.keys(data.clusters);
      
      // Apply forces
      if (animating) {
        
        if (layoutMode === 'force') {
            // --- FORCE DIRECTED LAYOUT (Standard) ---
            
            // 1. Repulsion
            for (let i = 0; i < processedNodes.length; i++) {
              const a = processedNodes[i];
              for (let j = i + 1; j < processedNodes.length; j++) {
                const b = processedNodes[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distSq = dx * dx + dy * dy + 0.1;
                const dist = Math.sqrt(distSq);
                
                if (dist < 400) {
                    const force = REPULSION / distSq;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (!a.isDragging) { a.vx += fx; a.vy += fy; }
                    if (!b.isDragging) { b.vx -= fx; b.vy -= fy; }
                }
              }
            }
            
             // 2. Attraction
            processedEdges.forEach(edge => {
              const s = nodeMap.get(edge.source);
              const t = nodeMap.get(edge.target);
              if (!s || !t) return;

              const dx = t.x - s.x;
              const dy = t.y - s.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              if (!s.isDragging) { s.vx += fx; s.vy += fy; }
              if (!t.isDragging) { t.vx -= fx; t.vy -= fy; }
            });
            
             // 3. Center Gravity
            processedNodes.forEach(node => {
               if (node.isDragging) return;
               node.vx -= node.x * CENTER_GRAVITY;
               node.vy -= node.y * CENTER_GRAVITY;
            });

        } else if (layoutMode === 'grid') {
            // --- GRID LAYOUT ---
            // Organize by cluster, then alphabetical
            // We need a stable index for each node.
            // Let's use the index in processedNodes which is stable.
            
            processedNodes.forEach((node, index) => {
                if (node.isDragging) return;
                
                const col = index % GRID_COLS;
                const row = Math.floor(index / GRID_COLS);
                
                const targetX = (col - GRID_COLS / 2) * GRID_SPACING;
                const targetY = (row - GRID_COLS / 2) * GRID_SPACING;
                
                // Strong pull to target
                const dx = targetX - node.x;
                const dy = targetY - node.y;
                
                node.vx += dx * 0.05;
                node.vy += dy * 0.05;
            });
             // No repulsion or edge springs in strict grid for clean look

        } else if (layoutMode === 'radial') {
            // --- RADIAL LAYOUT ---
            // Rings based on clusters
            
            processedNodes.forEach(node => {
                if (node.isDragging) return;
                
                const clusterIndex = CLUSTER_KEYS.indexOf(node.cluster);
                // If unknown cluster, put in outer ring
                const ringIndex = clusterIndex === -1 ? CLUSTER_KEYS.length : clusterIndex;
                
                const radius = 200 + (ringIndex * 150);
                // Distribute nodes within cluster evenly? 
                // Simple hash for angle to keep it stable but distributed
                const angle = (node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360) * (Math.PI / 180);
                
                const targetX = Math.cos(angle) * radius;
                const targetY = Math.sin(angle) * radius;
                
                // Pull to ring
                const dx = targetX - node.x;
                const dy = targetY - node.y;
                
                node.vx += dx * 0.05;
                node.vy += dy * 0.05;
            });
        }

        // 4. Update Positions (Velocity Integration)
        processedNodes.forEach(node => {
          if (node.isDragging) {
             node.vx = 0; node.vy = 0;
          } else {
             node.vx *= DAMPING;
             node.vy *= DAMPING;
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
          }
        });

        // Broadcast node positions to parent (for minimap) - throttled
        if (onNodesUpdate && Math.floor(time * 60) % 3 === 0) {
          onNodesUpdate(processedNodes);
        }
      }

      // Clear canvas and apply Theme Background
      ctx.fillStyle = currentTheme.background;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      
      ctx.save();
      ctx.translate(dimensions.width / 2 + camera.x, dimensions.height / 2 + camera.y);
      ctx.scale(zoom, zoom);

      // Get LOD settings based on zoom level and gesture activity
      const lod = dynamicLOD;
      
      // LOGIC FIX: User settings should act as MASTER OVERRIDES.
      // If user checks "Show Labels", they should show (maybe unless WAY zoomed out, but let's trust user).
      // If user unchecks, they must hide.
      const renderLabels = viewSettings.renderLabels; 
      const renderGlow = viewSettings.renderGlow && currentTheme.glow; 
      const renderPulses = viewSettings.renderPulses && currentTheme.pulses;

      // Search Filtering Logic
      // (Moved to top level: matchedSet, isSearchActive)
       
      const getOpacity = (id) => {
          if (!isSearchActive) return 1;
          if (matchedSet.has(id)) return 1;
          return 0.1; // Dimmed
      };

      // Draw edges (with LOD optimization)
      const edgesToRender = lod.renderEdges ? (
        lod.maxEdges && processedEdges.length > lod.maxEdges
          ? processedEdges.slice(0, lod.maxEdges)
          : processedEdges
      ) : [];
      
      edgesToRender.forEach(edge => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return;

        // Performance: Skip backlink/accelerates edges when zoomed out
        if (zoom < 0.8 && (edge.type === 'backlink' || edge.type === 'accelerates')) {
          return;
        }

        // Use theme override color OR cluster color
        // If theme has explicit edgeBase, maybe blend it?
        // Actually, let's keep cluster colors but maybe tint them if theme dictates?
        // For 'void' or 'blueprint', we might want specific edge colors.
        
        let sColor = data.clusters[source.cluster]?.color || currentTheme.edgeBase;
        let tColor = data.clusters[target.cluster]?.color || currentTheme.edgeBase;

        // Special Theme Logic
        if (viewSettings.theme === 'void' || viewSettings.theme === 'minimal') {
            sColor = currentTheme.edgeBase;
            tColor = currentTheme.edgeBase;
        } else if (viewSettings.theme === 'matrix') {
             sColor = currentTheme.edgeBase;
             tColor = currentTheme.edgeBase;
        }

        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        
        let alphaS = getOpacity(source.id);
        let alphaT = getOpacity(target.id);
        
        // If searching, only show edges between two matched nodes fully? 
        // Or if one match? Let's say if BOTH are dimmed, edge is barely visible.
        const edgeAlpha = Math.min(alphaS, alphaT) * 0.4; // Base edge opacity

        gradient.addColorStop(0, sColor + Math.floor(255 * edgeAlpha).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, tColor + Math.floor(255 * edgeAlpha).toString(16).padStart(2, '0'));

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = (edge.type === 'backlink' ? 1.5 : 1) * lod.edgeWidth;

        if (edge.type === 'backlink') {
            ctx.setLineDash([4, 4]); // Dashed
        } else if (edge.type === 'accelerates') {
            ctx.setLineDash([2, 6]); // Dotted (sparse)
        } else if (edge.type === 'inhibits') {
            ctx.setLineDash([10, 2]); // Long dashes
        } else {
            ctx.setLineDash([]); // Solid (forward/default)
        }

        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const offset = Math.sin(time * 2 + source.x * 0.05) * 12;

        ctx.moveTo(source.x, source.y);
        ctx.quadraticCurveTo(midX + offset, midY + offset, target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Continuous Data Flow Animation
        if (renderPulses && animating) {
          const pulsePos = (time * 0.25 + edge.source.charCodeAt(0) * 0.1) % 1;
          const pulseX = source.x + (target.x - source.x) * pulsePos;
          const pulseY = source.y + (target.y - source.y) * pulsePos;

          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = sColor + '80';
          ctx.fill();
        }
      });

      // Draw Interactive Click Pulses (Magic/Signal Mode)
      pulsesRef.current = pulsesRef.current.filter(pulse => {
        const age = time - pulse.startTime;
        const lifeSpan = 1.0; 
        if (age > lifeSpan) return false;

        const progress = age / lifeSpan;
        const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out for fast start, slow arrival
        
        const s = pulse.source;
        const t = pulse.target;
        const es = pulse.edgeSource; // The node that defines the curve phase
        
        // Exact Edge Curve Logic
        const midX = (s.x + t.x) / 2;
        const midY = (s.y + t.y) / 2;
        // Use edgeSource.x for the phase to match the edge's waver exactly
        const offset = Math.sin(time * 2 + es.x * 0.05) * 12; 
        
        const cpX = midX + offset;
        const cpY = midY + offset;
        
        // Get position at 'p' (0 to 1)
        const getPos = (p) => {
             const invT = 1 - p;
             const x = (invT * invT * s.x) + (2 * invT * p * cpX) + (p * p * t.x);
             const y = (invT * invT * s.y) + (2 * invT * p * cpY) + (p * p * t.y);
             return { x, y };
        };

        const pos = getPos(ease);

        // --- OPTIMIZED LIGHTWEIGHT RENDERING ---
        
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; 
        
        // 1. Trail (Single Stroke - Very Fast)
        // Calculate a point slightly behind in time for the tail
        const tailPos = getPos(Math.max(0, ease - 0.15));
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(tailPos.x, tailPos.y);
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = pulse.color + '80'; // 50% opacity
        ctx.stroke();

        // 2. Head & Glow (Simple Arcs - No ShadowBlur)
        // Outer Glow (instead of shadow)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = pulse.color + '33'; // ~20% opacity
        ctx.fill();
        
        // Core (White Hot)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
        return true;
      });

      // Draw nodes
      processedNodes.forEach(node => {
        const isHovered = hoveredNode?.id === node.id;
        const opacity = getOpacity(node.id);
        
        // Skip rendering distinct details if fully filtered out? 
        // No, keep them visible but faint.
        
        const size = isHovered ? node.size * 1.5 : node.size;
        
        let color = data.clusters[node.cluster]?.color || currentTheme.nodeBase;

        // Theme Overrides
        if (viewSettings.theme === 'void' || viewSettings.theme === 'minimal' || viewSettings.theme === 'blueprint') {
            // Use subtle variations or single color
             color = currentTheme.nodeBase;
             // If we really want to distinguish clusters, maybe mix? 
             // For now, strict adherence to theme vibe.
             if (viewSettings.theme === 'blueprint') color = '#ffffff'; 
        }

        // Glow effect
        if ((renderGlow || isHovered) && currentTheme.glow && opacity > 0.5) {
          const glowSize = size * (isHovered ? 4 : 2.5); // Enhanced hover glow size
          const glowAlpha = isHovered ? '60' : '25';     // Enhanced hover glow opacity
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowSize);
          glow.addColorStop(0, color + glowAlpha);
          glow.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        
        // Gradient or Solid based on theme?
        if (viewSettings.theme === 'paper' || viewSettings.theme === 'minimal') {
             ctx.fillStyle = color;
        } else {
            const ng = ctx.createRadialGradient(
              node.x - size * 0.3,
              node.y - size * 0.3,
              0,
              node.x,
              node.y,
              size
            );
            ng.addColorStop(0, color + Math.floor(255 * opacity).toString(16).padStart(2, '0'));
            ng.addColorStop(1, color + Math.floor(180 * opacity).toString(16).padStart(2, '0'));
            ctx.fillStyle = ng;
        }
        
        
        ctx.fill();

        ctx.strokeStyle = color + Math.floor(255 * opacity).toString(16).padStart(2, '0');
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        // Special ring animation for fire and agi
        if ((node.id === 'fire' || node.id === 'agi') && renderPulses) {
          for (let i = 0; i < 3; i++) {
            const phase = (time + i * 0.33) % 1;
            const ringSize = size + phase * size * 2;
            const alpha = (1 - phase) * 0.25;
            ctx.beginPath();
            ctx.arc(node.x, node.y, ringSize, 0, Math.PI * 2);
            ctx.strokeStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Label
        // Only show label if matching search OR if no search and (setting on OR hovered)
        const showLabel = (isSearchActive && opacity === 1) || (!isSearchActive && (renderLabels || isHovered));

        if (showLabel) {
          ctx.font = `${isHovered ? '11px' : '9px'} ${currentTheme.font}, monospace`;
          ctx.textAlign = 'center';
          
          // Clear Labels: Add stroke background
          ctx.strokeStyle = currentTheme.background;
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.strokeText(node.label, node.x, node.y + size + 14);
          
          ctx.fillStyle = currentTheme.text; // Theme text color
          ctx.fillText(node.label, node.x, node.y + size + 14);
        }
      });
 
      // 6. Draw Spatial Ripples (Iron Man style feedback)
      ripples.forEach((ripple) => {
          const age = now - ripple.startTime;
          const life = 1000; // 1s
          if (age > life) return;
          
          const alpha = 1 - (age / life);
          const size = (age / life) * 100 * (1/zoom);
          
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
          ctx.lineWidth = 2 / zoom;
          ctx.arc(ripple.x, ripple.y, size, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, size * 0.7, 0, Math.PI * 2);
          ctx.stroke();
      });

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    dimensions, camera, zoom, animating, processedNodes, processedEdges, nodeMap, 
    data.clusters, hoveredNode, matchedSet, isSearchActive, 
    canvasRef, onNodesUpdate, viewSettings, dynamicLOD, ripples
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

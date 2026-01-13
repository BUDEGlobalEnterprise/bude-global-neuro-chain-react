import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import styles from '../styles/components/Minimap.module.css';

const Minimap = React.memo(({ 
  nodes, 
  clusters, 
  camera, 
  zoom, 
  onNavigate,
  hoveredNode,
  selectedNode 
}) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const animationRef = useRef(null);
  
  // Calculate bounds of all nodes with some padding
  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: -500, maxX: 500, minY: -500, maxY: 500, width: 1000, height: 1000 };
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });
    
    const padding = 100;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };
  }, [nodes]);

  // Dynamic rendering loop for real-time updates
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = isExpanded ? 220 : 150;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    // Background with gradient
    const bgGradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size);
    bgGradient.addColorStop(0, '#12121a');
    bgGradient.addColorStop(1, '#0a0a0f');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, size, size);

    // Grid lines for reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const pos = (size / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    // Scale to fit
    const scale = Math.min(
      size / bounds.width,
      size / bounds.height
    ) * 0.85;

    const offsetX = (size - bounds.width * scale) / 2;
    const offsetY = (size - bounds.height * scale) / 2;

    // Helper to convert world to minimap coords
    const toMinimap = (x, y) => ({
      x: (x - bounds.minX) * scale + offsetX,
      y: (y - bounds.minY) * scale + offsetY
    });

    // Draw edges as subtle lines (optional - can be toggled for performance)
    if (isExpanded) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      // Only draw a subset for performance
      nodes.slice(0, 50).forEach(node => {
        const from = toMinimap(node.x, node.y);
        // Draw to a couple connected nodes if we had edge data
        // For simplicity, skip edges in minimap
      });
    }

    // Draw nodes - use actual current positions from physics
    nodes.forEach(node => {
      const pos = toMinimap(node.x, node.y);
      const baseSize = Math.max(1.5, Math.min(node.size * scale * 0.15, 4));
      
      const color = clusters[node.cluster]?.color || '#888888';
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      
      // Node glow for special states
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, baseSize + 6, 0, Math.PI * 2);
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, baseSize + 6);
        glow.addColorStop(0, color + '60');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Node dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isHovered || isSelected ? baseSize + 1 : baseSize, 0, Math.PI * 2);
      ctx.fillStyle = isHovered || isSelected ? '#ffffff' : color;
      ctx.globalAlpha = isHovered || isSelected ? 1 : 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Draw viewport indicator
    const viewportWidth = (window.innerWidth / zoom) * scale;
    const viewportHeight = (window.innerHeight / zoom) * scale;
    const viewportPos = toMinimap(-camera.x / zoom, -camera.y / zoom);

    // Viewport shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, size, size);
    
    // Clear the viewport area
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(
      viewportPos.x - viewportWidth / 2,
      viewportPos.y - viewportHeight / 2,
      viewportWidth,
      viewportHeight
    );
    ctx.restore();

    // Viewport border with glow
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(
      viewportPos.x - viewportWidth / 2,
      viewportPos.y - viewportHeight / 2,
      viewportWidth,
      viewportHeight
    );
    ctx.shadowBlur = 0;

    // Center crosshair
    const centerPos = toMinimap(0, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerPos.x - 5, centerPos.y);
    ctx.lineTo(centerPos.x + 5, centerPos.y);
    ctx.moveTo(centerPos.x, centerPos.y - 5);
    ctx.lineTo(centerPos.x, centerPos.y + 5);
    ctx.stroke();

  }, [nodes, clusters, bounds, camera, zoom, hoveredNode, selectedNode, isExpanded]);

  // Continuous rendering for dynamic updates
  useEffect(() => {
    let running = true;
    
    const loop = () => {
      if (running) {
        render();
        animationRef.current = requestAnimationFrame(loop);
      }
    };
    
    loop();
    
    return () => {
      running = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  const getWorldCoords = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const size = isExpanded ? 220 : 150;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const scale = Math.min(
      size / bounds.width,
      size / bounds.height
    ) * 0.85;

    const offsetX = (size - bounds.width * scale) / 2;
    const offsetY = (size - bounds.height * scale) / 2;

    const worldX = (x - offsetX) / scale + bounds.minX;
    const worldY = (y - offsetY) / scale + bounds.minY;

    return { x: worldX, y: worldY };
  }, [bounds, isExpanded]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const world = getWorldCoords(e.clientX, e.clientY);
    onNavigate(world.x, world.y);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const world = getWorldCoords(e.clientX, e.clientY);
      onNavigate(world.x, world.y);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className={`${styles.minimap} ${isExpanded ? styles.expanded : ''}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => { setIsExpanded(false); setIsDragging(false); }}
    >
      <canvas
        ref={canvasRef}
        className={styles.minimapCanvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      <div className={styles.minimapLabel}>
        <span className={styles.labelIcon}>🗺️</span>
        <span>Navigator</span>
      </div>
      <div className={styles.nodeCount}>
        {nodes.length} nodes
      </div>
      {isExpanded && (
        <div className={styles.instructions}>
          Click or drag to navigate
        </div>
      )}
    </div>
  );
});

Minimap.displayName = 'Minimap';

export default Minimap;

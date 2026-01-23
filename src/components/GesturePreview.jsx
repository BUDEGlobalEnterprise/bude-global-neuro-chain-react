/**
 * GesturePreview Component
 * Displays the webcam feed and hand landmarks
 */

import React, { useRef, useEffect } from 'react';
import { getController } from '../config/featureRegistry';
import styles from '../styles/components/GesturePreview.module.css';

/**
 * PIP (Picture-in-Picture) preview for gesture interaction
 * Shows the camera feed and real-time landmark tracking
 */
export function GesturePreview() {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const controller = getController('gesture');
    if (!controller || controller.source !== 'webcam') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Subscribe to raw results from the controller
    controller.setOnResultsCallback((results) => {
      if (!canvas || !ctx) return;

      const now = performance.now();

      // Clear canvas with a very slight fade for motion trail effect
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 10, 20, 0.2)'; // Dark tech blue background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw Digital Scanning Matrix (Background Grid)
      drawTechGrid(ctx, canvas.width, canvas.height, now);
      
      // Draw mirror image
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      // Draw video frame with slight opacity for better landmark visibility
      if (results.image) {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
      }

      // Draw horizontal scanning line
      drawScanningLine(ctx, canvas.width, canvas.height, now);

      // Draw hand landmarks
      if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
          const handedness = results.multiHandedness?.[index];
          const color = handedness?.label === 'Left' ? '#00f2ff' : '#00ffaa'; // Cyber neon colors
          
          // Draw connections with glow
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          drawConnectors(ctx, landmarks, canvas.width, canvas.height, color);
          
          // Draw points with variable size and glow
          drawLandmarks(ctx, landmarks, canvas.width, canvas.height, color);
          
          // Draw Lock-on Reticles for Tips (Iron Man style)
          drawReticles(ctx, landmarks, canvas.width, canvas.height, color, handedness?.label, index);
          
          ctx.shadowBlur = 0;
        });
      }
      
      ctx.restore();
    });

    return () => {
      controller.setOnResultsCallback(null);
    };
  }, []);

  return (
    <div className={styles.previewContainer}>
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480} 
        className={styles.canvas}
      />
      <div className={styles.hudOverlay}>
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />
        <div className={styles.scanText}>SYSTEM_READY // DEPTH_SCAN_ACTIVE</div>
        <div className={styles.telemetry}>
           FPS: 60.0<br/>
           LATENCY: 12ms<br/>
           UI_TIER: IRON_MAN
        </div>
      </div>
    </div>
  );
}

/**
 * Draw background digital grid
 */
function drawTechGrid(ctx, w, h, time) {
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.05)';
    ctx.lineWidth = 1;
    const spacing = 40;
    const offset = (time * 0.02) % spacing;

    for (let x = offset; x < w; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = offset; y < h; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
}

/**
 * Draw horizontal scanning line
 */
function drawScanningLine(ctx, w, h, time) {
    const y = (time * 0.1) % h;
    const grad = ctx.createLinearGradient(0, y - 20, 0, y);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0, 242, 255, 0.2)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 20, w, 20);
    
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
}

/**
 * Draw futuristic reticles on fingertips
 */
function drawReticles(ctx, landmarks, w, h, color, label, handIndex) {
    const tips = [4, 8, 12, 16, 20];
    tips.forEach(tipIdx => {
        const l = landmarks[tipIdx];
        const x = l.x * w;
        const y = l.y * h;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        
        // Reticle corners
        const s = 10;
        ctx.beginPath();
        ctx.moveTo(x - s, y - s/2); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s/2, y - s);
        ctx.moveTo(x + s/2, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s/2);
        ctx.moveTo(x + s, y + s/2); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s/2, y + s);
        ctx.moveTo(x - s/2, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + s/2);
        ctx.stroke();

        // Data readout for Index tip (most important)
        if (tipIdx === 8) {
            ctx.save();
            ctx.scale(-1, 1); // Flip back for readable text
            ctx.translate(-x*2, 0);
            ctx.fillStyle = color;
            ctx.font = '8px monospace';
            ctx.fillText(`${label}_${handIndex}`, x + 15, y - 5);
            ctx.fillText(`X:${l.x.toFixed(3)} Y:${l.y.toFixed(3)}`, x + 15, y + 5);
            ctx.fillText(`Z:${l.z.toFixed(3)}`, x + 15, y + 15);
            ctx.restore();
        }
    });
}

/**
 * Draw MediaPipe landmark points with premium styling
 */
function drawLandmarks(ctx, landmarks, width, height, color = '#00ff00') {
  for (let i = 0; i < landmarks.length; i++) {
    const l = landmarks[i];
    const isTip = [4, 8, 12, 16, 20].includes(i);
    
    ctx.fillStyle = isTip ? '#ffffff' : color;
    ctx.beginPath();
    ctx.arc(l.x * width, l.y * height, isTip ? 3 : 1.5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/**
 * Draw MediaPipe hand connections
 */
function drawConnectors(ctx, landmarks, width, height, color = '#ffffff') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  const connections = [
    [0, 1, 2, 3, 4], // Thumb
    [0, 5, 6, 7, 8], // Index
    [0, 9, 10, 11, 12], // Middle
    [0, 13, 14, 15, 16], // Ring
    [0, 17, 18, 19, 20], // Pinky
    [5, 9, 13, 17, 5] // Palm
  ];

  for (const connection of connections) {
    ctx.beginPath();
    for (let i = 0; i < connection.length; i++) {
      const idx = connection[i];
      const nextIdx = connection[i + 1];
      if (nextIdx !== undefined) {
        ctx.moveTo(landmarks[idx].x * width, landmarks[idx].y * height);
        ctx.lineTo(landmarks[nextIdx].x * width, landmarks[nextIdx].y * height);
      }
    }
    ctx.stroke();
  }
}

export default GesturePreview;

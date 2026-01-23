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

      // Clear canvas
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw mirror image
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      // Draw video frame
      if (results.image) {
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      }

      // Draw hand landmarks
      if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          // Draw connections
          drawConnectors(ctx, landmarks, canvas.width, canvas.height);
          // Draw points
          drawLandmarks(ctx, landmarks, canvas.width, canvas.height);
        }
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
        width={320} 
        height={240} 
        className={styles.canvas}
      />
      <div className={styles.overlay}>
        <div className={styles.label}>Webcam Feed</div>
      </div>
    </div>
  );
}

/**
 * Draw MediaPipe landmark points
 */
function drawLandmarks(ctx, landmarks, width, height) {
  ctx.fillStyle = '#00ff00';
  for (const landmark of landmarks) {
    ctx.beginPath();
    ctx.arc(landmark.x * width, landmark.y * height, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/**
 * Draw MediaPipe hand connections
 */
function drawConnectors(ctx, landmarks, width, height) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
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

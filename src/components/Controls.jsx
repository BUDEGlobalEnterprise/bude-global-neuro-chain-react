import React, { useState } from 'react';
import styles from '../styles/components/Controls.module.css';
import { exportToPNG, exportToSVG, generateShareLink } from '../utils/exportHelpers';
import { soundManager } from '../utils/SoundManager';

const Controls = React.memo(({ 
  animating, 
  onResetView, 
  onToggleAnimation, 
  onExportData,
  onToggleSettings,
  onZoomIn,
  onZoomOut,
  canvasRef,
  nodes,
  edges,
  clusters,
  camera,
  zoom
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportPNG = () => {
    exportToPNG(canvasRef, 'bude-global-neuro-chain.png');
    setShowExportMenu(false);
  };

  const handleExportSVG = () => {
    exportToSVG(canvasRef, 'bude-global-neuro-chain.svg');
    setShowExportMenu(false);
  };

  const handleShareLink = async () => {
    const link = generateShareLink({ nodes, edges, clusters, camera, zoom });
    try {
        await navigator.clipboard.writeText(link);
        alert('Share link copied to clipboard!'); // Or use a toast notification if available
    } catch (err) {
        console.error('Failed to copy link:', err);
        // Fallback or error handling
    }
    setShowExportMenu(false);
  };

  const [isMuted, setIsMuted] = useState(!soundManager.enabled);

  const handleToggleMute = () => {
    const enabled = soundManager.toggleMute();
    setIsMuted(!enabled);
    if (enabled) soundManager.playClick();
  };

  return (
    <div className={styles.controls}>
      <button
        className={styles.controlBtn}
        onClick={onZoomIn}
        title="Zoom In (+)"
        aria-label="zoom in"
      >
        <span className={styles.icon}>+</span>
      </button>

      <button
        className={styles.controlBtn}
        onClick={onZoomOut}
        title="Zoom Out (-)"
        aria-label="zoom out"
      >
        <span className={styles.icon}>−</span>
      </button>

      <button
        className={styles.controlBtn}
        onClick={onToggleSettings}
        title="View Settings"
      >
        <span className={styles.icon}>⚙️</span>
      </button>

      <button
        className={styles.controlBtn}
        onClick={onResetView}
        title="Reset View (R)"
      >
        <span className={styles.icon}>⟲</span>
      </button>

      <button
        className={`${styles.controlBtn} ${animating ? styles.active : ''}`}
        onClick={onToggleAnimation}
        title={animating ? 'Pause (Space)' : 'Play (Space)'}
      >
        <span className={styles.icon}>{animating ? '⏸' : '▶'}</span>
      </button>

      <button
        className={`${styles.controlBtn} ${isMuted ? styles.muted : ''}`}
        onClick={handleToggleMute}
        title="Toggle Sound"
      >
        <span className={styles.icon}>{isMuted ? '🔇' : '🔊'}</span>
      </button>
      
      <div className={styles.separator} />
      
      <div className={styles.exportGroup}>
        <button
          className={styles.controlBtn}
          onClick={() => setShowExportMenu(!showExportMenu)}
          title="Export Options"
        >
          <span className={styles.icon}>↓</span>
        </button>
        
        {showExportMenu && (
          <div className={styles.exportMenu}>
            <button onClick={handleExportPNG} className={styles.exportOption}>
              📷 Export PNG
            </button>
            <button onClick={handleExportSVG} className={styles.exportOption}>
              🎨 Export SVG
            </button>
            <button onClick={onExportData} className={styles.exportOption}>
              📄 Export JSON
            </button>
            <button onClick={handleShareLink} className={styles.exportOption}>
              🔗 Copy Share Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

Controls.displayName = 'Controls';

export default Controls;

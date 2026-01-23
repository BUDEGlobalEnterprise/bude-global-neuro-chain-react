import React, { useState, useEffect } from 'react';
import { gestureConfig } from '../config/gesture.js';
import { getController } from '../config/featureRegistry.js';
import { CONTROLLER_STATES, INTENTS } from '../gesture/types.js';
import { useGestureIntents } from '../hooks/useGestureIntents';
import GesturePreview from './GesturePreview';
import styles from '../styles/components/GestureStatus.module.css';

/**
 * Enhanced Status indicator for gesture interaction system
 */
export function GestureStatus() {
  const [status, setStatus] = useState({
    state: CONTROLLER_STATES.IDLE,
    isActive: false,
    error: null,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [lastDetected, setLastDetected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Subscribe to intents for visual feedback
  useGestureIntents({
    '*': (event) => {
      if (event.intent !== INTENTS.IDLE) {
        setLastDetected(event.intent);
        setShowFeedback(true);
        // Clear feedback after a short delay
        const timer = setTimeout(() => setShowFeedback(false), 1000);
        return () => clearTimeout(timer);
      }
    }
  });
  
  useEffect(() => {
    if (!gestureConfig.enabled) return;
    
    const interval = setInterval(() => {
      const controller = getController('gesture');
      if (controller) {
        setStatus(controller.getStatus());
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  if (!gestureConfig.enabled) {
    return null;
  }
  
  const getStatusInfo = () => {
    switch (status.state) {
      case CONTROLLER_STATES.INITIALIZING:
        return { text: 'Initializing...', className: 'initializing', icon: '⏳' };
      case CONTROLLER_STATES.ACTIVE:
        return { text: 'Gesture Active', className: 'active', icon: '✋' };
      case CONTROLLER_STATES.PERMISSION_DENIED:
        return { text: 'Camera Denied', className: 'error', icon: '🚫' };
      case CONTROLLER_STATES.ERROR:
        return { text: 'Error', className: 'error', icon: '⚠️' };
      default:
        return { text: 'Ready', className: 'idle', icon: '👆' };
    }
  };
  
  const info = getStatusInfo();
  
  return (
    <>
      <div className={styles.container}>
        {showPreview && status.state === CONTROLLER_STATES.ACTIVE && (
          <GesturePreview />
        )}
        
        {showGuide && (
          <div className={styles.guideModal} onClick={() => setShowGuide(false)}>
            <div className={styles.guideHeader}>
              <h3>How it Works</h3>
              <button className={styles.closeBtn}>×</button>
            </div>
            <div className={styles.guideContent}>
              <div className={styles.guideItem}>
                <span className={styles.guideIcon}>🤏</span>
                <div>
                  <strong>Zoom</strong>
                  <p>Pinch your thumb and index finger together and move them closer/further.</p>
                </div>
              </div>
              <div className={styles.guideItem}>
                <span className={styles.guideIcon}>↔️</span>
                <div>
                  <strong>Rotate</strong>
                  <p>Move your open palm horizontally to rotate the world.</p>
                </div>
              </div>
              <div className={styles.guideItem}>
                <span className={styles.guideIcon}>✋</span>
                <div>
                  <strong>Pan</strong>
                  <p>Move your open palm vertically or diagonally to navigate.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={styles.controlsRow}>
           <div 
            className={`${styles.gestureStatus} ${styles[info.className]} ${showFeedback ? styles.feedback : ''}`}
            onClick={() => setShowGuide(!showGuide)}
          >
            <span className={styles.icon}>{showFeedback ? '✨' : info.icon}</span>
            <span className={styles.text}>{showFeedback ? lastDetected : info.text}</span>
          </div>

          {status.state === CONTROLLER_STATES.ACTIVE && (
            <button 
              className={`${styles.togglePreview} ${showPreview ? styles.activePreview : ''}`}
              onClick={() => setShowPreview(!showPreview)}
              title="Toggle Camera Preview"
            >
              📹
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default GestureStatus;

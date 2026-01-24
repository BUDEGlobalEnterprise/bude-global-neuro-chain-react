import React, { useState, useEffect } from 'react';
import { getController } from '../config/featureRegistry.js';
import { CONTROLLER_STATES, INTENTS } from '../gesture/types.js';
import { useGestureIntents } from '../hooks/useGestureIntents';
import GesturePreview from './GesturePreview';
import styles from '../styles/components/GestureStatus.module.css';

/**
 * Enhanced Status indicator for gesture interaction system
 */
export function GestureStatus({ enabled }) {
  const [status, setStatus] = useState({
    state: CONTROLLER_STATES.IDLE,
    isActive: false,
    error: null,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [lastDetected, setLastDetected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isStuck, setIsStuck] = useState(false);

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
    if (!enabled) return;
    
    let stuckTimer;
    const interval = setInterval(() => {
      const controller = getController('gesture');
      if (controller) {
        const currentStatus = controller.getStatus();
        setStatus(currentStatus);
        
        // Stuck detection (staying in Initializing for > 10s)
        if (currentStatus.state === CONTROLLER_STATES.INITIALIZING) {
          if (!stuckTimer) {
            stuckTimer = setTimeout(() => setIsStuck(true), 10000);
          }
        } else {
          if (stuckTimer) {
            clearTimeout(stuckTimer);
            stuckTimer = null;
          }
          setIsStuck(false);
        }
      }
    }, 500);
    
    return () => {
      clearInterval(interval);
      if (stuckTimer) clearTimeout(stuckTimer);
    };
  }, [enabled]);
  
  if (!enabled) {
    return null;
  }
  
  const getStatusInfo = () => {
    if (isStuck) return { text: 'Stuck? Refresh Page', className: 'error', icon: '❓' };
    switch (status.state) {
      case CONTROLLER_STATES.INITIALIZING:
        return { text: 'Starting Cam...', className: 'initializing', icon: '⏳' };
      case CONTROLLER_STATES.ACTIVE:
        return { text: 'Invent Gestures', className: 'active', icon: '✋' };
      case CONTROLLER_STATES.PERMISSION_DENIED:
        return { text: 'Camera Denied', className: 'error', icon: '🚫' };
      case CONTROLLER_STATES.ERROR:
        return { text: 'Cam Error', className: 'error', icon: '⚠️' };
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
              <div className={styles.guideSection}>
                <h4>Navigation</h4>
                <div className={styles.guideItem}>
                  <span className={styles.guideIcon}>✋</span>
                  <div>
                    <strong>Open Palm Pan</strong>
                    <p>Move an open palm slowly to pan across the Invent space.</p>
                  </div>
                </div>
                <div className={styles.guideItem}>
                  <span className={styles.guideIcon}>🤏</span>
                  <div>
                    <strong>Pinch Zoom</strong>
                    <p>Pinch and drag to zoom into or out of innovation clusters.</p>
                  </div>
                </div>
                <div className={styles.guideItem}>
                  <span className={styles.guideIcon}>☝️</span>
                  <div>
                    <strong>Precision Rotate</strong>
                    <p>Point your index finger and rotate your wrist to tilt the global view.</p>
                  </div>
                </div>
              </div>

              <div className={styles.guideSection}>
                <h4>Exploration</h4>
                <div className={styles.guideItem}>
                  <span className={styles.guideIcon}>👁️</span>
                  <div>
                    <strong>Hover to Focus</strong>
                    <p>Hold an open palm over a node for 800ms to highlight it.</p>
                  </div>
                </div>
                <div className={styles.guideItem}>
                  <span className={styles.guideIcon}>👐</span>
                  <div>
                    <strong>Cluster Expand</strong>
                    <p>Move both hands outward to unpack a cluster of ideas.</p>
                  </div>
                </div>
              </div>

              <div className={styles.guideSection}>
                <h4>Modes</h4>
                <div className={styles.guideItem}>
                  <span className={styles.guideIcon}>✊</span>
                  <div>
                    <strong>View Lock</strong>
                    <p>Close your fist to freeze the current camera view.</p>
                  </div>
                </div>
                <div className={styles.guideItem}>
                  <span className={styles.guideIcon}>✋</span>
                  <div>
                    <strong>Pause</strong>
                    <p>Hold your palm flat towards the camera to pause all interaction.</p>
                  </div>
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
            <div className={styles.statusTextContainer}>
              <span className={styles.text}>{showFeedback ? lastDetected : info.text}</span>
              {status.state === CONTROLLER_STATES.ACTIVE && status.isActive && (
                <span className={styles.handCount}>
                   Tracking: {getController('gesture')?.lastLandmarks ? 'HAND_DETECTED' : 'SEARCHING...'}
                </span>
              )}
            </div>
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

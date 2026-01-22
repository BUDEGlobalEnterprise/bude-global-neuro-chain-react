/**
 * GestureStatus Component
 * Visual indicator for gesture system status
 */

import React, { useState, useEffect } from 'react';
import { gestureConfig } from '../config/gesture.js';
import { getController } from '../config/featureRegistry.js';
import { CONTROLLER_STATES } from '../gesture/types.js';
import styles from '../styles/components/GestureStatus.module.css';

/**
 * Status indicator for gesture interaction system
 * Shows initialization state, active status, and errors
 */
export function GestureStatus() {
  const [status, setStatus] = useState({
    state: CONTROLLER_STATES.IDLE,
    isActive: false,
    error: null,
  });
  
  useEffect(() => {
    // Don't render anything if feature is disabled
    if (!gestureConfig.enabled) return;
    
    // Poll controller status
    const interval = setInterval(() => {
      const controller = getController('gesture');
      if (controller) {
        setStatus(controller.getStatus());
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  // Don't render if feature is disabled
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
    <div 
      className={`${styles.gestureStatus} ${styles[info.className]}`}
      title={status.error || info.text}
    >
      <span className={styles.icon}>{info.icon}</span>
      <span className={styles.text}>{info.text}</span>
    </div>
  );
}

export default GestureStatus;

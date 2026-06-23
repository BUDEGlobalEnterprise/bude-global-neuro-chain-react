import React, { useEffect, useRef, useState } from 'react';
import { getController } from '../config/featureRegistry.js';
import { CONTROLLER_STATES, INTENTS } from '../gesture/types.js';
import { useGestureIntents } from '../hooks/useGestureIntents';
import GesturePreview from './GesturePreview';
import styles from '../styles/components/GestureStatus.module.css';

const formatGestureName = (value) => {
  if (!value) {
    return 'SCAN_IDLE';
  }
  return value.replaceAll('_', ' ');
};

const confidencePercent = (value) => Math.round((value || 0) * 100);

export function GestureStatus({ enabled }) {
  const [status, setStatus] = useState({
    state: CONTROLLER_STATES.IDLE,
    isActive: false,
    error: null,
  });
  const [telemetry, setTelemetry] = useState({
    gestureMeta: {},
    primaryGesture: null,
    activeStates: [],
    handCount: 0,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [feedbackIntent, setFeedbackIntent] = useState(null);
  const [isStuck, setIsStuck] = useState(false);
  const feedbackTimerRef = useRef(null);
  const stuckStartRef = useRef(0);

  useGestureIntents({
    '*': (event) => {
      if (event.intent === INTENTS.IDLE) {
        return;
      }
      setFeedbackIntent(event.intent);
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedbackIntent(null);
      }, 900);
    }
  });

  useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const controller = getController('gesture');
      if (!controller) {
        return;
      }

      const nextStatus = controller.getStatus();
      setStatus(nextStatus);
      setTelemetry(controller.gestureTelemetry || {
        gestureMeta: {},
        primaryGesture: null,
        activeStates: [],
        handCount: 0,
      });

      if (nextStatus.state === CONTROLLER_STATES.INITIALIZING) {
        if (!stuckStartRef.current) {
          stuckStartRef.current = Date.now();
        }
        setIsStuck(Date.now() - stuckStartRef.current > 10000);
      } else {
        stuckStartRef.current = 0;
        setIsStuck(false);
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  const primaryMeta = telemetry.gestureMeta?.[telemetry.primaryGesture] || null;
  const holdProgress = primaryMeta?.holdProgress || 0;
  const graceProgress = primaryMeta?.phase === 'exit_pending' ? primaryMeta.graceProgress : 0;
  const confidence = confidencePercent(primaryMeta?.confidence);

  const getStatusInfo = () => {
    if (isStuck) {
      return { text: 'PIPELINE_STALLED', className: 'error', tag: 'REINIT' };
    }
    switch (status.state) {
      case CONTROLLER_STATES.INITIALIZING:
        return { text: 'CAM_BOOTSTRAP', className: 'initializing', tag: 'SYNC' };
      case CONTROLLER_STATES.ACTIVE:
        return { text: feedbackIntent || 'GESTURE_LINK', className: 'active', tag: 'LIVE' };
      case CONTROLLER_STATES.PERMISSION_DENIED:
        return { text: 'CAMERA_BLOCKED', className: 'error', tag: 'DENIED' };
      case CONTROLLER_STATES.ERROR:
        return { text: 'TRACKING_FAULT', className: 'error', tag: 'FAULT' };
      default:
        return { text: 'SYSTEM_READY', className: 'idle', tag: 'STANDBY' };
    }
  };

  const info = getStatusInfo();

  return (
    <div className={styles.container}>
      {showPreview && status.state === CONTROLLER_STATES.ACTIVE && <GesturePreview />}

      {showGuide && (
        <div className={styles.guideModal} onClick={() => setShowGuide(false)}>
          <div className={styles.guideHeader}>
            <h3>Gesture HUD</h3>
            <button className={styles.closeBtn} type="button" onClick={() => setShowGuide(false)}>
              X
            </button>
          </div>
          <div className={styles.guideContent}>
            <div className={styles.guideBlock}>
              <strong>Confidence Arc</strong>
              <p>Use a circular confidence ring around the cursor that turns amber during hold and cyan on active lock.</p>
            </div>
            <div className={styles.guideBlock}>
              <strong>Transition Rail</strong>
              <p>Render a thin horizontal rail for hold and grace timers so users see when a gesture is about to engage or decay.</p>
            </div>
            <div className={styles.guideBlock}>
              <strong>Depth Pulse</strong>
              <p>For push-to-click, animate a forward pulse and a short reticle contraction when the depth threshold is crossed.</p>
            </div>
            <div className={styles.guideBlock}>
              <strong>Selection Beacon</strong>
              <p>Highlight the current target with segmented brackets and a confidence label instead of a generic hover glow.</p>
            </div>
          </div>
        </div>
      )}

      <div className={styles.controlsRow}>
        <button
          type="button"
          className={`${styles.gestureStatus} ${styles[info.className]}`}
          onClick={() => setShowGuide((value) => !value)}
        >
          <div
            className={styles.ring}
            style={{ '--gesture-confidence': `${confidence}%` }}
          >
            <div className={styles.ringFill} />
            <span className={styles.ringValue}>{confidence}%</span>
          </div>

          <div className={styles.statusTextContainer}>
            <div className={styles.rowTop}>
              <span className={styles.text}>{info.text}</span>
              <span className={styles.tag}>{info.tag}</span>
            </div>
            <div className={styles.rowBottom}>
              <span>{formatGestureName(telemetry.primaryGesture)}</span>
              <span>{telemetry.handCount ? `${telemetry.handCount}H` : 'NO_HAND'}</span>
              <span>{primaryMeta?.phase?.toUpperCase() || 'IDLE'}</span>
            </div>
            <div className={styles.meterTrack}>
              <div
                className={styles.meterFill}
                style={{ width: `${Math.round(Math.max(holdProgress, graceProgress) * 100)}%` }}
              />
            </div>
          </div>
        </button>

        {status.state === CONTROLLER_STATES.ACTIVE && (
          <button
            type="button"
            className={`${styles.togglePreview} ${showPreview ? styles.activePreview : ''}`}
            onClick={() => setShowPreview((value) => !value)}
            title="Toggle Camera Preview"
          >
            CAM
          </button>
        )}
      </div>
    </div>
  );
}

export default GestureStatus;

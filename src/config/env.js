/**
 * Environment Configuration
 * Provides typed, validated access to environment variables
 */

import { gestureConfig } from './gesture.js';

// Application settings
export const config = {
  // App metadata
  appTitle: import.meta.env.VITE_APP_TITLE || 'BUDE Global Neuro-Chain',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',

  // Feature flags
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  enableDataEditor: import.meta.env.VITE_ENABLE_DATA_EDITOR !== 'false',
  debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
  enableWorkers: import.meta.env.VITE_ENABLE_WORKERS !== 'false',

  // Performance settings
  maxVisibleNodes: parseInt(import.meta.env.VITE_MAX_VISIBLE_NODES, 10) || 1000,
  animationFPS: parseInt(import.meta.env.VITE_ANIMATION_FPS, 10) || 60,

  // Analytics
  gaId: import.meta.env.VITE_GA_ID || '',

  // API (future use)
  apiBaseURL: import.meta.env.VITE_API_BASE_URL || '',
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT, 10) || 10000,

  // Computed
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  
  // Gesture interaction (experimental)
  gesture: gestureConfig,
};

/**
 * Debug logger - only logs in debug mode
 */
export const debug = {
  log: (...args) => {
    if (config.debugMode) {
      console.log('[DEBUG]', ...args);
    }
  },
  warn: (...args) => {
    if (config.debugMode) {
      console.warn('[DEBUG]', ...args);
    }
  },
  error: (...args) => {
    // Always log errors
    console.error('[ERROR]', ...args);
  },
  time: (label) => {
    if (config.debugMode) {
      console.time(`[PERF] ${label}`);
    }
  },
  timeEnd: (label) => {
    if (config.debugMode) {
      console.timeEnd(`[PERF] ${label}`);
    }
  },
};

/**
 * Validate required environment variables
 * Call this at app startup to catch missing config early
 */
export const validateEnv = () => {
  const warnings = [];

  if (config.enableAnalytics && !config.gaId) {
    warnings.push('Analytics enabled but VITE_GA_ID is not set');
  }

  if (config.maxVisibleNodes < 100) {
    warnings.push('VITE_MAX_VISIBLE_NODES is very low, may affect user experience');
  }

  if (config.animationFPS > 120) {
    warnings.push('VITE_ANIMATION_FPS is very high, may cause performance issues');
  }

  if (warnings.length > 0 && config.debugMode) {
    console.warn('Environment validation warnings:', warnings);
  }

  return { valid: true, warnings };
};

export default config;

import React from 'react';
import styles from '../styles/components/ViewSettings.module.css';
import { THEMES } from '../config/themes';

const ViewSettings = ({ settings, onToggleSetting, onSetTheme, onClose }) => {
  return (
    <div className={styles.settingsPanel}>
      <div className={styles.header}>
        <h3>View Settings</h3>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      <div className={styles.section}>
        <h4>Visibility</h4>
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input 
              type="checkbox" 
              checked={settings.renderLabels}
              onChange={() => onToggleSetting('renderLabels')}
            />
            Show Labels
          </label>
        </div>
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input 
              type="checkbox" 
              checked={settings.renderGlow}
              onChange={() => onToggleSetting('renderGlow')}
            />
            Show Glow Effects
          </label>
        </div>
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input 
              type="checkbox" 
              checked={settings.renderPulses}
              onChange={() => onToggleSetting('renderPulses')}
            />
            Show Particles
          </label>
        </div>
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h4>Interaction</h4>
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input 
              type="checkbox" 
              checked={settings.enableGestures}
              onChange={() => onToggleSetting('enableGestures')}
            />
            Hand Gestures (Beta)
          </label>
        </div>
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h4>Themes ({Object.keys(THEMES).length})</h4>
        <div className={styles.themeGrid}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <button 
              key={key}
              className={`${styles.themeBtn} ${settings.theme === key ? styles.active : ''}`}
              onClick={() => onSetTheme(key)}
              title={theme.label}
            >
              <div 
                className={styles.themePreview} 
                style={{ background: theme.background }}
              />
              <span>{theme.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ViewSettings;

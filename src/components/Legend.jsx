import React, { useMemo } from 'react';
import styles from '../styles/components/Legend.module.css';

const Legend = React.memo(({ clusters, onFocusCluster, hiddenClusters, onToggleCluster, defaultCollapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const clusterEntries = useMemo(() => {
    return Object.entries(clusters);
  }, [clusters]);

  return (
    <div className={`${styles.legend} ${isCollapsed ? styles.collapsed : ''}`}>
      <div 
        className={styles.legendHeader}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span>EXPLORE CLUSTERS</span>
        <span className={styles.toggleIcon}>{isCollapsed ? '▲' : '▼'}</span>
      </div>
      
      {!isCollapsed && (
        <div className={styles.clusterList}>
            {clusterEntries.map(([id, cluster]) => {
                const isHidden = hiddenClusters?.has(id);
                return (
                    <div
                        key={id}
                        className={`${styles.legendItem} ${isHidden ? styles.hidden : ''}`}
                        title="Click name to focus, Eye to toggle visibility"
                    >
                        <div 
                            className={styles.visibilityToggle}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleCluster && onToggleCluster(id);
                            }}
                        >
                            {isHidden ? '○' : '●'}
                        </div>
                        
                        <div 
                            className={styles.legendContent}
                            onClick={() => onFocusCluster(id)}
                        >
                            <span
                                className={styles.legendDot}
                                style={{ 
                                    backgroundColor: isHidden ? '#333' : cluster.color,
                                    boxShadow: isHidden ? 'none' : `0 0 8px ${cluster.color}`
                                }}
                            />
                            <span>{cluster.label}</span>
                        </div>
                    </div>
                );
            })}
        </div>
      )}
    </div>
  );
});

Legend.displayName = 'Legend';

export default Legend;

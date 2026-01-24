import React, { useMemo } from 'react';
import styles from '../styles/components/StatsPanel.module.css';

const StatsPanel = React.memo(({ nodes, edges, clusters, defaultCollapsed = false }) => {
  const stats = useMemo(() => {
    // Calculate most connected nodes
    const connectionCounts = {};
    edges.forEach(edge => {
      connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
      connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
    });

    const topNodes = Object.entries(connectionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => ({
        node: nodes.find(n => n.id === id),
        connections: count
      }));

    // Cluster distribution
    const clusterCounts = {};
    nodes.forEach(node => {
      clusterCounts[node.cluster] = (clusterCounts[node.cluster] || 0) + 1;
    });

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalClusters: Object.keys(clusters).length,
      topNodes,
      clusterCounts
    };
  }, [nodes, edges, clusters]);

  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  return (
    <div className={`${styles.statsPanel} ${isCollapsed ? styles.collapsed : ''}`}>
      <div 
        className={styles.statsHeader}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3>Network Statistics</h3>
        <span className={styles.toggleIcon}>{isCollapsed ? '▲' : '▼'}</span>
      </div>

      {!isCollapsed && (
        <>
            <div className={styles.statsGrid}>
                <div className={styles.statCard} title="Total number of innovation nodes">
                <div className={styles.statValue}>{stats.totalNodes}</div>
                <div className={styles.statLabel}>Innovations</div>
                </div>
                <div className={styles.statCard} title="Total relationships">
                <div className={styles.statValue}>{stats.totalEdges}</div>
                <div className={styles.statLabel}>Connections</div>
                </div>
                <div className={styles.statCard} title="Categorized groups">
                <div className={styles.statValue}>{stats.totalClusters}</div>
                <div className={styles.statLabel}>Clusters</div>
                </div>
                <div className={styles.statCard} title="Connections per node">
                <div className={styles.statValue}>{(stats.totalEdges / stats.totalNodes).toFixed(1)}</div>
                <div className={styles.statLabel}>Density</div>
                </div>
            </div>

            <div className={styles.topNodes}>
                <h4>Most Connected</h4>
                {stats.topNodes.map(({ node, connections }) => (
                <div key={node.id} className={styles.topNodeItem}>
                    <span
                    className={styles.nodeDot}
                    style={{ backgroundColor: clusters[node.cluster]?.color }}
                    />
                    <span className={styles.nodeName}>{node.label}</span>
                    <span className={styles.nodeCount}>{connections}</span>
                </div>
                ))}
            </div>

            <div className={styles.clusterDist}>
                <h4>Cluster Distribution</h4>
                {Object.entries(stats.clusterCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([clusterId, count]) => (
                    <div key={clusterId} className={styles.clusterBar}>
                    <div className={styles.clusterInfo}>
                        <span
                        className={styles.clusterDot}
                        style={{ backgroundColor: clusters[clusterId]?.color }}
                        />
                        <span className={styles.clusterName}>
                        {clusters[clusterId]?.label}
                        </span>
                    </div>
                    <div className={styles.barContainer}>
                        <div
                        className={styles.bar}
                        style={{
                            width: `${(count / stats.totalNodes) * 100}%`,
                            backgroundColor: clusters[clusterId]?.color
                        }}
                        />
                        <span className={styles.barLabel}>{count}</span>
                    </div>
                    </div>
                ))}
            </div>
        </>
      )}
    </div>
  );
});

StatsPanel.displayName = 'StatsPanel';

export default StatsPanel;

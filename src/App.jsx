import './styles/global.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import CanvasNetwork from './components/CanvasNetwork';
import TitleBlock from './components/TitleBlock';
import Legend from './components/Legend';
import Panel from './components/Panel';
import Controls from './components/Controls';
import Tooltip from './components/Tooltip';
import SearchBar from './components/SearchBar';
import Footer from './components/Footer';
import HelpModal from './components/HelpModal';
import Onboarding from './components/Onboarding';
import Minimap from './components/Minimap';
import StatsPanel from './components/StatsPanel';
import ViewSettings from './components/ViewSettings';
import DetailPanel from './components/DetailPanel';
import TimelineControl from './components/TimelineControl';
import ErrorBoundary from './components/ErrorBoundary';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { config, validateEnv, debug } from './config/env';
import { initializeFeatures, cleanupFeatures } from './config/featureRegistry';
import { gestureConfig } from './config/gesture';
import GestureStatus from './components/GestureStatus';

// Import data
import clustersData from './data/clusters.json';
import nodesData from './data/nodes.json';
import edgesData from './data/edges.json';
import descriptionsData from './data/descriptions.json';

// Validate environment on startup
if (config.debugMode) {
  validateEnv();
  debug.log('App initialized with config:', config);
}

function App() {
  const [data, setData] = useState({
    clusters: clustersData,
    nodes: nodesData,
    edges: edgesData,
    descriptions: descriptionsData
  });
  
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null); // Persistent selection for DetailPanel
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [animating, setAnimating] = useState(true);
  const [cameraTarget, setCameraTarget] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [searchState, setSearchState] = useState({ term: '', matchedIds: [] });
  const [hiddenClusters, setHiddenClusters] = useState(new Set());
  const [currentYear] = useState(2025); // Default to "Now"
  
  // Live state from CanvasNetwork for dynamic minimap
  const [liveNodes, setLiveNodes] = useState([]);
  const [liveCamera, setLiveCamera] = useState({ x: 0, y: 0 });
  const [liveZoom, setLiveZoom] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Auto-detect mobile and handle resize
  useEffect(() => {
    const handleResize = () => {
        setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const toggleClusterVisibility = (clusterId) => {
    setHiddenClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };
  
  // View Settings State
  const [viewSettings, setViewSettings] = useState({
    renderLabels: true,
    renderGlow: true,
    renderPulses: true,
    enableGestures: gestureConfig.enabled,
    theme: 'default'
  });

  const handleToggleViewSetting = (key) => {
    setViewSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSetTheme = (theme) => {
    setViewSettings(prev => ({
      ...prev,
      theme
    }));
  };

  // Phase 15: Guided Tour Camera Driver
  const handleTourStepChange = useCallback((step) => {
    if (step && step.target) {
        setCameraTarget({ x: step.target.x, y: step.target.y });
        setLiveZoom(step.target.zoom);
    }
  }, []);


  const searchInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+k': (e) => {
      e.preventDefault();
      searchInputRef.current?.focus();
    },
    'escape': () => {
      searchInputRef.current?.blur();
      setHoveredNode(null);
    },
    ' ': (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleToggleAnimation();
      }
    },
    'r': () => {
      handleResetView();
    },
    'arrowup': (e) => {
      e.preventDefault();
      setCameraTarget(prev => ({ x: prev.x, y: prev.y + 50 }));
    },
    'arrowdown': (e) => {
      e.preventDefault();
      setCameraTarget(prev => ({ x: prev.x, y: prev.y - 50 }));
    },
    'arrowleft': (e) => {
      e.preventDefault();
      setCameraTarget(prev => ({ x: prev.x + 50, y: prev.y }));
    },
    'arrowright': (e) => {
      e.preventDefault();
      setCameraTarget(prev => ({ x: prev.x - 50, y: prev.y }));
    },
  });

  const handleDataUpdate = (key, newData) => {
    setData(prev => ({
      ...prev,
      [key]: newData
    }));
  };

  const handleFocusCluster = (clusterId) => {
    const clusterNodes = data.nodes.filter(n => n.cluster === clusterId);
    if (clusterNodes.length === 0) return;
    
    const avgX = clusterNodes.reduce((s, n) => s + n.x, 0) / clusterNodes.length;
    const avgY = clusterNodes.reduce((s, n) => s + n.y, 0) / clusterNodes.length;
    setCameraTarget({ x: -avgX, y: -avgY });
  };

  const handleNodeSelect = (node) => {
    setCameraTarget({ x: -node.x, y: -node.y });
    setSelectedNode(node); // Set persistent selection
  };

  const handleMinimapNavigate = (worldX, worldY) => {
    setCameraTarget({ x: -worldX, y: -worldY });
  };

  const handleResetView = () => {
    setCameraTarget({ x: 0, y: 0 });
  };

  const handleToggleAnimation = () => {
    setAnimating(prev => !prev);
  };

  const handleExportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neuro-chain-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

// Initialize audio context on user interaction

  // Initialize optional features (like gestures) reactively
  useEffect(() => {
    if (viewSettings.enableGestures) {
        gestureConfig.enabled = true;
        initializeFeatures();
    } else {
        gestureConfig.enabled = false;
        cleanupFeatures();
    }
    
    return () => {
      cleanupFeatures();
    };
  }, [viewSettings.enableGestures]);

  useEffect(() => {
    const initAudio = () => {
      import('./utils/SoundManager').then(({ soundManager }) => {
        soundManager.init();
      });
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

  return (
    <>
      <CanvasNetwork
        data={data}
        hoveredNode={hoveredNode}
        setHoveredNode={setHoveredNode}
        setMousePos={setMousePos}
        animating={animating}
        cameraTarget={cameraTarget}
        canvasRef={canvasRef}
        onNodeClick={handleNodeSelect}
        onNodesUpdate={setLiveNodes}
        onCameraChange={setLiveCamera}
        onZoomChange={setLiveZoom}
        viewSettings={viewSettings}
        searchState={searchState}
        hiddenClusters={hiddenClusters}
        maxYear={currentYear}
        gesturesEnabled={viewSettings.enableGestures}
      />
      
      <TitleBlock isMobile={isMobile} />
      
      <SearchBar
        nodes={data.nodes}
        clusters={data.clusters}
        onNodeSelect={handleNodeSelect}
        inputRef={searchInputRef}
        onSearchChange={setSearchState}
      />
      
      <Legend
        onFocusCluster={handleFocusCluster}
        hiddenClusters={hiddenClusters}
        onToggleCluster={toggleClusterVisibility}
        defaultCollapsed={isMobile}
      />

      {/* Show DetailPanel if selectedNode exists, otherwise show generic Panel */}
      {selectedNode ? (
        <DetailPanel 
            node={selectedNode}
            cluster={data.clusters[selectedNode.cluster]}
            onClose={() => setSelectedNode(null)}
        />
      ) : (
        <Panel 
            data={data}
            onDataUpdate={handleDataUpdate}
        />
      )}
      
      <Controls
        animating={animating}
        onResetView={handleResetView}
        onToggleAnimation={handleToggleAnimation}
        onExportData={handleExportData}
        onToggleSettings={() => setShowSettings(!showSettings)}
        canvasRef={canvasRef}
        nodes={data.nodes}
        edges={data.edges}
        clusters={data.clusters}
        camera={cameraTarget}
        zoom={1}
      />

      {showSettings && (
        <ViewSettings 
            settings={viewSettings}
            onToggleSetting={handleToggleViewSetting}
            onSetTheme={handleSetTheme}
            onClose={() => setShowSettings(false)}
        />
      )}
      
      <Tooltip
        hoveredNode={hoveredNode}
        mousePos={mousePos}
        clusters={data.clusters}
        edges={data.edges}
        descriptions={data.descriptions}
      />
      
      <StatsPanel
        nodes={data.nodes}
        edges={data.edges}
        clusters={data.clusters}
        defaultCollapsed={isMobile}
      />
      
      <Minimap
        nodes={liveNodes.length > 0 ? liveNodes : data.nodes}
        clusters={data.clusters}
        camera={liveCamera}
        zoom={liveZoom}
        onNavigate={handleMinimapNavigate}
        hoveredNode={hoveredNode}
        selectedNode={selectedNode}
      />
      
      <HelpModal />

      <Onboarding onStepChange={handleTourStepChange} />
      
      <GestureStatus enabled={viewSettings.enableGestures} />
      
      <Footer />
      
      <div style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '0.6rem',
        color: 'var(--text-muted)',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        opacity: 0.4,
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        ∞ Open-Ended Network ∞
      </div>
    </>
  );
}

export default App;

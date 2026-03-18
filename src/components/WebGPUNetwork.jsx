import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { TileLoader } from '../utils/TileLoader';

const WebGPUNetwork = ({ 
    data = null,
    clusters = {},
    viewSettings = { theme: 'default' },
    onNodeClick = null,
    setHoveredNode = null,
    setMousePos = null
}) => {
    const containerRef = useRef();
    const labelCanvasRef = useRef();
    const [stats, setStats] = useState({ nodes: 0, tiles: 0 });
    
    // Apply theme settings
    const currentTheme = viewSettings.theme === 'light' ? 0xf0f0f0 : 0x020205;
    
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // 1. Setup Renderer
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); 
        } catch (e) {
            console.error("Renderer initialization failed", e);
            return;
        }

        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const labelCanvas = labelCanvasRef.current;
        const lctx = labelCanvas.getContext('2d');
        labelCanvas.width = container.clientWidth * window.devicePixelRatio;
        labelCanvas.height = container.clientHeight * window.devicePixelRatio;
        lctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(currentTheme); 

        // Lighting for 3D depth
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        
        const pointLight = new THREE.PointLight(0x00f2ff, 1.5, 0, 0);
        pointLight.position.set(0, 0, 5000);
        scene.add(pointLight);

        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 1, 200000);
        camera.position.z = 12000;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = true;

        // 1.5 Post Processing (Cinematic Bloom)
        const renderScene = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(container.clientWidth, container.clientHeight),
            1.5,  // strength
            0.4,  // radius
            0.85  // threshold
        );
        
        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);

        // 2. Setup Infinite Tile Loader
        const tileLoader = data ? null : new TileLoader('/tiles/manifest.json');
        
        // 3. Setup Instanced Meshes
        // Use a glowing material - we'll simulate this with Emissive and bloom-ready colors
        const nodeGeo = new THREE.SphereGeometry(1, 8, 8); 
        const nodeMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.5
        });
        const instancedNodes = new THREE.InstancedMesh(nodeGeo, nodeMat, 200000); 
        scene.add(instancedNodes);

        // Edge Geometry 
        const edgeGeo = new THREE.BoxGeometry(1, 1, 1);
        const edgeMat = new THREE.MeshBasicMaterial({ 
            color: 0x00f2ff, 
            transparent: true, 
            opacity: 0.2,
            blending: THREE.AdditiveBlending 
        });
        const instancedEdges = new THREE.InstancedMesh(edgeGeo, edgeMat, 500000);
        scene.add(instancedEdges);

        const matrix = new THREE.Matrix4();
        const colorArr = new THREE.Color();
        const nodeMap = new Map();
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let hoveredId = null;

        // Interaction Handling
        const handleInteraction = (event, isClick = false) => {
            const rect = container.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

            if (setMousePos) setMousePos({ x: event.clientX, y: event.clientY });

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(instancedNodes);

            if (intersects.length > 0) {
                const instanceId = intersects[0].instanceId;
                const nodesArr = data ? data.nodes : Array.from(nodeMap.values());
                const node = nodesArr[instanceId];
                
                if (isClick && onNodeClick) {
                    onNodeClick(node);
                } else if (!isClick) {
                    if (hoveredId !== node.id) {
                        hoveredId = node.id;
                        container.style.cursor = 'pointer';
                        if (setHoveredNode) setHoveredNode(node);
                    }
                }
            } else {
                if (hoveredId !== null) {
                    hoveredId = null;
                    container.style.cursor = 'grab';
                    if (setHoveredNode) setHoveredNode(null);
                }
            }
        };

        container.addEventListener('mousemove', handleInteraction);
        container.addEventListener('click', (e) => handleInteraction(e, true));

        // 3.5 Starfield Background
        const starGeo = new THREE.BufferGeometry();
        const starPositions = new Float32Array(15000);
        for(let i=0; i<15000; i++) starPositions[i] = (Math.random() - 0.5) * 40000;
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starMat = new THREE.PointsMaterial({ color: 0x888888, size: 2, transparent: true, opacity: 0.5 });
        const starField = new THREE.Points(starGeo, starMat);
        scene.add(starField);

        // Simple math helper
        const mathDist = (dx, dy) => Math.sqrt(dx * dx + dy * dy);

        // Throttled stats update
        let lastStatsUpdate = 0;
        let currentNodes = [];

        const updateVisuals = (dataToRender) => {
            const { nodes, edges } = dataToRender;
            if (!nodes) return;

            currentNodes = nodes;
            nodeMap.clear();
            instancedNodes.count = nodes.length;
            
            nodes.forEach((node, i) => {
                nodeMap.set(node.id, node);
                matrix.setPosition(node.x, node.y, 0);
                matrix.scale(new THREE.Vector3(node.size, node.size, node.size));
                instancedNodes.setMatrixAt(i, matrix);
                
                const cColor = clusters[node.cluster]?.color || '#00f2ff';
                colorArr.set(cColor);
                instancedNodes.setColorAt(i, colorArr);
            });
            instancedNodes.instanceMatrix.needsUpdate = true;
            if (instancedNodes.instanceColor) instancedNodes.instanceColor.needsUpdate = true;

            const visibleEdges = edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));
            instancedEdges.count = visibleEdges.length;
            
            visibleEdges.forEach((edge, i) => {
                const s = nodeMap.get(edge.source);
                const t = nodeMap.get(edge.target);
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const distance = mathDist(dx, dy);
                const angle = Math.atan2(dy, dx);
                
                matrix.identity();
                matrix.setPosition(s.x + dx/2, s.y + dy/2, 0);
                matrix.multiply(new THREE.Matrix4().makeRotationZ(angle));
                matrix.scale(new THREE.Vector3(distance, 1.2, 1));
                
                instancedEdges.setMatrixAt(i, matrix);
            });
            instancedEdges.instanceMatrix.needsUpdate = true;
            
            // Throttle stats update to 1 second to avoid React re-render lag
            const now = Date.now();
            if (now - lastStatsUpdate > 1000) {
                setStats({ nodes: nodes.length, tiles: tileLoader ? tileLoader.loadedTiles.size : 0 });
                lastStatsUpdate = now;
            }
        };

        // 4. Animation Loop
        const animate = () => {
            const frameId = requestAnimationFrame(animate);
            controls.update();

            if (tileLoader) {
                const viewport = { width: container.clientWidth, height: container.clientHeight };
                tileLoader.update(camera.position, viewport, 1, updateVisuals);
            }
            
            scene.rotation.y += 0.0002;
            composer.render();

            // 4.5 Render Labels (Project 3D to 2D)
            lctx.clearRect(0, 0, container.clientWidth, container.clientHeight);
            let labelsDrawn = 0;
            const tempV3 = new THREE.Vector3();
            const widthHalf = container.clientWidth / 2;
            const heightHalf = container.clientHeight / 2;

            // Only draw labels if we're zoomed in enough or for large nodes
            const zoomLevel = 15000 / camera.position.length(); 

            nodeMap.forEach((node) => {
                if (labelsDrawn > 300) return; // Limit total labels for performance

                tempV3.set(node.x, node.y, 0);
                tempV3.applyMatrix4(scene.matrixWorld); // Apply scene rotation if any
                tempV3.project(camera);

                if (tempV3.z > 1) return; // Behind camera

                const x = (tempV3.x * widthHalf) + widthHalf;
                const y = -(tempV3.y * heightHalf) + heightHalf;

                // Simple check if node is on screen
                if (x < 0 || x > container.clientWidth || y < 0 || y > container.clientHeight) return;

                const screenDistance = tempV3.z; 
                // Fade out labels based on distance (z in normalized device coords -1 to 1)
                const opacity = Math.max(0, Math.min(1, (0.95 - screenDistance) * 20));
                
                if (opacity > 0.1) {
                    lctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                    lctx.font = `${Math.max(10, 14 * zoomLevel)}px monospace`;
                    lctx.textAlign = 'center';
                    lctx.fillText(node.label.toUpperCase(), x, y - (node.size * zoomLevel + 10));
                    labelsDrawn++;
                }
            });

            return frameId;
        };

        let frameId;
        if (data) {
            updateVisuals(data);
            frameId = animate();
        } else if (tileLoader) {
            tileLoader.init().then(() => { frameId = animate(); });
        }

        const handleResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            composer.setSize(container.clientWidth, container.clientHeight);

            labelCanvas.width = container.clientWidth * window.devicePixelRatio;
            labelCanvas.height = container.clientHeight * window.devicePixelRatio;
            lctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };
        window.addEventListener('resize', handleResize);

        // 5. Cleanup
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
            if (container && renderer.domElement) container.removeChild(renderer.domElement);
        };
    }, [data, clusters, currentTheme, onNodeClick, setHoveredNode, setMousePos]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
            <canvas 
                ref={labelCanvasRef} 
                style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                    pointerEvents: 'none', zIndex: 10 
                }} 
            />
            <div style={{
                position: 'absolute', top: 20, left: 20, pointerEvents: 'none', zIndex: 100,
                color: '#00f2ff', fontFamily: 'monospace', background: 'rgba(0,0,0,0.7)', padding: '10px 15px',
                border: '1px solid #00f2ff', borderRadius: '4px', textTransform: 'uppercase', fontSize: '10px'
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: 5 }}>[ Core: {data ? 'Deep Sea' : 'Infinite'} (WebGL) ]</div>
                Nodes: {stats.nodes.toLocaleString()}<br/>
                {!data && <>Tiles In Cache: {stats.tiles}</>}
            </div>
        </div>
    );
};

export default WebGPUNetwork;

export class TileLoader {
    constructor(manifestUrl) {
        this.manifestUrl = manifestUrl;
        this.manifest = null;
        this.loadedTiles = new Map(); // id -> data
        this.activeTileIds = new Set();
        this.tileSize = 2000;
        this.isLoaded = false;
    }

    async init() {
        const response = await fetch(this.manifestUrl);
        this.manifest = await response.json();
        this.tileSize = this.manifest.tileSize;
        this.isLoaded = true;
        return this.manifest;
    }

    getVisibleTileIds(camera, viewport, zoom) {
        const padding = 1; // Load neighbors
        const worldWidth = viewport.width / zoom;
        const worldHeight = viewport.height / zoom;
        
        const minX = Math.floor((camera.x - worldWidth/2) / this.tileSize) - padding;
        const maxX = Math.ceil((camera.x + worldWidth/2) / this.tileSize) + padding;
        const minY = Math.floor((camera.y - worldHeight/2) / this.tileSize) - padding;
        const maxY = Math.ceil((camera.y + worldHeight/2) / this.tileSize) + padding;

        const ids = [];
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                ids.push(`${x}_${y}`);
            }
        }
        return ids;
    }

    async update(camera, viewport, zoom, onDataUpdate) {
        if (!this.isLoaded) return;
        
        const neededIds = this.getVisibleTileIds(camera, viewport, zoom);
        const toLoad = neededIds.filter(id => !this.loadedTiles.has(id));
        const toUnload = Array.from(this.loadedTiles.keys()).filter(id => !neededIds.includes(id));

        // Unload old tiles to save memory
        toUnload.forEach(id => {
            this.loadedTiles.delete(id);
        });

        // Load new tiles
        if (toLoad.length > 0) {
            const manifests = this.manifest.tiles.filter(t => toLoad.includes(t.id));
            
            await Promise.all(manifests.map(async (m) => {
                const res = await fetch(m.url);
                const data = await res.json();
                this.loadedTiles.set(m.id, data);
            }));

            // Aggregate all loaded data
            const allNodes = [];
            const allEdges = [];
            this.loadedTiles.forEach(tile => {
                allNodes.push(...tile.nodes);
                allEdges.push(...tile.edges);
            });

            onDataUpdate({ nodes: allNodes, edges: allEdges });
        }
    }
}

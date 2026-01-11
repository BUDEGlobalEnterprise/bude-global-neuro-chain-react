# Bude Global Neuro-Chain

[简体中文](./README_CN.md) | English

**Innovation Network Visualization Platform**  
*From Fire to AGI: The Neural Blueprint of Human Ingenuity*

---

## 🌐 Quick Links

- **[Live Experience](https://invent.budeglobal.in/)** - Interactive visualization platform
- **[Documentation](https://budeglobal.in/docs/neuro-chain)** - Technical specifications
- **[Community](https://budeglobal.in/community)** - Join researchers and developers
- **[GitHub Repository](https://github.com/BUDEGlobalEnterprise/bude-global-neuro-chain-react)** - Source code
- **[Academic Paper](https://arxiv.org/abs/neuro-chain)** - Methodology (pending publication)

---

## 🌌 Platform Overview

![Neuro Chain Hero](public/images/neuro_chain_hero.png)

**Neuro-Chain** transforms historical innovation data into an interactive neural network, revealing the complex dependencies and evolutionary pathways of human technology from primitive fire to artificial general intelligence. It replaces linear timelines with a **physics-based simulation** of knowledge propagation.

---

## 🚀 Core Features

### Visual Intelligence
- **Dynamic Signal Propagation** - Click any node to watch "knowledge pulses" travel along historical connections (Bezier curves).
- **Multi-Physics Layout Engine** - Instantly switch between **Force-Directed** (Organic), **Grid** (Structured), and **Radial** (Hierarchical) layouts.
- **12 Visualization Themes** - Custom visual paradigms including *Neuro* (Deep Space), *Cyberpunk*, *Cosmos*, and *Blueprint*.
- **Real-time Editing** - Modify nodes, edges, and clusters live in the browser via the Data Editor.

### Data Architecture
- **JSON-Based Knowledge Graph** - History stored in pure, version-controlled JSON files.
- **Schema-Driven Evolution** - extensible metadata for temporal and impact analysis.
- **Live Data Editor** - In-browser JSON editor with validation.

### Performance & Scalability
- **GPU-Accelerated Rendering** - Canvas 2D engine optimized for 10,000+ nodes.
- **Incremental Loading** - Efficient spatial indexing for large datasets.
- **Memoized Components** - React optimization for stable 60fps interactions.
- **Zero-Dependency Core** - Custom-built physics engine for maximum control.

---

## 🏗️ Project Structure

We follow a clean, modular React architecture:

```
src/
├── components/          # 🧩 UI & Visualization Components
│   ├── CanvasNetwork.jsx  # 🕸️ CORE: Physics simulation & Rendering engine
│   ├── ViewSettings.jsx   # ⚙️ Theme & Layout controls
│   ├── DataEditor.jsx     # 📝 Live JSON editor
│   ├── SearchBar.jsx      # 🔍 Smart search with camera focus
│   └── ... (StatsPanel, Minimap, Legend)
├── config/
│   └── themes.js        # 🎨 THEMES: Definitions for 12+ visual styles & physics
├── data/                # 💾 DATA: Knowledge Graph Storage
│   ├── nodes.json         # 78+ Historical Innovation Nodes
│   ├── edges.json         # 113+ Dependency Connections
│   ├── clusters.json      # 9 Thematic Groupings
│   └── descriptions.json  # 📘 Encyclopedia Content
├── utils/
│   ├── SoundManager.js    # 🔊 Audio Feedback System
│   └── viewportCulling.js # ⚡ Performance Optimization
└── styles/              # 💅 CSS Modules
```

---

## 📊 Data Schema

The history of innovation is fully editable via `src/data/`.

### Node Definition (`nodes.json`)
```json
{
  "id": "quantum_computing",
  "label": "Quantum Computing",
  "cluster": "information",
  "year": 2011,
  "x": 450, "y": 320,      // Initial position (Physics takes over)
  "size": 25,
  "description": "Exploiting quantum mechanics for computation..."
}
```

### Edge Definition (`edges.json`)
```json
{
  "source": "transistor",
  "target": "integrated_circuit",
  "type": "forward"        // 'forward' (Solid) or 'backlink' (Dashed)
}
```

---

## 📦 Installation

### Prerequisites
- Node.js 18+
- Modern browser with WebGL/Canvas support

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/BUDEGlobalEnterprise/bude-global-neuro-chain-react.git
cd bude-global-neuro-chain-react

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open in browser (typically http://localhost:5173)
```

### Deployment
This project is **100% Static**.
```bash
# Build production bundle
npm run build

# Preview locally
npm run preview
```
Deploy the `dist/` folder to **GitHub Pages**, **Vercel**, **Netlify**, or **Cloudflare Pages**.

---

## 🧪 Research & Analysis

### Applications
1.  **Historical Analysis**: Visualize technological dependencies across eras.
2.  **Innovation Forecasting**: Identify "adjacent possible" breakthroughs.
3.  **Educational Pathways**: Interactive curriculum mapping.

### Performance Targets

| Metric | v1.0 | v2.0 (Current) | Target v3.0 |
|--------|------|----------------|-------------|
| Nodes Rendered | 78 | 500+ | 10,000+ |
| Frame Rate | 45fps | **60fps** | 60fps stable |
| Load Time | 2.8s | 1.2s | <800ms |

---

## 🤝 Contributing

**We want YOU to build the future of visualization.**

1.  **Fork** the repository.
2.  **Create** a feature branch (`git checkout -b feature/AmazingTheme`).
3.  **Commit** your changes (`git commit -m 'Add AmazingTheme'`).
4.  **Push** to the branch (`git push origin feature/AmazingTheme`).
5.  **Open** a Pull Request.

**Areas of Interest:**
- New historical data points (fill the gaps!)
- Creative visual themes (`src/config/themes.js`)
- Physics engine optimizations

---

## 📝 License & Citation

### License
**GNU GENERAL PUBLIC LICENSE Version 3**  
Free to use, modify, and distribute for open-source projects.  
See [LICENSE](LICENSE) for details.

### Citation
```
Govindhasamy, A. (2024). Neuro-Chain: A Network Visualization Platform 
for Technological Evolution Analysis. Bude Global.
URL: https://invent.budeglobal.in/
```

### Commercial Use
For commercial integration or enterprise licensing, contact [enterprise@budeglobal.in](mailto:enterprise@budeglobal.in).

---

**Bude Global Neuro-Chain**  
*Visualizing the connected intelligence of human civilization*

Copyright © 2024 Bude Global. All rights reserved.
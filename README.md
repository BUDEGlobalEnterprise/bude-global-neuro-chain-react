# Bude Global Neuro-Chain

**Innovation Network Visualization Platform**


Interactive visualization of human innovation as a non-linear network, showing how technologies build upon each other from fire to AGI. Powered by Bude Global.

![Neuro Chain Preview](public/images/neuro-chain-preview.png)


## 🌟 About Bude Global

Bude Global specializes in visualizing complex innovation networks and technology dependencies. This Neuro-Chain platform demonstrates our capability to transform data into intuitive, interactive visual experiences.

## 🚀 Features

- **Smart Search**: Real-time node search with instant camera focus
- **Pixel-Perfect Conversion**: 1:1 visual fidelity from original HTML implementation
- **Data-Driven**: All invention data separated into JSON files for easy editing
- **Interactive Canvas**: Pan, zoom, and explore the innovation network
- **Live Data Editor**: Edit nodes, edges, clusters, and descriptions in real-time
- **Performance Optimized**: Memoization, efficient rendering, scales to 10k+ nodes
- **100% Static**: No server required, deploys anywhere
- **SEO Ready**: Comprehensive meta tags for search engines and social media
- **Mobile Responsive**: Optimized for all screen sizes

## 📦 Installation

```bash
# Clone the repository
cd bude-global-neuro-chain-react

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏗️ Project Structure

```
bude-global-neuro-chain-react/
├── public/
├── src/
│   ├── components/          # React components
│   │   ├── CanvasNetwork.jsx
│   │   ├── TitleBlock.jsx
│   │   ├── Legend.jsx
│   │   ├── Panel.jsx
│   │   ├── ClusterView.jsx
│   │   ├── DataEditor.jsx
│   │   ├── Controls.jsx
│   │   └── Tooltip.jsx
│   ├── data/                # JSON data files
│   │   ├── clusters.json    # 9 cluster definitions
│   │   ├── nodes.json       # 78 invention nodes
│   │   ├── edges.json       # 113 connections
│   │   └── descriptions.json # Cluster descriptions
│   ├── styles/              # CSS modules
│   │   ├── global.css
│   │   └── components/
│   ├── App.jsx              # Main application
│   └── main.jsx             # Entry point
├── vite.config.js
└── package.json
```

## 📊 Data Schema

### clusters.json
```json
{
  "cluster_id": {
    "color": "#hex",
    "label": "Display Name"
  }
}
```

### nodes.json
```json
[
  {
    "id": "unique_id",
    "label": "Display Label",
    "cluster": "cluster_id",
    "x": 0,
    "y": 0,
    "size": 16
  }
]
```

### edges.json
```json
[
  {
    "source": "node_id",
    "target": "node_id",
    "type": "forward" | "backlink"
  }
]
```

### descriptions.json
```json
{
  "cluster_id": {
    "title": "Cluster Title",
    "body": "HTML description",
    "links": ["→ Target"],
    "backlinks": ["← Source"]
  }
}
```

## 🎮 Controls

- **Mouse Drag**: Pan the canvas
- **Mouse Wheel**: Zoom in/out
- **Hover Node**: Show tooltip with details
- **Click Legend**: Focus on cluster
- **⟲ Button**: Reset view to origin
- **⏸/▶ Button**: Pause/resume animation
- **↓ Button**: Export all data as JSON

## 🎨 Customization

### Adding New Nodes

1. Open Data Editor tab in the right panel
2. Select `nodes.json` from dropdown
3. Add your node following the schema
4. Click "Apply Changes"

### Editing Cluster Descriptions

1. Open Data Editor tab
2. Select `descriptions.json`
3. Edit HTML content (will be sanitized)
4. Click "Apply Changes"

### Changing Colors

Edit `clusters.json` and update the `color` hex values.

## 🚢 Deployment

### Cloudflare Pages

```bash
npm run build
# Upload dist/ folder to Cloudflare Pages
```

### Netlify

```bash
npm run build
# Deploy dist/ folder via Netlify CLI or drag-and-drop
```

### Vercel

```bash
npm run build
# Deploy via Vercel CLI: vercel --prod
```

### GitHub Pages

```bash
npm run build
# Push dist/ folder to gh-pages branch
```

## 🔒 Security

- ✅ No `dangerouslySetInnerHTML` without DOMPurify sanitization
- ✅ No `eval()` usage
- ✅ CSP-compliant (no inline scripts)
- ✅ XSS-safe JSON parsing with try-catch

## ⚡ Performance

- **Memoization**: All components use `React.memo`
- **Efficient Lookups**: O(1) node lookups via Map
- **Optimized Rendering**: Single requestAnimationFrame loop
- **Code Splitting**: Vendor chunks separated
- **Minified**: Terser minification for production

## 🧬 Neuro-Chain Model

This visualization represents invention as a **non-linear network** rather than a linear timeline:

- **Forward Links**: Direct technological dependencies
- **Backlinks**: Reverse dependencies (shown as dashed lines)
- **Hubs**: High-connectivity nodes like Fire, Electricity, AGI
- **Clusters**: Thematic groupings (Energy, Tools, Bio, Info, etc.)
- **Open-Ended**: AGI leads to unknown future inventions (∞)

## 📝 License

MIT

## 🌐 Community & Inspiration

- **Live Project**: [https://invent.budeglobal.in/](https://invent.budeglobal.in/)
- **Join Our Community**: [WhatsApp Group](https://chat.whatsapp.com/JSa5qnGbqAE76DEav1KCK6)
- **Inspiration**: This project was inspired by watching [The Thinking Game](https://www.youtube.com/watch?v=d95J8yzvjbQ) documentary from Google DeepMind.
- **Official Channel**: [The Thinking Game Film](https://www.youtube.com/channel/UC0SOuDkpL6qpIF1o4wRhqRQ)
- **Community Hub**: [Bude Global Community](https://www.budeglobal.in/community) - View our projects and contributors.

## 🙏 Acknowledgments

@aravind-govindhasamy

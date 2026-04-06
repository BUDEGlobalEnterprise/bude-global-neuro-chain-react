# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [1.1.0] - 2025-01-13

### Added
- Gesture control via MediaPipe hand tracking (Web Worker offloaded)
- Cinematic HUD with scanning lines, lock-on crosshairs, spatial ripples
- Dynamic LOD (Level of Detail) during active movement for 60FPS stability
- Chinese README translation (`i18n/README_CN.md`) by @asong56
- Tamil, Hindi, Spanish README translations

### Changed
- Gesture detection moved off main thread for zero-lag precision

## [1.0.0] - 2024-12-01

### Added
- Initial React + Vite port of the original HTML visualization
- 715 innovation nodes, 1,817 connections, 9 thematic clusters
- Force-directed, radial, and temporal layout engines
- Live JSON data editor with real-time preview
- Smart search with instant camera focus
- Export to CSV, GraphML, JSON
- 12 visualization themes (Neuro, Cyberpunk, Cosmos, Blueprint, …)
- MediaPipe hand tracking integration
- Full mobile responsiveness
- SEO meta tags and Open Graph support
- Cloudflare Pages deployment via `wrangler.jsonc`

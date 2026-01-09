import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'images/budeglobal_logo.png'],
        manifest: {
          name: 'Bude Global Neuro-Chain',
          short_name: 'Neuro-Chain',
          description: 'Visualize the history of human innovation.',
          theme_color: '#0a0a0f',
          icons: [
            {
              src: 'images/budeglobal_logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    base: './', // Relative paths for deployment flexibility

    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '1.0.0'),
      __DEV__: mode === 'development',
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development',
      minify: 'terser',

      // Terser options for production
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
        },
      },

      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'utils': ['dompurify'],
          },
        },
      },
    },

    // Development server settings
    server: {
      port: 3000,
      open: true,
      cors: true,
    },

    // Preview server settings (for npm run preview)
    preview: {
      port: 4173,
    },
  };
});

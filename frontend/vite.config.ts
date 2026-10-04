import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    // Increase warning limit (our app is legitimately large)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-leaflet': ['leaflet', 'react-leaflet', '@react-leaflet/core'],
          'vendor-charts':  ['chart.js', 'react-chartjs-2'],
          'vendor-motion':  ['framer-motion'],
          'vendor-icons':   ['react-icons'],
        },
      },
    },
    // Sourcemaps for production debugging (optional — remove for smallest bundle)
    sourcemap: false,
    // Target modern browsers
    target: 'es2020',
  },
  // Optimise deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'leaflet', 'framer-motion'],
  },
})

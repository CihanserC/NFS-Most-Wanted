/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Üçüncü taraf kodu önbelleklenebilir ve paralel inen parçalara böler: uygulama kodu değişince
 * büyük kütüphaneler yeniden indirilmez. Rapier (WASM) ve sürüş kodu zaten tembel yüklenir.
 */
const vendorGroups = [
  { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 },
  {
    name: 'r3f',
    test: /node_modules[\\/](@react-three|postprocessing|n8ao|maath|three-stdlib|three-mesh-bvh|meshline|camera-controls|stats-gl|troika[^\\/]*|webgl-sdf-generator|bidi-js)[\\/]/,
    priority: 20,
  },
  {
    name: 'react',
    test: /node_modules[\\/](react|react-dom|scheduler|its-fine|react-reconciler|zustand|immer|suspend-react|use-sync-external-store)[\\/]/,
    priority: 10,
  },
];

export default defineConfig({
  // GitHub Pages alt yolda yayınlar (/<depo>/); yerelde ve testte kök
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: vendorGroups } },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Fizik turu ve jant üretimi testleri paralel çalışırken 5 sn'yi aşabilir
    testTimeout: 60_000,
  },
});

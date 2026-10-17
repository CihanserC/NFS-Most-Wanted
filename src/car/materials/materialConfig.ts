/**
 * Araç parçalarının sabit materyal ayarları. Boya bölgeleri buradan değil,
 * BuildState.paint'ten gelir (bkz. carPaintMaterial.ts).
 */
export const materialConfig = {
  chrome: { color: '#ffffff', metalness: 1, roughness: 0.04 },
  aluminum: { color: '#c8ccd2', metalness: 1, roughness: 0.28 },
  rubber: { color: '#111112', metalness: 0, roughness: 0.92 },
  blackTrim: { color: '#0d0d0f', metalness: 0.2, roughness: 0.55 },
  carbon: {
    color: '#1a1b1f',
    metalness: 0.35,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  },
  vinylTop: { color: '#121214', metalness: 0, roughness: 0.75, sheen: 0.4, sheenRoughness: 0.8 },
  glass: { color: '#0b1014', metalness: 0, roughness: 0.04, opacity: 0.38 },
  underbody: { color: '#060607', metalness: 0, roughness: 1 },
  interior: { color: '#1a1714', metalness: 0, roughness: 0.85 },
  engineBlock: { color: '#3b3f46', metalness: 0.6, roughness: 0.45 },
  engineAccent: { color: '#7d1d12', metalness: 0.3, roughness: 0.4, clearcoat: 1 },
  cage: { color: '#2e3034', metalness: 0.7, roughness: 0.35 },
  headlightLens: { color: '#f2f0e6', emissive: '#ffe9b8', emissiveIntensity: 0.6, roughness: 0.05 },
  ledHalo: { color: '#ffffff', emissive: '#cfe8ff', emissiveIntensity: 3 },
  tailLens: { color: '#7a0b0b', emissive: '#ff1a10', emissiveIntensity: 0.5, roughness: 0.1 },
  tailSmoked: { color: '#1d0606', emissive: '#ff1a10', emissiveIntensity: 0.18, roughness: 0.08 },
  ledStrip: { color: '#ff2a1a', emissive: '#ff1a10', emissiveIntensity: 2.5 },
} as const;

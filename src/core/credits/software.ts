/** Oyunun kullandığı açık kaynak yazılımlar (credits ekranında gösterilir). Lisanslar paketlerden doğrulandı. */
export type SoftwareCredit = { name: string; license: string; url: string; usedFor: string };

export const SOFTWARE_CREDITS: SoftwareCredit[] = [
  { name: 'three.js', license: 'MIT', url: 'https://threejs.org', usedFor: '3D çizim' },
  { name: 'React', license: 'MIT', url: 'https://react.dev', usedFor: 'Arayüz' },
  {
    name: 'React Three Fiber / drei',
    license: 'MIT',
    url: 'https://github.com/pmndrs/react-three-fiber',
    usedFor: 'React ile three.js, yardımcı bileşenler',
  },
  {
    name: 'postprocessing',
    license: 'Zlib',
    url: 'https://github.com/pmndrs/postprocessing',
    usedFor: 'Bloom, ton eşleme, alan derinliği, kenar yumuşatma',
  },
  {
    name: 'N8AO',
    license: 'ISC',
    url: 'https://github.com/N8python/n8ao',
    usedFor: 'Ortam örtülmesi (AO)',
  },
  {
    name: 'Rapier',
    license: 'Apache-2.0',
    url: 'https://rapier.rs',
    usedFor: 'Test sürüşü fiziği',
  },
  {
    name: 'Zustand',
    license: 'MIT',
    url: 'https://github.com/pmndrs/zustand',
    usedFor: 'Durum yönetimi',
  },
  {
    name: 'Immer',
    license: 'MIT',
    url: 'https://immerjs.github.io/immer',
    usedFor: 'Değişmez durum güncellemeleri',
  },
  {
    name: 'Draco / Basis Universal',
    license: 'Apache-2.0',
    url: 'https://github.com/google/draco',
    usedFor: 'Model ve doku sıkıştırma çözücüleri',
  },
];

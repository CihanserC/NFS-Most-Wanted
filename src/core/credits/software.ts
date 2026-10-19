/** Oyunun kullandığı açık kaynak yazılımlar (credits ekranında gösterilir). Lisanslar paketlerden doğrulandı. */
/** usedForKey: kullanım amacının çeviri anahtarı (i18n) */
export type SoftwareCredit = { name: string; license: string; url: string; usedForKey: string };

export const SOFTWARE_CREDITS: SoftwareCredit[] = [
  { name: 'three.js', license: 'MIT', url: 'https://threejs.org', usedForKey: 'software.threejs' },
  { name: 'React', license: 'MIT', url: 'https://react.dev', usedForKey: 'software.react' },
  {
    name: 'React Three Fiber / drei',
    license: 'MIT',
    url: 'https://github.com/pmndrs/react-three-fiber',
    usedForKey: 'software.r3f',
  },
  {
    name: 'postprocessing',
    license: 'Zlib',
    url: 'https://github.com/pmndrs/postprocessing',
    usedForKey: 'software.postprocessing',
  },
  {
    name: 'N8AO',
    license: 'ISC',
    url: 'https://github.com/N8python/n8ao',
    usedForKey: 'software.n8ao',
  },
  {
    name: 'Rapier',
    license: 'Apache-2.0',
    url: 'https://rapier.rs',
    usedForKey: 'software.rapier',
  },
  {
    name: 'Zustand',
    license: 'MIT',
    url: 'https://github.com/pmndrs/zustand',
    usedForKey: 'software.zustand',
  },
  {
    name: 'Immer',
    license: 'MIT',
    url: 'https://immerjs.github.io/immer',
    usedForKey: 'software.immer',
  },
  {
    name: 'Draco / Basis Universal',
    license: 'Apache-2.0',
    url: 'https://github.com/google/draco',
    usedForKey: 'software.decoders',
  },
];

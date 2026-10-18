import { CURRENT_BUILD_VERSION, type BuildState } from './types';

type RawBuild = Record<string, unknown> & { version: number };

/**
 * migrations[n], `version: n` olan bir kaydı `version: n + 1`'e taşır.
 * Yeni bir BuildState sürümü eklendiğinde buraya bir fonksiyon eklenir.
 */
const migrations: Record<number, (raw: RawBuild) => RawBuild> = {
  // 0 -> 1: Faz 1 öncesi taslak kayıtlar `parts` yerine `slots` kullanıyordu.
  0: (raw) => {
    const { slots, ...rest } = raw;
    return { ...rest, parts: slots ?? {}, version: 1 };
  },
  // 1 -> 2: boya sistemi. Bölgeler manifestten bilinir; deserialize varsayılanla doldurur.
  1: (raw) => ({ ...raw, paint: {}, version: 2 }),
  // 2 -> 3: jant, lastik, fren. deserialize varsayılanlarla doldurur.
  2: (raw) => ({ ...raw, wheels: {}, tires: {}, brakes: {}, version: 3 }),
  // 3 -> 4: vinil katmanları.
  3: (raw) => ({ ...raw, vinyl: [], version: 4 }),
  // 4 -> 5: duruş, cam filmi, ışıklar. deserialize varsayılanlarla doldurur.
  4: (raw) => ({ ...raw, stance: {}, glass: {}, lighting: {}, version: 5 }),
  // 5 -> 6: performans parçaları. deserialize varsayılanlarla doldurur.
  5: (raw) => ({ ...raw, performance: {}, version: 6 }),
};

export class BuildMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildMigrationError';
  }
}

export function migrateBuild(input: unknown): BuildState {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new BuildMigrationError('Kayıt bir nesne değil');
  let raw = input as RawBuild;
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version))
    throw new BuildMigrationError('Kayıtta geçerli bir "version" alanı yok');
  if (raw.version > CURRENT_BUILD_VERSION)
    throw new BuildMigrationError(
      `Kayıt sürümü (${raw.version}) bu oyun sürümünden (${CURRENT_BUILD_VERSION}) yeni`,
    );

  while (raw.version < CURRENT_BUILD_VERSION) {
    const step = migrations[raw.version];
    if (!step) throw new BuildMigrationError(`${raw.version} sürümü için migration yok`);
    raw = step(raw);
  }
  return raw as unknown as BuildState;
}

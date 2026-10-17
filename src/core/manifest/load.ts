import type { CarManifest } from './types';
import { validateManifest } from './validate';

export class ManifestError extends Error {
  readonly errors: string[];

  constructor(source: string, errors: string[]) {
    super(`Geçersiz araç manifesti (${source}):\n  - ${errors.join('\n  - ')}`);
    this.name = 'ManifestError';
    this.errors = errors;
  }
}

/** Ham JSON'u doğrular; hatalıysa tüm sorunları listeleyen ManifestError fırlatır. */
export function loadManifest(json: unknown, source = 'bilinmeyen kaynak'): CarManifest {
  const result = validateManifest(json);
  if (!result.ok) throw new ManifestError(source, result.errors);
  return result.value;
}

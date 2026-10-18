import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  createDefaultBuild,
  fitmentOf,
  isValidPart,
  withFitment,
  withPaint,
  withPart,
  withVinyl,
  withLook,
  withPerformance,
  normalizeLook,
} from '../build/build';
import { emptyHistory, record, redo, undo, type History } from '../build/history';
import type { BuildState, LookFields } from '../build/types';
import type { PerformanceConfig } from '../performance/performance';
import type { CarManifest } from '../manifest/types';
import { sanitizePaint } from '../paint/paint';
import { cleanName } from '../storage/garageService';
import type { PaintConfig } from '../paint/types';
import type { VinylLayer } from '../vinyl/types';
import type { FitmentState } from '../wheels/types';
import { normalizeFitment } from '../wheels/wheels';

export type PartPreview = { slotId: string; optionId: string };
/** Sürükleme/hover sırasında geçici boya; geçmişe yazılmaz. */
export type PaintPreview = Record<string, PaintConfig>;

export type BuildStoreState = {
  /** Şu an düzenlenen aracın manifesti (araç değişince güncellenir) */
  manifest: CarManifest;
  build: BuildState;
  history: History<BuildState>;
  /** Üzerine gelinen parça; onaylanmazsa clearPreview ile geri alınır. */
  preview: PartPreview | null;
  paintPreview: PaintPreview | null;
  /** Jant/lastik/fren geçici önizlemesi (normalize edilmiş tam durum). */
  fitmentPreview: FitmentState | null;
  /** Vinil sürükleme önizlemesi (tam katman listesi) */
  vinylPreview: VinylLayer[] | null;
  /** Duruş/cam/ışık önizlemesi (normalize edilmiş) */
  lookPreview: LookFields | null;
  setPart: (slotId: string, optionId: string) => void;
  previewPart: (slotId: string, optionId: string) => void;
  clearPreview: () => void;
  /** Bir veya birden fazla bölgeyi tek geçmiş adımıyla boyar. */
  setPaint: (paint: Record<string, PaintConfig>) => void;
  previewPaint: (paint: Record<string, PaintConfig>) => void;
  /** Geçici boyayı kalıcı yapar (slider bırakılınca vb.). */
  commitPaintPreview: () => void;
  clearPaintPreview: () => void;
  setFitment: (patch: Partial<FitmentState>) => void;
  previewFitment: (patch: Partial<FitmentState>) => void;
  commitFitmentPreview: () => void;
  clearFitmentPreview: () => void;
  setVinyl: (layers: VinylLayer[]) => void;
  previewVinyl: (layers: VinylLayer[]) => void;
  commitVinylPreview: () => void;
  clearVinylPreview: () => void;
  setLook: (patch: Partial<LookFields>) => void;
  previewLook: (patch: Partial<LookFields>) => void;
  commitLookPreview: () => void;
  clearLookPreview: () => void;
  setPerformance: (patch: Partial<PerformanceConfig>) => void;
  /** Proje adı: geçmişe yazılmaz (geri alınabilir bir modifiye değil) */
  setName: (name: string) => void;
  undo: () => void;
  redo: () => void;
  /** Başka bir aracın build'ini yükler: manifest, geçmiş ve önizlemeler sıfırlanır. */
  setCar: (build: BuildState) => void;
  loadBuild: (build: BuildState) => void;
};

const samePaint = (a: PaintConfig | undefined, b: PaintConfig) =>
  a !== undefined && JSON.stringify(a) === JSON.stringify(b);

/**
 * resolveManifest: araç kimliğinden manifest (çok araçlı oyunda araç değişimi için); verilmezse
 * yalnızca ilk manifestin aracı desteklenir.
 */
export const createBuildStore = (
  initialManifest: CarManifest,
  resolveManifest: (carId: string) => CarManifest = (id) => {
    if (id === initialManifest.id) return initialManifest;
    throw new Error(`Bilinmeyen araç: ${id}`);
  },
) => {
  /** Manifestte olmayan bölgeleri atar, değerleri sanitize eder. */
  const cleanPaint = (paint: Record<string, PaintConfig>, manifest: CarManifest) =>
    Object.fromEntries(
      Object.entries(paint)
        .filter(([zone]) => manifest.paintZones.includes(zone))
        .map(([zone, p]) => [zone, sanitizePaint(p)]),
    );

  return create<BuildStoreState>()(
    immer((set, get) => ({
      manifest: initialManifest,
      build: createDefaultBuild(initialManifest),
      history: emptyHistory<BuildState>(),
      preview: null,
      paintPreview: null,
      fitmentPreview: null,
      vinylPreview: null,
      lookPreview: null,

      setPart: (slotId, optionId) => {
        const { build, history, manifest } = get();
        if (!isValidPart(manifest, slotId, optionId))
          throw new Error(`Geçersiz parça: ${slotId}/${optionId}`);
        if (build.parts[slotId] === optionId) {
          set((s) => {
            s.preview = null;
          });
          return;
        }
        set((s) => {
          s.history = record(history, build);
          s.build = withPart(build, slotId, optionId);
          s.preview = null;
        });
      },

      previewPart: (slotId, optionId) => {
        if (!isValidPart(get().manifest, slotId, optionId)) return;
        set((s) => {
          s.preview = { slotId, optionId };
        });
      },

      clearPreview: () =>
        set((s) => {
          s.preview = null;
        }),

      setPaint: (paint) => {
        const { build, history } = get();
        const clean = cleanPaint(paint, get().manifest);
        const changed = Object.entries(clean).some(([z, p]) => !samePaint(build.paint[z], p));
        set((s) => {
          s.paintPreview = null;
          if (!changed) return;
          s.history = record(history, build);
          s.build = withPaint(build, clean);
        });
      },

      previewPaint: (paint) =>
        set((s) => {
          s.paintPreview = cleanPaint(paint, get().manifest);
        }),

      commitPaintPreview: () => {
        const p = get().paintPreview;
        if (p) get().setPaint(p);
      },

      clearPaintPreview: () =>
        set((s) => {
          s.paintPreview = null;
        }),

      setFitment: (patch) => {
        const { build, history } = get();
        const next = withFitment(build, patch);
        const changed = JSON.stringify(fitmentOf(next)) !== JSON.stringify(fitmentOf(build));
        set((s) => {
          s.fitmentPreview = null;
          if (!changed) return;
          s.history = record(history, build);
          s.build = next;
        });
      },

      previewFitment: (patch) =>
        set((s) => {
          s.fitmentPreview = normalizeFitment({ ...fitmentOf(get().build), ...patch });
        }),

      commitFitmentPreview: () => {
        const p = get().fitmentPreview;
        if (p) get().setFitment(p);
      },

      clearFitmentPreview: () =>
        set((s) => {
          s.fitmentPreview = null;
        }),

      setVinyl: (layers) => {
        const { build, history } = get();
        set((s) => {
          s.vinylPreview = null;
          if (layers === build.vinyl) return;
          s.history = record(history, build);
          s.build = withVinyl(build, layers);
        });
      },

      // Düz nesne ile set: immer üretimi (ve büyük listenin her karede dondurulması) atlanır.
      previewVinyl: (layers) => set({ vinylPreview: layers }),

      commitVinylPreview: () => {
        const p = get().vinylPreview;
        if (p) get().setVinyl(p);
      },

      clearVinylPreview: () =>
        set((s) => {
          s.vinylPreview = null;
        }),

      setLook: (patch) => {
        const { build, history } = get();
        const next = withLook(build, patch);
        const pick = (b: LookFields) => JSON.stringify([b.stance, b.glass, b.lighting]);
        set((s) => {
          s.lookPreview = null;
          if (pick(next) === pick(build)) return;
          s.history = record(history, build);
          s.build = next;
        });
      },

      // Düz nesneyle set: kaydırıcı sürüklerken immer maliyeti olmasın.
      previewLook: (patch) => set({ lookPreview: normalizeLook(patch, get().build) }),

      commitLookPreview: () => {
        const p = get().lookPreview;
        if (p) get().setLook(p);
      },

      clearLookPreview: () => set({ lookPreview: null }),

      setName: (name) =>
        set((s) => {
          s.build = { ...s.build, name: cleanName(name), updatedAt: new Date().toISOString() };
        }),

      setPerformance: (patch) => {
        const { build, history } = get();
        const next = withPerformance(build, patch);
        if (JSON.stringify(next.performance) === JSON.stringify(build.performance)) return;
        set((s) => {
          s.history = record(history, build);
          s.build = next;
        });
      },

      undo: () => {
        const r = undo(get().history, get().build);
        if (!r) return;
        set((s) => {
          s.history = r.history;
          s.build = r.present;
          s.preview = null;
          s.paintPreview = null;
          s.fitmentPreview = null;
          s.vinylPreview = null;
          s.lookPreview = null;
        });
      },

      redo: () => {
        const r = redo(get().history, get().build);
        if (!r) return;
        set((s) => {
          s.history = r.history;
          s.build = r.present;
          s.preview = null;
          s.paintPreview = null;
          s.fitmentPreview = null;
          s.vinylPreview = null;
          s.lookPreview = null;
        });
      },

      setCar: (build) => {
        const nextManifest = resolveManifest(build.carId);
        set((s) => {
          s.manifest = nextManifest;
          s.build = build;
          s.history = emptyHistory();
          s.preview = null;
          s.paintPreview = null;
          s.fitmentPreview = null;
          s.vinylPreview = null;
          s.lookPreview = null;
        });
      },

      loadBuild: (build) =>
        set((s) => {
          // Başka araca ait build ise manifest de değişir
          if (build.carId !== s.manifest.id) s.manifest = resolveManifest(build.carId);
          s.build = build;
          s.history = emptyHistory();
          s.preview = null;
          s.paintPreview = null;
          s.fitmentPreview = null;
          s.vinylPreview = null;
          s.lookPreview = null;
        }),
    })),
  );
};

export type BuildStore = ReturnType<typeof createBuildStore>;

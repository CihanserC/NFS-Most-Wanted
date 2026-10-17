import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createDefaultBuild, isValidPart, withPart } from '../build/build';
import { emptyHistory, record, redo, undo, type History } from '../build/history';
import type { BuildState } from '../build/types';
import type { CarManifest } from '../manifest/types';

export type PartPreview = { slotId: string; optionId: string };

export type BuildStoreState = {
  manifest: CarManifest;
  build: BuildState;
  history: History<BuildState>;
  /** Üzerine gelinen parça; onaylanmazsa clearPreview ile geri alınır. */
  preview: PartPreview | null;
  setPart: (slotId: string, optionId: string) => void;
  previewPart: (slotId: string, optionId: string) => void;
  clearPreview: () => void;
  undo: () => void;
  redo: () => void;
  loadBuild: (build: BuildState) => void;
};

export const createBuildStore = (manifest: CarManifest) =>
  create<BuildStoreState>()(
    immer((set, get) => ({
      manifest,
      build: createDefaultBuild(manifest),
      history: emptyHistory<BuildState>(),
      preview: null,

      setPart: (slotId, optionId) => {
        const { build, history } = get();
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
        if (!isValidPart(manifest, slotId, optionId)) return;
        set((s) => {
          s.preview = { slotId, optionId };
        });
      },

      clearPreview: () =>
        set((s) => {
          s.preview = null;
        }),

      undo: () => {
        const r = undo(get().history, get().build);
        if (!r) return;
        set((s) => {
          s.history = r.history;
          s.build = r.present;
          s.preview = null;
        });
      },

      redo: () => {
        const r = redo(get().history, get().build);
        if (!r) return;
        set((s) => {
          s.history = r.history;
          s.build = r.present;
          s.preview = null;
        });
      },

      loadBuild: (build) =>
        set((s) => {
          s.build = build;
          s.history = emptyHistory();
          s.preview = null;
        }),
    })),
  );

export type BuildStore = ReturnType<typeof createBuildStore>;

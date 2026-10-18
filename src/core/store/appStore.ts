import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { VinylSide } from '../vinyl/types';
import type { Axle } from '../wheels/types';

export type AppMode = 'garage' | 'drive';

export type AppState = {
  mode: AppMode;
  turntable: boolean;
  /** Atölye menüsünde seçili kategori ve slot (kamera odağını da belirler). */
  categoryId: string | null;
  slotId: string | null;
  /** Geri dönülünce menü vurgusunun kalacağı son kategori/slot. */
  lastCategoryId: string | null;
  lastSlotId: string | null;
  /** Boya kategorisinde seçili bölge. */
  paintZone: string | null;
  lastPaintZone: string | null;
  /** Jant editöründe düzenlenen aks ve ön/arka bağlı mı (staggered değil). */
  wheelAxle: Axle;
  wheelsLinked: boolean;
  /** Vinil editörü: araca tıklama aracı, yerleştirilecek şekil, seçili katman, görünüm */
  vinylTool: 'select' | 'place';
  vinylShapeId: string;
  /** Seçili katmanlar (grup seçiminde tüm üyeler) */
  selectedLayerIds: string[];
  /** Mıknatıs: taşıma/kaydırmada ızgara ve orta çizgiye yakala */
  vinylSnap: boolean;
  vinylText: string;
  vinylFontId: string;
  vinylView: VinylSide;
  /** Son kullanılan vinil rengi (yeni katmanlara uygulanır) */
  vinylColor: string;
  creditsOpen: boolean;
  setCreditsOpen: (open: boolean) => void;
  setMode: (mode: AppMode) => void;
  toggleTurntable: () => void;
  selectCategory: (categoryId: string | null) => void;
  selectSlot: (slotId: string | null) => void;
  selectPaintZone: (zone: string | null) => void;
  setWheelAxle: (axle: Axle) => void;
  setWheelsLinked: (linked: boolean) => void;
  setVinylTool: (tool: 'select' | 'place') => void;
  setVinylShape: (shapeId: string) => void;
  selectLayers: (ids: string[]) => void;
  setVinylSnap: (on: boolean) => void;
  setVinylText: (text: string) => void;
  setVinylFont: (fontId: string) => void;
  setVinylView: (side: VinylSide) => void;
  setVinylColor: (color: string) => void;
};

export const createAppStore = () =>
  create<AppState>()(
    immer((set) => ({
      mode: 'garage',
      creditsOpen: false,
      setCreditsOpen: (open) =>
        set((s) => {
          s.creditsOpen = open;
        }),
      turntable: true,
      categoryId: null,
      slotId: null,
      lastCategoryId: null,
      lastSlotId: null,
      paintZone: null,
      lastPaintZone: null,
      wheelAxle: 'front',
      wheelsLinked: true,
      vinylTool: 'place',
      vinylShapeId: 'circle',
      selectedLayerIds: [],
      vinylSnap: false,
      vinylText: 'STALLION',
      vinylFontId: 'block',
      vinylView: 'left',
      vinylColor: '#ffffff',
      setMode: (mode) =>
        set((s) => {
          s.mode = mode;
        }),
      toggleTurntable: () =>
        set((s) => {
          s.turntable = !s.turntable;
        }),
      selectCategory: (categoryId) =>
        set((s) => {
          if (s.categoryId !== null) s.lastCategoryId = s.categoryId;
          s.categoryId = categoryId;
          s.slotId = null;
          s.lastSlotId = null;
          s.paintZone = null;
          s.lastPaintZone = null;
        }),
      selectSlot: (slotId) =>
        set((s) => {
          if (s.slotId !== null) s.lastSlotId = s.slotId;
          s.slotId = slotId;
        }),
      selectPaintZone: (zone) =>
        set((s) => {
          if (s.paintZone !== null) s.lastPaintZone = s.paintZone;
          s.paintZone = zone;
        }),
      setWheelAxle: (axle) =>
        set((s) => {
          s.wheelAxle = axle;
        }),
      setWheelsLinked: (linked) =>
        set((s) => {
          s.wheelsLinked = linked;
          if (linked) s.wheelAxle = 'front';
        }),
      setVinylTool: (tool) =>
        set((s) => {
          s.vinylTool = tool;
        }),
      setVinylShape: (shapeId) =>
        set((s) => {
          s.vinylShapeId = shapeId;
        }),
      selectLayers: (ids) =>
        set((s) => {
          s.selectedLayerIds = ids;
        }),
      setVinylSnap: (on) =>
        set((s) => {
          s.vinylSnap = on;
        }),
      setVinylText: (text) =>
        set((s) => {
          s.vinylText = text;
        }),
      setVinylFont: (fontId) =>
        set((s) => {
          s.vinylFontId = fontId;
        }),
      setVinylView: (side) =>
        set((s) => {
          s.vinylView = side;
        }),
      setVinylColor: (color) =>
        set((s) => {
          s.vinylColor = color;
        }),
    })),
  );

export const useAppStore = createAppStore();

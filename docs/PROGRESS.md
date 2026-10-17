# İlerleme

## Aktif faz: Faz 1 — Araç İskeleti ve Slot Sistemi

## Faz 0 — Kurulum ✅ (2026-10-17)

**Yapılanlar**

- Vite 8 + React 19 + TypeScript 6 (strict, `noUncheckedIndexedAccess`) + R3F 9 + drei 10 + postprocessing + Zustand 5 (immer) + Vitest 5 + ESLint 10 (typescript-eslint strict, `no-explicit-any`) + Prettier. Tüm sürümler `package.json`'da sabit.
- Atölye sahnesi: yansımalı zemin (`MeshReflectorMaterial`), prosedürel ortam haritası (drei `Environment` + `Lightformer` softbox'lar), spot + sıcak yan ışık, sis.
- Sınırlı orbit kamera (zemin altına inmez, min/maks mesafe, pan kapalı).
- Döner tablada dönen placeholder kutu (clearcoat'lu `MeshPhysicalMaterial`), `appStore` ile aç/kapa.
- Tüm sahne sayıları `src/garage/scene/sceneConfig.ts` içinde.
- `appStore` birim testleri.

**Notlar / kararlar**

- HDRI dosyası yerine prosedürel `Lightformer` ortamı kullanıldı (ağ/asset bağımlılığı yok). Gerçek HDRI Faz 4'te.
- Proje yolu `&` içerdiği için Windows'ta `node_modules/.bin` shim'leri bozuluyor (cmd `&`'yi komut ayırıcı sayıyor). Bu yüzden npm script'leri araçları doğrudan `node node_modules/<pkg>/...` ile çağırıyor. `npx` bu klasörde çalışmaz; script'leri kullanın.

**Eksik / bilinen sorunlar**

- Işıklandırma kaba; zemin yansıması görünür ama zayıf (atmosfer Faz 4 kapsamında).
- Tek bundle ~1.2 MB (gzip ~340 KB); kod bölme Faz 11'de.
- Rapier henüz eklenmedi (Faz 8).

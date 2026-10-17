# İlerleme

## Aktif faz: Faz 3 — Jant, Lastik, Fren

## Faz 2 — Boya Sistemi ✅ (2026-10-17)

**Yapılanlar**

- **Veri modeli:** `PaintConfig` (tip, ana/2./3. renk, pul boyutu/yoğunluğu/rengi, vernik parlaklığı). `sanitizePaint` (bozuk veriyi düzeltir) ve `validatePaint` (katı) ile doğrulanır.
- **8 boya tipi:** düz, metalik, perleskan, candy, mat, saten, krom, kameleon. Fiziksel davranışları `src/data/paints/types.json`'da (metalness, roughness ve vernik aralıkları, pul gücü, fresnel, sheen, iridescence). `resolvePaint` bunları three'den bağımsız parametrelere çevirir; testler 8 tipin birbirinden ayrıştığını doğrular.
- **Araç boyası shader'ı** (`car/materials/carPaintMaterial.ts`): `MeshPhysicalMaterial` + `onBeforeCompile`.
  - Nesne uzayında prosedürel metal pullar: normal eğme + renk + metalness, uzakta `fwidth` ile yumuşak sönüm.
  - Perleskan renk kayması, candy derinliği (kenarlarda koyu/doygun), kameleonda 3 renk geçişi + `iridescence` (100–800 nm).
  - Tüm boyalar tek shader programını paylaşır; değişiklikler uniform ile yapılır, yeniden derleme gerekmez.
- **Bölgesel boyama:** manifestteki her `paintZone` ayrı boya alır. Bölgeler için `paintZoneCameras` eklendi (opsiyonel, doğrulanıyor).
- **BuildState v2:** `paint` alanı eklendi; v1 → v2 migration yazıldı, eski kayıtlar varsayılan boyayla dolar.
- **Store:** `setPaint` (çok bölge = tek undo adımı), geçici `previewPaint` ve `commitPaintPreview`. Sürüklerken geçmiş şişmez; bırakınca tek adım yazılır.
- **UI:** Boya → bölge → editör.
  - Tip seçici (üzerine gelince önizleme).
  - Renk hedefi sekmeleri (ana / perle tonu / 2.–3. renk / pul rengi), HSV tekerleği + parlaklık kaydırıcısı, hex girişi, kurgusal isimli 16 renklik palet.
  - Vernik ve pul kaydırıcıları, 9 fabrika preseti (8 tipin hepsi var), kullanıcı presetleri (kaydet/sil).
  - "Tüm bölgelere uygula" ve JSON dışa/içe aktarma (panoya kopyalama; tek boya JSON'u da kabul edilir).
- **Ortam:** prosedürel ortam haritasına yan dikey şeritler, ön/arka duvar ve zemin yansıması eklendi; krom ve vernik yansımaları artık okunuyor.
- **Testler:** 70 test (renk dönüşümleri, boya doğrulama/sanitize, JSON gidiş-dönüş ve hata durumları, tip ayrışması, store boya undo/önizleme, migration v1→v2, kullanıcı preseti temizleme).

**Notlar / kararlar**

- Kullanıcı boya presetleri şimdilik `localStorage`'da (`muscle-garage.paint-presets`). Faz 9'da IndexedDB garajına taşınacak.
- Jant, kaliper ve egzoz ucu gibi parçaların materyal ayarları, ilgili parçalar geldikçe aynı `PaintConfig` ile eklenecek (jant/kaliper Faz 3).
- Pul ölçeği ekran çözünürlüğüne göre ayarlandı: varsayılan pul boyutunda pullar 1,5–3 m'de ince parıltı olarak görünür.

**Eksik / bilinen sorunlar**

- Sahne ışığı hâlâ kaba. Boya tiplerinin farkı en iyi döner tablada görülüyor; atmosfer Faz 4'te.
- Renk tekerleği klavyeyle kullanılamıyor (hex girişi ve palet kullanılabiliyor).
- Yeni kayıtların sayfa yenilenince kaybolması Faz 9'da çözülecek (kaydet/yükle).

## Faz 1 — Araç İskeleti ve Slot Sistemi ✅ (2026-10-17)

**Yapılanlar**

- **Manifest:** `src/data/cars/vanta_stallion_70/manifest.json` — §5.2'deki 19 seçenekli slotun tamamı, `cameraPresets` + `defaultCamera`. Elle yazılmış doğrulayıcı (`core/manifest/validate.ts`) tüm hataları `yol: açıklama` biçiminde toplar; yükleyici `ManifestError` fırlatır. Aks mesafesi/tekerlek konumu tutarlılığı, kamera referansları, varsayılan seçenekler kontrol edilir.
- **Parça kataloğu:** `src/data/parts/vanta_stallion_70.json` — her seçenek için `price`, `weightKg`, opsiyonel `downforce` / `trackWidthLimitMm`; manifestle çapraz doğrulanır.
- **Placeholder gövde:** `placeholder.json` profil eğrilerinden (monoton kübik spline) loft edilen alt gövde (tekerlek kemerleri manifestteki `wellClearanceMm`'den türetilir, sert köşelerde ayrık normaller) + fastback kabin (ön/yan/arka cam, tavan, direk bölgeleri materyal gruplarıyla). Blower kesiği kaputta gerçek delik açar; kabin altı iç mekan görünsün diye açıktır. Geometriler parametreye göre cache'lenir.
- **Slot parçaları:** 19 slotun her seçeneği ayrı prosedürel bileşen (`src/car/slots/`). Bağımlı slotlar: egzoz uçları egzoz düzenine göre yerleşir; motor sadece blower kesik kaputta görünür; tavan seçeneği kabin materyalini değiştirir. `registry.ts` her slot için bileşeni TypeScript ile zorunlu kılar.
- **Materyaller:** paylaşılan materyal seti (boya bölgesi başına bir `MeshPhysicalMaterial`, krom, cam, kauçuk, lensler…), unmount'ta `dispose`.
- **BuildState v1:** `parts` + migration altyapısı (v0→v1 örneği), JSON serileştirme, manifeste göre normalize etme.
- **Store:** Zustand + immer; `setPart`, önizleme (`previewPart`/`clearPreview`, geçmişe yazılmaz), undo/redo (100 adım limit).
- **UI:** Most Wanted tarzı kategori → slot → seçenek menüsü (Türkçe, i18n altyapısı `src/i18n`). Üzerine gelince/ok tuşlarıyla önizleme, Enter/tık ile onay, Esc geri, Ctrl+Z / Ctrl+Y. Geri dönüldüğünde vurgu son slotta kalır. Seçili slotun kamera preset'ine yumuşak geçiş; döner tabla slot seçilince aracı 0°'ye çevirir.
- **Testler (47):** manifest doğrulama, parça kataloğu, BuildState/migration/serileştirme, history, store (her slotun her seçeneği takılabilir, ≥100 adım undo), eğri, cache, gövde geometrisi (boyutlar, kemerler, gruplar, kesik), veri tutarlılığı (kategori/slot/çeviri/renderer kapsaması).

**Notlar / kararlar**

- Kamera preset'leri manifestte tanımlandı ve temel ease geçişi şimdiden eklendi (Faz 4'te cilalanacak); slotların `camera` alanı boşa kalmasın diye.
- Kategoriler `src/data/ui/categories.json`'da; içeriği henüz olmayan kategoriler "Yakında" olarak devre dışı.
- `exhaust_tips` ayrı geometri üretmez, uçlar `Exhaust` bileşeninde çizilir.

**Eksik / bilinen sorunlar**

- Tekerlekler basit silindir (Faz 3).
- Gamepad navigasyonu yok (UI cilası sonraki fazlarda).
- Placeholder kaba: tampon uçları, kaput kenarları, kabin-gövde birleşimi basit.
- Undo sonrası menü vurgusu önceki öğede kalabiliyor (önizleme yok, sadece görsel).

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

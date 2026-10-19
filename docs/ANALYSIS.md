# Muscle Garage — Analiz Raporu (Faz 0–11 sonrası)

Tarih: 2026-10-18 · Kaynak: `PROJECT_SPEC.md`, `docs/PROGRESS.md`, kod ve ölçümler · Test makinesi: Intel UHD (entegre GPU), Windows 11, Chrome.

## 1. Özet

Spesifikasyondaki on iki faz (0–11) tamamlandı. Tarayıcıda çalışan, görsel modifiye ağırlıklı bir araç oyunu var: **atölye** (parça/boya/vinil/jant/duruş/ışık/performans editörleri, fotoğraf modu, garaj) ve **test sürüşü** (Rapier fiziği, ≈1,9 km pist, HUD, efektler, ses). Her şey prosedürel placeholder ile çalışıyor; gerçek bir GLB geldiğinde kod değişmeden devreye girmesi için hat, kurallar ve belgeler hazır.

Kabul ölçütleri (`npm run lint`, `npm test`, `npm run build`): hepsi yeşil — **319 test**, 0 lint uyarısı. Doğrulanamayan ana madde: **hedef donanımda (orta seviye masaüstü GPU, 1080p) ≥ 60 FPS** (§14); test makinesi entegre GPU.

| Faz                      | Kabul durumu                                                                  |
| ------------------------ | ----------------------------------------------------------------------------- |
| 0 Kurulum                | ✅                                                                            |
| 1 Araç iskeleti, slotlar | ✅ 19 slot / 57 seçenek, manifest doğrulayıcı, undo/redo                      |
| 2 Boya                   | ✅ 8 tip, bölgesel boya, JSON preset                                          |
| 3 Jant/lastik/fren       | ✅ 6 stil, staggered, fitment uyarısı, geometri önbelleği                     |
| 4 Atmosfer               | ✅ görsel; ⚠️ 60 FPS hedefi hedef donanımda ölçülmedi                         |
| 5–6 Vinil                | ✅ temel + gelişmiş; gözle doğrulandı (Faz 11'de)                             |
| 7 Duruş/cam/ışık         | ✅                                                                            |
| 8 Test sürüşü            | ✅ atölyeden piste geçiş, tur zamanı, burnout, atölyeye dönüş (build korunur) |
| 9 Kaydet/yükle, fotoğraf | ✅ IndexedDB garaj, otomatik kayıt, JSON, PNG (1–4×)                          |
| 10 Gerçek model hattı    | ✅ hat ve yedekleme kanıtlandı; ⚠️ gerçek model/Draco-KTX2'li dosya yok       |
| 11 Optimizasyon/cila     | ✅ ölçüm, bölünmüş paket, uyarlanabilir kalite, kredi, ses, gamepad           |

## 1b. Güncelleme (2026-10-19, V2 + kullanıcı geri bildirimi)

- **İki araç:** Vanta Stallion '70 (prosedürel) ve 2013 Ford Mustang GT (gerçek GLB, `modelMap.json` eşlemesi). Mustang'in overlay parçaları gerçek modelden ışın izlemeyle ölçülen **yüzey haritasına** (`surface.json`) oturur.
- **Sürüş:** direksiyon açısı lastiğin tepe kayma açısıyla sınırlı (tam direksiyon artık tutuşu düşürmüyor; 100 km/s'te dönüş yarıçapı 97 → 62 m, yanal ≈1,1 g); kesintisiz bariyer zinciri (kapsül çarpışma); araca kilitli kamera; çekiş kontrolü + ters direksiyon yardımı; çimde ayrı boyuna çekiş.
- **HUD:** analog devir saati + dijital hız/vites; kontroller Esc menüsünde.
- **Dil:** İngilizce (varsayılan) + Türkçe, kalıcı seçim; iki sözlüğün anahtar eşitliği testte.
- **Testler:** 386 / 40 dosya (bkz. `PROGRESS.md`).

## 2. Mimari

- **Veri odaklı:** araç manifesti, parça kataloğu, boya/jant/duruş/performans/pist verileri JSON; kodda sihirli sayı yok (görsel ayarlar `sceneConfig`, `materialConfig`, fizik sabitleri adlandırılmış sabitlerde).
- **Saf mantık / ince sunum:** `src/core/*` three ve React'ten bağımsız (build, migration, fitment, duruş, performans, pist, tur zamanı, güç aktarma, model kuralları, depolama, gamepad eşlemesi). Sahne bileşenleri bu mantığı çizer. Bu ayrım sayesinde fizik bile başsız (Node'da Rapier) test edilebiliyor.
- **Tek kaynak `BuildState` (v6):** sürümlü + migration zinciri (v0→v6), `deserialize` manifeste göre normalize eder. Atölye, test sürüşü, kayıt ve JSON paylaşımı aynı nesneyi kullanır.
- **Önizleme deseni:** hover/sürükleme geçici durumları (`*Preview`) geçmişe yazılmaz, bırakınca tek undo adımı olur.
- **Hat:** `CarRig → CarShell → (model | placeholder + yedek slotlar)`; tekerlekler, boya, vinil, cam/far senkronu ve underglow modelden bağımsız.
- **Modüller:** `app`, `core` (store, build, manifest, paint, wheels, stance, performance, vinyl, drive, model, storage, input, graphics, credits), `car`, `vinyl`, `garage`, `drive`, `audio`, `data`, `i18n`.

## 3. Metrikler

| Ölçüt          | Değer                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kod            | ≈18,1 bin satır TS/TSX (testler hariç), 3,7 bin satır test, 1,4 bin satır CSS, 1,5 bin satır veri JSON; 199 dosya                                                                 |
| Test           | 386 test / 40 dosya (2026-10-19): saf mantık, depolama (gerçek IndexedDB + bellek), gerçek Mustang GLB, **Rapier fiziği** (sürüş hissi, bariyer, kapı direği), otopilotla tam tur |
| Tip güvenliği  | `strict`, `noUncheckedIndexedAccess`; gerçek `any` yalnız bir testte (gerekçeli); 5 `eslint-disable` (gerekçeli)                                                                  |
| Paket (gzip)   | uygulama 79 KB + three 234 KB + r3f 260 KB + react 69 KB ≈ 640 KB; sürüş kodu 1,7 MB (tembel)                                                                                     |
| İlk çizim      | 2,67 sn (üretim, entegre GPU); DOM hazır 0,4 sn                                                                                                                                   |
| Atölye sahnesi | 168 mesh, 113 bin üçgen; çizim çağrısı 147 (Düşük) → 479 (Yüksek)                                                                                                                 |
| Sürüş sahnesi  | 113 mesh; Düşük 120 çağrı / 60 FPS, Orta 52 FPS, Yüksek 34 FPS (entegre GPU)                                                                                                      |
| Vinil          | 500 katmanda sürükleme ≈ 17,5 ms/kare (200 katmanla aynı)                                                                                                                         |
| Fizik          | 120 Hz sabit adım; stok 0–100 km/s ≈ 5,2 sn, otopilot turu ≈ 94 sn                                                                                                                |

## 4. Spesifikasyona uygunluk

**Tam karşılanan:** §5.1–5.5 (manifest, slotlar, prosedürel gövde, jant/lastik/fren, duruş), §6 (boya), §7 (vinil, kutu projeksiyonu), §8.1–8.2 (atölye, post-processing, 4 kalite), §8.3 (orbit, slot kamerası, turntable, fotoğraf modu: serbest kamera, FOV, DoF, poz, PNG), §9 (Most Wanted tarzı menü, önizleme, Türkçe + i18n altyapısı, fiyat alanı, gamepad), §10 (pist, Rapier, performans parçaları, kameralar, HUD, efektler, sentezlenmiş ses, duraklat), §11 (BuildState, sürüm+migration, IndexedDB, çoklu slot + önizleme, JSON), §13 (ASSET_GUIDE), §15 (saf mantık testleri, dispose, küçük bileşenler), §16 (kapsam dışı olanlara girilmedi).

**Kısmi / yorumlanan:**

- **HDRI (§8.1):** ayrı HDRI dosyası yerine, sahneyle birebir aynı ışıkları taşıyan prosedürel ortam haritası (Lightformer) kullanıldı (varlık bağımsızlığı).
- **Gamepad ile "tam gezinme" (§9):** menü gezintisi ve sürüş tam; vinil editörünün yerleştirme/gizmo işlemleri işaretçi odaklı, gamepad ile yapılamıyor.
- **Ses (§10.4, §17):** gerçek örnekler yok; Web Audio ile sentezlenmiş motor/egzoz/lastik/menü sesleri (kaynak kararı açık).
- **Test sürüşü ağırlık merkezi / yuvarlanma:** Rapier raycast aracında yan yatma (roll) kontrolü yok; çok sert virajda devrilme 2 sn sonra otomatik düzeltiliyor.
- **Gerçek model (§12 Faz 10):** hat tam, ancak yalnızca kutulardan oluşan örnek GLB ve sentetik GLB'lerle doğrulandı; Draco/KTX2 sıkıştırmalı gerçek dosya denenmedi.

**Henüz yapılmayan (bilinçli kapsam dışı veya içerik bağımlı):** ekonomi, online, mobil, hasar modeli (§16); gerçek 3D model ve gerçek ses dosyaları (içerik).

## 5. Riskler ve açık işler (öncelik sırasıyla)

| #   | Konu                                                                     | Etki                   | Neden açık / önerilen adım                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Hedef donanımda performans doğrulanmadı** (§14: ≥60 FPS Yüksek, 1080p) | Yüksek                 | Test makinesi entegre GPU. Ölçüm altyapısı hazır (FPS + çizim çağrısı/üçgen göstergesi, uyarlanabilir kalite). Hedef donanımda Yüksek/Ultra ölçülmeli; gerekirse yansıma/AO maliyeti (dolgu oranı) ayarlanmalı.                                      |
| 2   | **Gerçek model yok**                                                     | Yüksek (görsel kalite) | Placeholder kaba. `docs/ASSET_GUIDE.md`'ye uygun bir GLB eklenince manifestteki `model` yolu yeterli. Gerçek modelle: çamurluk ölçüleri (`fitment`), egzoz uç konumları, tekerlek çapaları doğrulanmalı.                                             |
| 3   | **Sürüş hissi gerçek oyuncuyla ayarlanmadı**                             | Orta                   | 2026-10-19: direksiyon/tutuş ölçümle düzeltildi (bkz. PROGRESS). Yardımcıların (TC, ters direksiyon) ayarlar arayüzü ve ABS yok; ince ayar için oyuncu testi gerekir. Sabitler: `driving.json`, `drivetrain.ts` (`steerAngle`), `VehiclePhysics.ts`. |
| 4   | **Sıkıştırmalı gerçek GLB (Draco/KTX2) denenmedi**                       | Orta                   | Çözücüler servis ediliyor (HTTP 200 doğrulandı) ama ilk gerçek dosyayla uçtan uca deneme gerekir.                                                                                                                                                    |
| 5   | Roll (yan yatma) kontrolü yok                                            | Düşük-Orta             | Rapier raycast aracında yok; gerekirse anti-roll torku eklenebilir.                                                                                                                                                                                  |
| 6   | PNG indirme ve dosyadan içe aktarma otomasyonla denenmedi                | Düşük                  | Tarayıcı dosya pencereleri otomatikleştirilemedi; mantık testli, 3× yakalama (3840×1894) elle doğrulandı.                                                                                                                                            |
| 7   | Gamepad gerçek cihazla denenmedi                                         | Düşük                  | Eşleme saf fonksiyonlarda test edildi (ölü bölge, tuş tekrarı, kenar algılama); standart eşleme varsayıldı.                                                                                                                                          |
| 8   | Duruş editöründe ön/arka bağlama yok                                     | Düşük                  | Presetler + iki aks ayrı kaydırıcı mevcut; "bağlı" kutusu eklenebilir (jant editöründeki gibi).                                                                                                                                                      |
| 9   | Çok eğimli yüzeylerde vinil gerilmesi                                    | Düşük (bilinen kısıt)  | Spesifikasyonun belirttiği kısıt; normal ağırlıklı yumuşak geçiş uygulandı.                                                                                                                                                                          |
| 10  | `dist` 9,3 MB (≈3 MB kullanılmayan Draco/Basis kopyası)                  | Çok düşük              | Yalnızca dağıtım boyutu; hiç indirilmez.                                                                                                                                                                                                             |
| 11  | Hacimli huzmeler 2×16 bin üçgenlik drei konileri                         | Çok düşük              | Geometri darboğaz değil; istenirse özel düşük poligonlu koniyle değiştirilebilir.                                                                                                                                                                    |

## 6. Bu turda (Faz 11) giderilen eski sorunlar

Gizmo'nun zemin yansımasında görünmesi (Faz 5) · renk tekerleğinin klavyeyle kullanılamaması (Faz 2) · geri al sonrası menü vurgusunun eski öğede kalması (Faz 1) · gamepad navigasyonu eksikliği (Faz 1/§9) · FPS göstergesinin çizim çağrısını yanlış ölçmesi (Faz 4'ten beri) · Ultra/Yüksek kalitenin yavaş cihazlarda kullanıcıyı yalnız bırakması (uyarlanabilir kalite).

Önceki fazlarda not edilip sonradan çözülenler: kayıtların yenilemede kaybolması (Faz 9), jant/lastik/vinil verilerinin kalıcılığı (Faz 9), fitment ölçülerinin gerçek modelden okunması (Faz 10), tekerleklerin dönmemesi (Faz 8, pistte), boya presetlerinin IndexedDB'ye taşınması (Faz 9).

## 7. Teknik borç ve kalite notları

- **Ortam tuzakları** (Windows yolu `&` içeriyor): npm `.bin` shim'leri bozuk, script'ler `node node_modules/<pkg>/…` ile çağrılıyor; `npx` kullanılmaz.
- **Başsız Rapier testleri** gerçek WASM çalıştırır (≈ saniyeler); paralel koşuda uzayabildiği için test zaman aşımı 60 sn.
- **Bağımlılıklar** sabit sürümlü (`package.json`): three 0.186.1, R3F 9.8.2, drei 10.7.9, postprocessing 6.39.5, Rapier 0.21.0 (compat, WASM gömülü), Zustand 5, Vitest 5; geliştirme: fake-indexeddb 6.2.5 (gerçek IndexedDB kodunu test etmek için).
- **Lisanslar:** tüm çalışma zamanı bağımlılıkları MIT/Zlib/ISC/Apache-2.0; kredi ekranında listelenir.
- **Tarayıcı:** yalnızca Chrome'da denendi. Safari/Firefox'ta KTX2/WebGL uzantıları ve `AudioContext` davranışı doğrulanmadı.

## 8. Önerilen sonraki adımlar

1. Hedef donanımda (1080p, Yüksek) FPS ölçümü; gerekirse yansıma çözünürlüğü/AO ayarı.
2. İlk gerçek modeli (CC-BY, parçaları ayrı) `ASSET_GUIDE`'e göre hazırlayıp bağlamak; `fitment`, çapa ve egzoz konumlarını modelden doğrulamak.
3. Sürüş hissi için birkaç kişilik oyun testi; tutuş/süspansiyon/fren sabitlerinin ayarı.
4. Gerçek ses örnekleri (§17 açık karar) ve ikinci araç/ekonomi kararı.
5. Gamepad ile vinil yerleştirme (imleç emülasyonu) ve Safari/Firefox testi.

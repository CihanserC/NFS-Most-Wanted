# Muscle Garage — Proje Spesifikasyonu

> Bu dosya, Claude Code (CLI) için ana proje dokümanıdır. Her oturumun başında bu dosyayı oku, aktif fazı bul ve sadece o fazın kapsamında çalış. Bir faz bitmeden sonrakine geçme.

---

## 1. Vizyon

Tarayıcıda çalışan, **görsel modifiye ağırlıklı**, gerçekçi bir 3D araba modifiye oyunu. Referans his: *Need for Speed: Most Wanted (2005)* atölyesi — karanlık, dramatik ışıklı, yansımalı zeminli bir garaj; araç platformun üzerinde, kamera seçilen parçaya akıcı biçimde odaklanıyor.

İki ana mod:

1. **Atölye (Garage):** Aracın her görsel detayını değiştirme — gövde kiti, boya, katmanlı vinil editörü, jant/lastik, süspansiyon duruşu, ışıklar, camlar.
2. **Test Sürüşü (Test Drive):** Modifiye edilen aracı kısa bir pistte sürme. Görsel değişiklikler (sürüş yüksekliği, jant boyutu, lastik genişliği) sürüşe yansır.

İlk sürümde **tek araç** var: kurgusal bir 1970 tarzı Amerikan muscle fastback. Gerçek marka/model adı, logo veya birebir kopya tasarım **kullanılmayacak**.

- Araç adı: **Vanta Stallion '70** (kurgusal)
- Karakter: uzun kaput, kısa arka, fastback tavan, geniş arka çamurluklar, krom tamponlar, V8 ön motor, arkadan itiş.

---

## 2. Teknoloji Yığını

| Alan | Seçim |
|---|---|
| Dil | TypeScript (`strict: true`) |
| Build | Vite |
| 3D | Three.js |
| React entegrasyonu | React + @react-three/fiber |
| Yardımcılar | @react-three/drei |
| Post-processing | @react-three/postprocessing |
| Fizik | Rapier (@react-three/rapier veya @dimforge/rapier3d-compat — araç kontrolcüsü için doğrudan Rapier API'si gerekebilir) |
| State | Zustand (+ immer middleware) |
| Test | Vitest |
| Lint/format | ESLint + Prettier |

Kurallar:
- Paketlerin güncel kararlı sürümlerini kullan ve `package.json`'da sabitle.
- Ekstra büyük bağımlılık eklemeden önce gerekçesini commit mesajında belirt.
- Tüm araç/parça/boya tanımları **veri odaklı** olsun (JSON/TS config). Kodda sihirli sayı olmasın.

---

## 3. Claude CLI Çalışma Kuralları

1. **Faz faz ilerle.** Her fazın sonunda proje `npm run dev` ile çalışır, `npm run build` hatasız, `npm test` yeşil olmalı.
2. **Asset'e bağımlı olma.** Gerçek 3D model gelene kadar her şey **prosedürel placeholder geometri** ile çalışmalı. Gerçek model geldiğinde sadece manifest ve asset dosyası değişmeli, kod değişmemeli.
3. **Mimari önce.** Parça slot sistemi, build state ve manifest yapısı ilk fazlarda sağlam kurulmalı; görsel cila sonra gelir.
4. Her faz sonunda `docs/PROGRESS.md` dosyasını güncelle: ne yapıldı, ne eksik, bilinen hatalar.
5. Bir karar bu dokümanla çelişiyorsa veya belirsizse, varsayım yapmadan önce kullanıcıya sor.
6. Küçük, anlamlı commit'ler at.

---

## 4. Klasör Yapısı (öneri)

```
src/
  app/                 # Uygulama kabuğu, mod geçişleri (garage <-> drive)
  core/
    build/             # BuildState tipi, serileştirme, undo/redo
    manifest/          # Araç manifest tipi, yükleyici, doğrulayıcı
    store/             # Zustand store'ları
  car/
    CarRig.tsx         # Manifest + BuildState -> 3D araç
    slots/             # Slot render mantığı
    procedural/        # Placeholder gövde, jant, lastik, fren, spoyler, egzoz üreticileri
    materials/         # Boya, krom, kauçuk, cam, far materyalleri
  vinyl/
    editor/            # Vinil editörü UI ve araçları
    render/            # Katmanları texture'a basma, projeksiyon shader'ı
    shapes/            # Şekil kütüphanesi (SVG path tabanlı)
  garage/
    scene/             # Atölye ortamı, ışıklar, platform, zemin
    camera/            # Orbit + slot odaklı kamera sistemi
    ui/                # Most Wanted tarzı menüler
  drive/
    track/             # Prosedürel pist
    vehicle/           # Rapier araç kontrolcüsü
    camera/            # Takip, kaput, tampon kameraları
    hud/               # Hız, devir, tur zamanı
  audio/
  data/
    cars/vanta_stallion_70/manifest.json
    parts/             # Parça katalogları
    paints/            # Boya presetleri
public/
  assets/              # GLB, HDRI, texture'lar
docs/
  PROGRESS.md
  ASSET_GUIDE.md       # Blender model hazırlama kuralları (Faz 10'da yaz)
```

---

## 5. Araç Sistemi

### 5.1 Manifest

Her araç bir `manifest.json` ile tanımlanır. Kod, aracı sadece bu dosya üzerinden tanır.

```json
{
  "id": "vanta_stallion_70",
  "displayName": "Vanta Stallion '70",
  "units": "meters",
  "forwardAxis": "+Z",
  "dimensions": { "length": 4.75, "width": 1.88, "height": 1.32, "wheelbase": 2.74 },
  "massKg": 1560,
  "drivetrain": "RWD",
  "model": null,
  "wheels": {
    "FL": { "position": [0.78, 0.33, 1.42] },
    "FR": { "position": [-0.78, 0.33, 1.42] },
    "RL": { "position": [0.79, 0.33, -1.32] },
    "RR": { "position": [-0.79, 0.33, -1.32] },
    "wellClearanceMm": { "front": 60, "rear": 75 }
  },
  "paintZones": ["body", "roof", "hood", "mirrors", "bumpers"],
  "slots": {
    "bumper_front": {
      "options": ["stock_chrome", "chrome_delete", "pro_touring_lip"],
      "default": "stock_chrome",
      "camera": "front_three_quarter"
    },
    "hood": {
      "options": ["stock", "cowl_induction", "shaker_scoop", "blower_cutout"],
      "default": "stock",
      "camera": "hood_top"
    }
  }
}
```

`model: null` olduğu sürece araç prosedürel placeholder ile çizilir. Manifest, yüklenirken bir doğrulayıcıdan (zod veya el yazımı) geçmeli; hatalı manifest anlaşılır hata vermeli.

### 5.2 Slotlar (Vanta Stallion '70)

| Slot | Seçenekler (ilk sürüm) | Not |
|---|---|---|
| `bumper_front` | Krom stok, bumper delete, pro-touring lip | |
| `bumper_rear` | Krom stok, bumper delete, difüzörlü | |
| `grille` | Stok, mesh, billet | Far yerleşimini etkileyebilir |
| `chin_spoiler` | Yok, klasik chin spoiler, karbon splitter | |
| `hood` | Stok, cowl induction, shaker scoop, blower cutout | Blower cutout seçilince süperşarjör kapaktan görünür |
| `hood_pins` | Yok, krom, siyah | |
| `side_skirts` | Yok, ince, pro-touring | |
| `fenders` | Stok, hafif flare, widebody | Widebody, iz genişliği limitini artırır |
| `spoiler_rear` | Yok, ducktail, klasik kanat, yüksek kanat | |
| `rear_louvers` | Yok, klasik arka cam panjuru | Muscle imzası |
| `roof` | Boyalı, vinyl top (deri dokulu) | |
| `mirrors` | Krom bullet, boyalı yarış, karbon | |
| `headlights` | Yuvarlak halojen, LED halo, gizli far | |
| `taillights` | Stok, füme, LED şerit | |
| `exhaust` | Arka çift, yan çıkış (side pipes), dörtlü | Egzoz sesi tonunu etkiler |
| `exhaust_tips` | Yuvarlak krom, oval, siyah seramik, turn-down | |
| `fuel_cap` | Stok, yarış tipi (pop-open) | |
| `wheels` | Prosedürel (bkz. 5.4) | Ön/arka ayrı ayarlanabilir |
| `tires` | Prosedürel (bkz. 5.4) | Ön/arka ayrı |
| `brakes` | Prosedürel disk + kaliper | |
| `window_tint` | %0 – %95 koyuluk, renk tonu | |
| `underglow` | Yok, renk + yoğunluk | |
| `engine` | Görsel: stok V8, blower V8, hava filtreli, krom kapaklar | Kaput açık/kesik iken görünür |
| `interior` | Stok, roll cage (rollbar) | Faz 7+ |

### 5.3 Prosedürel Placeholder Gövde

- Gövde, profil eğrilerinden (yandan ve üstten görünüm spline'ları) üretilen bir mesh olmalı: uzun kaput, fastback tavan hattı, belirgin arka çamurluk kalçası.
- Her slot için ayrı, değiştirilebilir prosedürel parça üret (tampon için krom bar, kaput scoop'u için kutu/ekstrüzyon, spoyler için ekstrüde profil, vb.).
- Placeholder kaba olabilir ama **oranları doğru** olmalı; amaç sistemin gerçek boyutlarla test edilebilmesi.
- Tekerlek kemerleri, jant boyutu ve sürüş yüksekliği değişimlerini görsel olarak test edebilmek için gerçekçi boşluklara sahip olsun.

### 5.4 Jant, Lastik, Fren (tamamen prosedürel)

**Jant parametreleri:**
- Stil: klasik 5 kollu muscle, çelik jant + dog-dish kapak, mesh (BBS benzeri — isim kullanma), deep dish 3 parçalı, modern ince çok kollu, drag jant
- Çap: 14" – 22" (0.5" adım yok, tam inç)
- Genişlik: 6" – 12" (0.5" adım)
- Offset (ET): -30 ile +45 mm arası
- Dudak (lip) derinliği: stile göre 0 – 5"
- Kol sayısı (destekleyen stillerde): 5 – 20
- Kaplama: krom, parlatılmış alüminyum, gunmetal, mat siyah, boyalı (herhangi renk), iki tonlu (boyalı + işlenmiş dudak)
- Merkez kapak / bijon görünürlüğü
- **Staggered fitment:** ön ve arka bağımsız ayarlanabilir

**Lastik parametreleri:**
- Genişlik (mm), yanak oranı (%), jant çapına göre otomatik dış çap hesabı
- Yanak stili: düz siyah, beyaz yazılı (raised white letters, kurgusal marka), beyaz bant (whitewall)
- Tip: sokak, yarı-slik, drag radial (arka)
- Stretch / meaty görünüm, genişlik ile jant genişliği oranından otomatik
- Normal map ile diş deseni, prosedürel yanak yazısı

**Fren:**
- Disk çapı (jant çapına göre maksimum sınır), delikli/çizgili disk
- Kaliper: 2/4/6 piston boyutu, renk seçimi
- Jantın arkasından görünürlük doğru hesaplanmalı (kollar arasından görünen kaliper)

**Fitment doğrulama:**
- Jant + lastik dış çapı, sürüş yüksekliği ve çamurluk tipine göre çamurluğa sürtüyor mu? Sürtüyorsa UI'da uyarı göster (engelleme, sadece uyar — modifiye kültüründe "tuck" bilerek yapılır).

### 5.5 Süspansiyon Duruşu (Stance)

- Sürüş yüksekliği: ön/arka ayrı, -80 mm ile +100 mm (100+ "jacked up / gasser" görünümü için)
- Kamber: ön/arka ayrı, -8° ile +2°
- İz genişliği (track width / spacer): 0 – 40 mm, çamurluk tipine göre limit
- Rake (arka yüksek, ön alçak) muscle görünümü için preset

Hepsi atölyede görsel olarak uygulanır ve test sürüşünde fiziğe aktarılır (bkz. §10).

---

## 6. Boya Sistemi

Three.js `MeshPhysicalMaterial` tabanlı, gerekirse `onBeforeCompile` ile genişletilmiş özel araç boyası.

### 6.1 Boya Tipleri

| Tip | Teknik |
|---|---|
| Düz (solid) | Taban renk + clearcoat 1.0, düşük clearcoatRoughness |
| Metalik | Metalness yükseltilmiş taban + metal pulu (flake) normal map, prosedürel noise, ölçek ve yoğunluk ayarlı |
| Perleskan | Metalik + açıya bağlı hafif renk kayması (sheen veya fresnel tabanlı tint) |
| Candy | Metalik/krom taban + renkli şeffaf katman hissi (clearcoat altında koyu, derin renk; fresnel ile yoğunluk) |
| Mat | Clearcoat 0, yüksek roughness |
| Saten | Orta roughness, düşük clearcoat |
| Krom | Metalness 1, roughness ~0.02, renkli krom destekli |
| Kameleon | `iridescence` + `iridescenceThicknessRange`, iki/üç renk arası geçiş |

### 6.2 Kontroller

- Renk seçici: HSV tekerleği + hex girişi + muscle dönemine uygun preset palet (örn. "Grabber Turuncu", "Plum Purple", "Hugger Orange" gibi — kurgusal isimler kullan)
- Pul boyutu, pul yoğunluğu, pul rengi (taban renkten farklı olabilir)
- Clearcoat parlaklığı
- **Bölgesel boyama:** `paintZones` her biri ayrı boya alabilir (iki tonlu tavan, farklı renk kaput vb.)
- Kaliper, jant, egzoz ucu, ayna gibi parçalar da kendi materyal ayarlarına sahip

### 6.3 Kalite Kriterleri

- HDRI yansıması boyada net görünmeli, metalik pullar yakın kamerada ışık altında parlamalı.
- Kameleon boya araç etrafında dönerken akıcı renk değiştirmeli.
- Tüm boya parametreleri JSON olarak serileştirilebilmeli (preset kaydetme).

---

## 7. Katmanlı Vinil Editörü (Forza tarzı)

Projenin en karmaşık sistemi. İki aşamada yapılacak (Faz 5 ve Faz 6).

### 7.1 Render Yaklaşımı

Gerçek modelin UV'lerine güvenmemek için **box projection (kutu projeksiyonu)** kullanılacak:

- Araç etrafında 5 projeksiyon yüzeyi: **sol, sağ, üst, ön, arka**.
- Her yüzey için bir offscreen canvas/render target (örn. 2048×1024). Vinil katmanları bu canvas'lara 2D olarak basılır.
- Boya shader'ı, yüzey normaline göre ağırlıklandırarak (triplanar mantığı) bu 5 texture'dan örnekler ve sonucu **clearcoat altına**, taban renkle karıştırır. Böylece vinil de verniklenmiş gibi parlar.
- Kapılar, kaput gibi ayrı mesh'ler aynı araç-uzayı projeksiyonunu kullandığı için vinil parçalar arasında kesintisiz devam eder.
- Bilinen kısıt: çok eğimli yüzeylerde gerilme olur; geçiş bölgelerinde normal ağırlıklı yumuşak blend uygula.

### 7.2 Katman Modeli

```ts
type VinylLayer = {
  id: string;
  shapeId: string;          // şekil kütüphanesinden
  side: 'left' | 'right' | 'top' | 'front' | 'rear';
  position: [number, number]; // projeksiyon yüzeyinde, 0..1
  rotationDeg: number;
  scale: [number, number];
  skew: [number, number];
  color: string;
  opacity: number;          // 0..1
  flipX: boolean;
  flipY: boolean;
  mirrorToOppositeSide: boolean; // sol <-> sağ simetri
  maskMode: 'none' | 'mask' | 'cutout'; // altındaki katmanı kırpma
  visible: boolean;
  locked: boolean;
  groupId?: string;
};
```

### 7.3 Editör Özellikleri

**Faz 5 (temel):**
- Katman ekle/sil/çoğalt, sıralama (yukarı/aşağı, en üste/en alta)
- Araç üzerine tıklayarak yerleştirme (raycast ile hangi yüzeye denk geldiğini ve UV benzeri pozisyonu hesapla)
- Taşıma, döndürme, ölçekleme, eğme için gizmo
- Renk ve opaklık
- Sol/sağ ayna (simetri)
- Undo/redo (en az 100 adım)
- Katman limiti: 500 (performans testine göre ayarlanabilir)

**Faz 6 (gelişmiş):**
- Gruplama, grup halinde dönüştürme
- Maske/cutout katmanlar
- Yazı aracı (birkaç gömülü font, yazıyı şekle dönüştürme)
- Hazır vinil setleri: yarış şeritleri (rally stripes, bumblebee, side C-stripe), alevler, yarış numarası paneli, damalı bayrak — hepsi orijinal tasarım
- Vinil grubu kaydet/yükle (JSON), başka bir tasarıma içe aktarma
- Klavye kısayolları (çoğaltma, nudge, snap)

### 7.4 Şekil Kütüphanesi

SVG path tabanlı, çözünürlükten bağımsız. İlk set: daire, kare, yuvarlatılmış kare, üçgen, yıldız, çizgi, eğri şerit, gradyan şerit, alev parçaları, şimşek, ok, damalı desen, rakamlar 0–9, harfler A–Z. Hepsi orijinal çizim olmalı.

---

## 8. Atölye Sahnesi

### 8.1 Ortam

- Karanlık, endüstriyel muscle garajı: beton zemin (yansımalı — drei `MeshReflectorMaterial`), tuğla/metal duvarlar, araç bir kaldırma platformunda veya döner tablada.
- Işıklandırma: yukarıdan şeritli softbox ışıklar (boya yansımasında güzel çizgiler oluşturması için), sıcak tonlu yan ışıklar, hafif sis/volumetrik his.
- HDRI ortam haritası (yansımalar için), sahne ışıklarıyla uyumlu.
- Placeholder aşamasında ortam basit geometrilerle kurulabilir; atmosfer ışıkla sağlanır.

### 8.2 Post-processing

- Tone mapping: AgX veya ACES (karşılaştırıp seç)
- Bloom (farlar, neon, krom parlamaları)
- SSAO / N8AO
- SMAA veya FXAA
- Hafif vinyet ve renk düzenleme (LUT destekli)
- Kalite ayarı: Düşük / Orta / Yüksek / Ultra

### 8.3 Kamera

- Serbest orbit (sınırlı: zemin altına inmesin, çok uzaklaşmasın)
- Her slotun manifestte tanımlı bir **kamera preset'i** var; slot seçilince kamera akıcı (ease) geçişle oraya gider.
- Turntable modu: araç yavaşça döner (menüde boşta beklerken).
- **Fotoğraf modu:** serbest kamera, FOV, alan derinliği (DoF), poz; yüksek çözünürlüklü ekran görüntüsü alıp PNG olarak indirme.

---

## 9. Arayüz (UI)

- Most Wanted 2005 tarzı: alt veya sol tarafta kategori şeridi, alt kategoriler, parça listesi. Sert açılı, kontrastlı, hafif glitch/neon vurgular — ama orijinal bir tasarım.
- Kategoriler: **Gövde Kiti, Boya, Vinil, Jantlar & Lastikler, Duruş, Işıklar & Camlar, Motor Görünümü, Performans, Fotoğraf Modu, Test Sürüşü, Garaj (Kaydet/Yükle)**
- **Önizleme:** bir parçanın üzerine gelinince araçta anında önizlenir; onaylanmazsa geri alınır.
- Klavye/fare ve gamepad ile tam gezinme.
- UI dili: **Türkçe** (i18n altyapısı kurulsun, İngilizce sonradan eklenebilsin).
- Ekonomi: ilk sürümde **yok (sandbox)**. Tüm parçalar açık. Parça tanımlarında `price` alanı bulunsun ki ileride eklenebilsin.

---

## 10. Test Sürüşü

### 10.1 Pist

- Prosedürel, kapalı döngü, yaklaşık 1.5 – 2 km.
- Spline tabanlı: en az bir uzun düzlük (muscle aracın güçlü yanı), bir şikan, bir hızlı viraj, bir keskin viraj.
- Asfalt, kerb'ler, bariyerler, kum/çim kenarlar, basit çevre (ağaçlar, tribün siluetleri, ışık direkleri).
- Gün batımı / gece ışıklandırma seçeneği.

### 10.2 Araç Fiziği

- Rapier raycast araç kontrolcüsü.
- Atölyeden aktarılan değerler:
  - Sürüş yüksekliği → süspansiyon dinlenme uzunluğu, ağırlık merkezi yüksekliği
  - Jant + lastik çapı → tekerlek yarıçapı
  - Lastik genişliği + tipi → yanal ve boylamsal tutuş
  - Kamber → küçük tutuş etkisi (aşırı kamberde düz yolda tutuş düşer)
  - Gövde kiti ve spoyler → ağırlık ve basit downforce katsayısı
- Muscle karakteri: güçlü tork, arkadan itiş, burnout ve drift yapılabilir olmalı. Arcade-simülasyon arası denge (sürüş eğlenceli olsun, aşırı zor olmasın).

### 10.3 Performans Parçaları (basit)

Görsel ağırlıklı oyun olduğu için performans sistemi sade:
- Motor seviyesi (Stok / Sokak / Yarış), süperşarjör (görseli de var), şanzıman, lastik tipi, fren, süspansiyon sertliği.
- Her parça birkaç istatistiği (beygir, tork, ağırlık, tutuş, fren) değiştirir. UI'da çubuk grafik karşılaştırma.
- Basit bir dyno grafiği (devir-tork/beygir eğrisi) gösterilebilir.

### 10.4 Kamera, HUD, Efektler

- Kameralar: arkadan takip, alçak takip, kaput, tampon. `C` ile geçiş.
- HUD: hız (km/s), devir göstergesi, vites, tur zamanı, en iyi tur.
- Efektler: lastik izi (skid marks), lastik dumanı (burnout'ta yoğun), egzozdan alev (gaz kesilince, opsiyonel).
- Ses: devre bağlı motor sesi (pitch/crossfade ile birkaç örnek), egzoz tipine göre ton, lastik sesi. Ses dosyaları gelene kadar sentezlenmiş placeholder (Web Audio) kullanılabilir.
- `Esc` → duraklat menüsü → "Atölyeye dön".

---

## 11. Kaydet / Yükle

- **BuildState**: aracın tüm modifiye durumunu tutan tek, serileştirilebilir obje (parçalar, boya, vinil katmanları, stance, performans, cam, ışıklar).
- `version` alanı içersin; eski kayıtları yeni sürüme taşıyan migration fonksiyonları olsun.
- Depolama: IndexedDB (vinil verisi büyük olabileceği için).
- Birden fazla kayıt slotu ("Garaj"), her biri küçük bir önizleme görseliyle.
- JSON olarak dışa/içe aktarma (paylaşmak için).

```ts
type BuildState = {
  version: number;
  carId: string;
  name: string;
  parts: Record<string, string>;          // slot -> seçenek id
  paint: Record<string, PaintConfig>;     // zone -> boya
  vinyl: VinylLayer[];
  wheels: { front: WheelConfig; rear: WheelConfig };
  tires: { front: TireConfig; rear: TireConfig };
  brakes: BrakeConfig;
  stance: StanceConfig;
  lighting: LightingConfig;               // far, stop, neon
  glass: GlassConfig;                     // cam filmi
  performance: PerformanceConfig;
  updatedAt: string;
};
```

---

## 12. Fazlar (Yol Haritası)

Her faz için **Kabul kriterleri** sağlanmadan sonraki faza geçilmez.

### Faz 0 — Kurulum
- Vite + React + TS + R3F + Zustand + Vitest + ESLint/Prettier kurulumu.
- Boş sahne, basit zemin, HDRI, orbit kamera.
- **Kabul:** `npm run dev` açılır, sahnede dönebilen bir kutu ve yansıma görünür.

### Faz 1 — Araç İskeleti ve Slot Sistemi
- Manifest tipi, doğrulayıcı, yükleyici.
- Prosedürel placeholder Vanta Stallion gövdesi ve slot parçaları.
- BuildState store'u, undo/redo, parça değiştirme.
- Temel UI iskeleti (kategori → slot → seçenek).
- **Kabul:** Her slottaki her seçenek UI'dan değiştirilebilir, undo/redo çalışır, manifest testleri yeşil.

### Faz 2 — Boya Sistemi
- §6'daki tüm boya tipleri, bölgesel boyama, renk seçici, presetler.
- **Kabul:** 8 boya tipi ayırt edilebilir şekilde görünür; boya JSON'a serileşip geri yüklenir.

### Faz 3 — Jant, Lastik, Fren
- §5.4'teki prosedürel üretim, staggered fitment, fitment uyarısı.
- **Kabul:** Tüm jant stilleri tüm boyutlarda doğru üretilir; kaliper kollar arasından görünür; geometri cache'lenir (aynı parametre tekrar üretilmez).

### Faz 4 — Atölye Atmosferi
- §8 tam olarak: ortam, ışıklar, post-processing, slot kamera geçişleri, turntable.
- **Kabul:** Most Wanted havası hissediliyor; orta seviye GPU'da 1080p'de ≥60 FPS.

### Faz 5 — Vinil Editörü (Temel)
- §7.1 render yaklaşımı ve §7.3 temel özellikler.
- **Kabul:** Araca tıklayarak şekil yerleştirilir, gizmo ile dönüştürülür, simetri çalışır, vinil clearcoat altında görünür, 200 katmanda akıcı kalır.

### Faz 6 — Vinil Editörü (Gelişmiş)
- §7.3 gelişmiş özellikler, şekil kütüphanesinin tamamı, hazır setler.
- **Kabul:** Maske, gruplama, yazı ve hazır setler çalışır; vinil grubu dışa/içe aktarılır.

### Faz 7 — Diğer Görsel Modifiyeler
- §5.5 duruş, cam filmi, far/stop seçenekleri, neon, motor görünümü, roll cage.
- **Kabul:** Duruş ayarları gerçek zamanlı uygulanır; blower cutout kaputla motor görünür.

### Faz 8 — Test Sürüşü
- §10 tamamı.
- **Kabul:** Atölyeden piste geçilir, araç modifiyeleri görsel ve fiziksel olarak taşınır, tur zamanı tutulur, burnout yapılabilir, atölyeye geri dönülür ve build korunur.

### Faz 9 — Kaydet/Yükle ve Fotoğraf Modu
- §11 ve §8.3 fotoğraf modu.
- **Kabul:** Birden fazla build kaydedilir, sayfa yenilense de kalır, JSON dışa/içe aktarma çalışır; yüksek çözünürlüklü PNG alınır.

### Faz 10 — Gerçek Model Entegrasyonu
- GLB yükleme hattı (Draco + KTX2), manifestte `model` alanı.
- Mesh isimlendirme kuralına göre slotlara otomatik eşleme.
- `docs/ASSET_GUIDE.md` yaz (bkz. §13).
- **Kabul:** Kurallara uygun bir GLB eklendiğinde kod değişmeden placeholder'ın yerini alır; eksik parça varsa placeholder'a geri düşer ve uyarı loglanır.

### Faz 11 — Optimizasyon ve Cila
- Draw call azaltma, geometri/materyal paylaşımı, vinil texture güncellemelerini sadece değişen yüzeyde yapma, LOD.
- UI animasyonları, ses cilası, yükleme ekranı, credits ekranı (asset lisans atıfları için).
- **Kabul:** Performans hedefleri (§14) karşılanır.

---

## 13. Model Hazırlama Kuralları (ASSET_GUIDE özeti)

Faz 10'da `docs/ASSET_GUIDE.md` olarak detaylandırılacak:

- Format: GLB (glTF 2.0), birim **metre**, **Y yukarı**, araç **+Z yönüne** bakıyor.
- Orijin: araç zemin hizasında, iki aks ortasında.
- Her slot seçeneği ayrı obje, isimlendirme: `<slot>__<optionId>` (örn. `hood__shaker_scoop`, `bumper_front__chrome_delete`).
- Gövde: `body__main`. Kapılar, kaput, bagaj ayrı objeler.
- Tekerlekler modelde olmayacak (prosedürel üretiliyor); sadece `wheel_anchor_FL/FR/RL/RR` boş objeleri (empty) bulunur.
- Boya bölgeleri materyal adlarıyla işaretlenir: `paint_body`, `paint_roof`, `paint_hood` ... Kod bu materyalleri boya sistemiyle değiştirir.
- Krom, cam, kauçuk, far camı materyalleri: `mat_chrome`, `mat_glass`, `mat_rubber`, `mat_headlight_lens` vb.
- Poligon bütçesi (ilk hedef): gövde + tüm parçalar toplam ≤ 300k üçgen.
- Model kaynağı: Sketchfab'da "downloadable" + CC-BY veya daha serbest lisanslı, **parçaları ayrı objeli** modeller tercih edilir; Blender'da bu kurallara göre düzenlenir. Lisans atıfları `public/assets/CREDITS.json` dosyasına yazılır ve oyun içi credits ekranında gösterilir.

---

## 14. Performans Hedefleri

- Atölye: orta seviye masaüstü GPU, 1080p, Yüksek kalite → ≥ 60 FPS
- Test sürüşü: aynı donanım → ≥ 60 FPS
- İlk yükleme: placeholder sürümde < 3 sn, gerçek modelle < 8 sn (yükleme ekranı ile)
- Vinil: 500 katmanda düzenleme sırasında belirgin takılma olmamalı (canvas yeniden çizimi debounce + sadece etkilenen yüzey)

---

## 15. Kod Kalitesi

- TypeScript strict, `any` yasak (gerekçeli istisnalar hariç).
- Saf mantık (manifest doğrulama, BuildState serileştirme/migration, fitment hesabı, stat hesapları) için birim testleri.
- Prosedürel geometri üreticileri parametre → geometri saf fonksiyonları olsun, cache'lenebilsin.
- Three.js kaynakları (geometry, material, texture) kullanılmadığında `dispose` edilsin; bellek sızıntısı olmasın.
- Bileşenler küçük ve tek sorumluluklu.

---

## 16. Kapsam Dışı (Şimdilik)

- Birden fazla araç (mimari destekliyor ama içerik yok)
- Ekonomi, kariyer, yarış modu, AI rakipler
- Online / çok oyunculu, build paylaşım sunucusu
- Mobil destek
- Hasar modeli

---

## 17. Açık Kararlar (ileride sorulacak)

- Tone mapping: AgX mi ACES mi (Faz 4'te görsel karşılaştırma ile)
- Gerçek ses dosyalarının kaynağı
- İkinci ve sonraki araçların tarzları
- Ekonomi sisteminin eklenip eklenmeyeceği

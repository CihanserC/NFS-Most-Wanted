# Muscle Garage — Analiz ve V2 Geliştirme Planı

Tarih: 2026-10-18 · Bu belge, mevcut oyunun analizini, istenen yeni özelliklerin netleştirilmiş tasarımını ve çalışma planını içerir. **Çalışma bu belge üzerinden yürür**: her faz bitince ilgili kutular işaretlenir ve `docs/PROGRESS.md` güncellenir.

İlgili belgeler: `PROJECT_SPEC.md` (ilk sürüm), `docs/ANALYSIS.md` (Faz 0–11 sonrası rapor), `docs/ASSET_GUIDE.md` (model kuralları).

---

## 1. Mevcut durumun analizi

### 1.1 Güçlü yanlar
- Saf mantık (`src/core`) ile sahne kodu ayrı; 319 test, fizik dahil başsız çalışıyor.
- Veri odaklı yapı: manifest + parça kataloğu + JSON verileri; yeni araç **teoride** yalnız veri + model.
- `BuildState` sürümlü, migration'lı, IndexedDB'de kalıcı.
- Model hattı (GLB, yedek parça, paylaşılan materyaller) hazır.

### 1.2 Zayıf yanlar (bu planın hedefleri)
| # | Gözlem | Kaynak |
|---|---|---|
| A | **Tek araç varsayımı kodda gömülü:** `useBuildStore = createBuildStore(getCar(DEFAULT_CAR_ID).manifest)`, otomatik kayıt tek slot, garaj yüklemesi `store.manifest` kullanıyor, kamera/HUD/ses `DEFAULT_CAR_ID` okuyor. İkinci araç eklemek için önce çok araçlı mimari şart. | `core/store/stores.ts`, `buildStore.ts`, `persistence.ts` |
| B | **Açılış doğrudan modifiye ekranı;** araç seçimi yok. | `App.tsx` |
| C | **Üst çubukta 9 düğme** (geri al, yinele, döner tabla, grafik, ton, oto kalite, ses, kredi, FPS): kalabalık, mobilde sığmaz. | `TopBar.tsx` |
| D | **Mobil uyumsuz:** klavye/fare varsayımı (sürüşte W/A/S/D), sabit piksel panel genişliği (≈ 340–460 px), dokunmatik sürüş girişi yok, `touch-action` ayarı yok, mobil GPU için varsayılan kalite yok. | `drive/input.ts`, `garageMenu.css` |
| E | **Sürüş hissi ayarlanmamış:** direksiyon yalnız hıza duyarlı açı; yardımcı sistemler (ABS, çekiş kontrolü, direksiyon yardımı) yok; yan yatma (roll) kontrolü yok; kamera sabit mesafe; çarpışmada sert duruş; tek fizik profili (araca özel değil). | `VehiclePhysics.ts`, `drivetrain.ts` |
| F | **Sürüş göstergeleri sade:** büyük hız rakamı + segmentli devir çubuğu + vites kutusu; gaz/fren, kayma, boost, vites ışığı yok; sağ altta yığılmış; mobilde ayrı yerleşim yok. | `DriveOverlay.tsx` |
| G | **Vanta iç mekanı ilkel:** kutu koltuklar, kutu torpido, tek halka direksiyon; kapı paneli, gösterge, konsol, pedal, tavan döşemesi yok. | `slots/mechanical.tsx` (`Interior`) |

### 1.3 Gelen girdi: Mustang modeli
`assets/2013_ford_mustang_gt.glb` (5,4 MB, Sketchfab, Ddiaz Design) incelendi:

| Özellik | Değer |
|---|---|
| Yapı | 313 düğüm, 154 mesh, ≈ 86 bin üçgen, 12 materyal, 25 doku (gömülü), uzantılar: `KHR_materials_specular`, `KHR_materials_transmission` (Draco yok) |
| Ölçek / eksen | Düğüm matrisleri sonrası geometri **metre/100** ölçeğinde (×100 → 4,77 m uzunluk × 2,03 m genişlik × 1,40 m yükseklik). Önü **+Z**, yukarı **+Y**, solu **+X**: bizim koordinatlarla uyumlu. Zemin y = −0,176 m'de (araç 0,176 m yukarı kaydırılmalı). |
| Tekerlekler | Hub/disk/fren düğümleri var (`SM_Hub_*`, `SM_Disk_*`, `SM_Brake_*`); merkezler: ön (±0,727; 0,345; 1,473), arka (±0,745; 0,354; −1,246) → aks mesafesi 2,72 m. **Jant/lastik yok** (yalnız hub+disk+kaliper). |
| İsimler | Bizim kurallara **uymuyor**: `D_Body_xx`, `ANC_Door_L/R_xx`, `SM_Hood`, `SM_FrontKit`, `SM_RearKit`, `SM_Interior`, `ANC_SteeringWheel_xx`, `SM_Base`, `…undercover` (tüm alt plaka). Ayrı seçenek nesneleri (spoyler, tampon alternatifleri…) yok. |
| Materyaller | `MAT_Ford_Mustang_2014_Base1` (kaporta boyası), `MAT_Glass1`, `MAT_Lights1`, `MAT_Details_{MAT1,INT1,EXT1,Chassis,Grid02,Brake1,Hub1}`, `MAT_Disk1`, `phong9SG1` |
| **Lisans** | **CC-BY-NC-SA-4.0** (ticari olmayan + benzer paylaşım). Proje kuralı (`PROJECT_SPEC §13`) CC-BY veya daha serbest istiyor → **bilinçli istisna** (bkz. §6 Kararlar). |
| Aynı klasörde | `assets/2001_bmw_m3_gtr.glb` (18,9 MB). **İstenmedi, bu planda kullanılmıyor**; ileride 3. araç adayı. |

---

## 2. İstenen özellikler — netleştirilmiş tasarım

### 2.1 Araç seçim ekranı ve oyun akışı

**Yeni akış:** `Araç Seç → Atölye (modifiye) → Test Sürüşü → (Atölye | Araç Seç)`.

- Açılışta (yükleme ekranından sonra) **araç seçim ekranı**: atölye sahnesinde döner tablada seçili araç, solda araç listesi/kartlar, altta özellikler.
- Kontroller: ←/→ (klavye, gamepad D-pad, dokunmatik kaydırma/oklar) araç değiştirir; Enter / A / "SEÇ" düğmesi onaylar.
- Her araç kartı: ad, tür/dönem, tahrik (RWD), güç/tork/ağırlık/aks mesafesi çubukları (`buildStats` stok kurulumla), **"Kayıtlı proje var" göstergesi** (o araca ait son oturum/garaj kaydı).
- Seçince o aracın **son oturumu** (varsa) ya da stok kurulum yüklenir ve atölyeye geçilir; atölyede üst çubukta **"Araç seç"** ile geri dönülebilir (mevcut proje otomatik kaydedilir).
- **Araç başına oturum:** otomatik kayıt slotu `__autosave__:<carId>`; eski tek slotlu kayıt Vanta'ya taşınır (migration).
- Garaj kayıtları araç adıyla listelenir; başka araca ait kaydı yüklemek aracı da değiştirir.

Kabul: iki araç arasında geçiş yapılır, her birinin modifiyesi ayrı saklanır; sayfa yenilense de son araç/oturum geri gelir; seçim ekranı klavye, gamepad ve dokunmatikle gezilir.

### 2.2 Ayarlar (dişli çark) penceresi — üst çubuk sadeleştirme

- Üst çubukta yalnızca: **[Araç seç]  [↶ Geri al] [↷ Yinele]  [⚙ Ayarlar]**. (Geri al/yinele düzenleme eylemi olduğu için üstte kalır; mobilde yalnız ikon.)
- **Ayarlar** açılır penceresi (modal, Esc/dışarı tıklama kapatır, klavye ve gamepad ile gezilir), bölümler:
  - **Grafik:** kalite (Düşük/Orta/Yüksek/Ultra), oto kalite, ton eşleme (ACES/AgX), FPS göstergesi.
  - **Ses:** ana ses seviyesi kaydırıcısı (menü sesleri, motor).
  - **Sahne:** döner tabla aç/kapa.
  - **Sürüş:** sürüş yardımcıları (direksiyon yardımı, ABS, çekiş kontrolü — bkz. §2.4), kamera varsayılanı, dokunmatik kontrol düzeni.
  - **Hakkında:** Kredi, sürüm.
- Sürüş sırasında duraklat menüsünden aynı pencere açılır (kısaltılmış: grafik, ses, yardımcılar).

Kabul: üst çubukta ≤ 4 öğe (masaüstü), ≤ 3 ikon (mobil); eski tüm ayarlar pencerede erişilebilir; ayarlar kalıcı.

### 2.3 Mobil uyumluluk

Hedef: modern telefon/tabletlerde (Chrome Android, Safari iOS) **yatay** konumda atölye ve sürüş kullanılabilir; dikeyde "cihazı döndür" uyarısı (sürüş) ya da kullanılabilir düzen (menüler).

| Alan | Tasarım |
|---|---|
| **Algılama** | `pointer: coarse` / dar ekran → `isMobile`; ilk açılışta kalite **Düşük/Orta**, `dpr ≤ 1.5`, gölge/AO/yansıma kapalı (kalite ön ayarına eklenir). |
| **Atölye düzeni** | Sol panel yerine **alt çekmece (bottom sheet)**: kategori listesi yatay kaydırmalı şerit, editör içeriği açılır çekmecede; tuval görünür kalır. Dokunma hedefleri ≥ 44 px, kaydırıcılar büyük. |
| **Kamera/vinil** | OrbitControls zaten dokunmatik (tek parmak döndür, iki parmak yakınlaş/kaydır); tuvale `touch-action: none`. Vinil gizmo işaretçi olaylarıyla çalışıyor → dokunmatikte doğrulanır, tutamaçlar büyütülür. |
| **Sürüş girişi** | Ekranda dokunmatik kontroller: sol altta **direksiyon** (sol/sağ büyük düğmeler ya da sanal çubuk), sağ altta **gaz** ve **fren** pedalları, el freni, kamera ve duraklat düğmeleri. İsteğe bağlı **eğim (gyro) direksiyonu** (ayarlarda). Çoklu dokunma desteklenir. |
| **HUD** | Dar ekranda küçük yerleşim: hız + vites + devir yayı alt ortada; minimap/tur bilgisi küçülür. |
| **Güvenlik** | `viewport-fit=cover`, safe-area boşlukları, çift dokunma/yakınlaştırma/çekerek-yenileme kapalı, ekran uyanık tut (Wake Lock, varsa), ses ilk dokunuşla açılır. |
| **Performans** | Uyarlanabilir kalite mobilde daha agresif; sürüşte parçacık/iz sayıları ölçeklenir; Rapier WASM tembel yüklü kalır. |

Kabul: 390×844 ve 844×390 (iPhone), 360×800 (Android), 1024×768 (tablet) boyutlarında düzen bozulmaz, yatay kaydırma yok, tüm editörlere erişilir, dokunmatikle sürüş mümkündür. (Doğrulama: tarayıcıda pencere boyutlandırma + dokunma olayı simülasyonu; gerçek cihaz testi yapılamazsa raporda belirtilir.)

### 2.4 Sürüş mekaniklerinin iyileştirilmesi

Hedef: **eğlenceli arcade-simülasyon dengesi** (spec §10.2), kolay kontrol, belirgin araç karakteri. Her değişiklik **ölçülebilir** ve testle korunur.

1. **Direksiyon:** hıza duyarlı kilit açısı yanında **kendiliğinden düzelen** (self-aligning) merkezleme, **karşı direksiyon yardımı** (kayarken ters kırma), dönüş giriş eğrisi (üstel), gamepad/dokunmatikte analog.
2. **Yardımcı sistemler** (ayarlardan aç/kapa, varsayılan açık): **ABS** (fren kilitlenmesini önler), **çekiş kontrolü** (kalkışta aşırı patinajı sınırlar; burnout için kapatılabilir/el freniyle devre dışı), **direksiyon yardımı** (yaw rate hedefine göre hafif düzeltme).
3. **Yan yatma (roll) ve ağırlık aktarımı:** anti-roll torku (`rollStiffness` zaten süspansiyon verisinde), alçak ağırlık merkezi çıkarımı; devrilme eşiği yükseltilir, kalıcı devrilme yerine yumuşak toparlama.
4. **Tutuş modeli:** eğilim (slip angle) tabanlı yanal tutuş eğrisi (tepe sonrası yumuşak düşüş), yüzeye göre tutuş, **drift** için el freni + gaz davranışı iyileştirilir (kontrol edilebilir kayma).
5. **Güç aktarımı:** debriyaj/vites geçişi hissi, **kalkış kontrolü**, devir sınırlayıcı sesi/etkisi, motor freni ayarı; 0–100 ve boylamasına ivme hedefleri araç başına.
6. **Çarpışma:** bariyerde sürtünme kaybı azaltılır (duvara yaslanıp sürebilme), yumuşak sekme, hız kaybına göre ekran sarsıntısı.
7. **Kamera:** hıza duyarlı mesafe/FOV, **yön tahmini** (drift'te kamera aracın hız vektörünü izler), çarpışmada sarsıntı; **kokpit kamerası** (iç mekân, §2.6).
8. **Araca özel fizik profili:** `data/cars/<id>/driving.json` (kütle dağılımı, tutuş çarpanı, tork eğrisi, vites oranları, fren dengesi, aero) — Vanta ağır/V8 muscle, Mustang daha dengeli/modern.
9. **Ayar ve ölçüm altyapısı:** başsız test seti genişletilir: skidpad (yanal g), slalom, 100→0 mesafesi, 0–100, drift açısı, devrilme (yüksek hızda direksiyon), otopilot turu. Hedef aralıklar teste yazılır.

Kabul: yeni ölçülebilir hedefler testte yeşil; el freniyle kontrollü drift ve burnout hâlâ yapılır; ABS/TC açıkken fren mesafesi ve ivme iyileşir, kapalıyken eski davranış mümkündür.

### 2.5 Sürüş göstergeleri (HUD) yenileme

Sağ alt **gösterge kümesi** yeniden tasarlanır (Most Wanted/Forza karışımı, orijinal tasarım):
- **Devir saati:** SVG yay, redline bölgesi, iğne/yay dolgusu, **vites değiştirme ışığı** (redline yakınında yanıp söner).
- **Hız:** büyük dijital rakam (km/s), altında birim; hız değişiminde yumuşak rakam geçişi.
- **Vites göstergesi:** büyük harf (N/R/1–6), vites geçişinde kısa vurgu.
- **Gaz / fren çubukları** (dikey ince çubuklar), **el freni** ve **ABS/TC** uyarı lambaları.
- **Kayma/drift göstergesi** (açı + skor), süperşarjörlü araçta **boost** göstergesi.
- **Yüzey/pist dışı** uyarısı, **tur/ara zaman** (± en iyi turla fark), minimap daha okunaklı.
- Düzen: masaüstü sağ alt küme; mobilde alt orta kompakt küme + sol/sağ dokunmatik kontrol alanları ile çakışmayacak şekilde.
- Erişilebilirlik: yüksek kontrast, `prefers-reduced-motion`, ölçek ayarı (ayarlarda).

Kabul: göstergeler tüm çözünürlüklerde taşmaz/çakışmaz; değerler fizikle tutarlı (rpm, vites, hız); HUD güncellemesi kare süresini belirgin artırmaz (≤ 0,5 ms).

### 2.6 Vanta Stallion iç mekanı (daha detaylı)

Mevcut: kutu koltuk/torpido/direksiyon. Hedef: **kokpit içi bakıldığında inandırıcı** prosedürel iç mekân (orijinal tasarım, markasız):
- **Torpido:** kıvrımlı üst yüzey (extrude profil), **gösterge kümesi** (canvas dokusuyla analog kadranlar: hız, devir, yakıt/sıcaklık; hız/devire bağlı iğneler sürüşte canlı), klima ızgaraları, orta konsol, **vites kolu** (boyun + topuz), el freni.
- **Direksiyon:** ince çember (torus) + 3 kol + merkez kapak, doğru eğim, **direksiyon simidi sürüşte döner**.
- **Koltuklar:** yuvarlatılmış minderler, sırt desteği, **kafalık**, dikiş çizgileri (normal/çizgi dokusu), arkada bench.
- **Kapı panelleri:** kol dayama, kapı kolu, cam krank/düğme; **tavan döşemesi**, direk kaplamaları, dikiz aynası.
- **Pedallar ve taban:** gaz/fren/debriyaj, zemin halısı, tünel.
- **Malzemeler:** deri/vinil, mat plastik, krom detay; **iç mekân ışığı** (hafif ambient + gösterge parlaması gece).
- **Roll cage** seçeneği yeni iç mekânla uyumlu kalır.
- **Kokpit kamerası:** sürüşte sürücü gözünden (iç mekân görünür), kafa hareketi/sallanma hafif.
- İç mekân `interior` slot seçeneği olarak kalır; **LOD:** uzak kameralarda basit, yakında detaylı.

Kabul: atölyedeki "İç mekan" kamerasından ve sürüş kokpit kamerasından bakıldığında yukarıdaki öğeler seçilebilir şekilde görünür; üçgen bütçesi ≤ 40 bin; sürüş FPS'i belirgin düşmez.

### 2.7 İkinci araç: 2013 Ford Mustang GT

- Araç kimliği: `ford_mustang_gt_2013` (**gerçek marka/model**: kullanıcı sağladığı model olduğu için kurgusal-isim kuralına bilinçli istisna, bkz. §6). Karakter: modern pony car, 5.0 V8, RWD, 6 vites manuel (oyunda otomatik).
- **Model entegrasyonu = "model eşleme" katmanı:** dosyayı Blender'da elle yeniden adlandırmak yerine araç başına `modelMap.json` ile, yükleme sırasında düğüm/materyal adlarını kurallı adlara **çeviririz** (mevcut hat değişmeden çalışır):
  - **Dönüşüm:** ölçek ×100, zemin kayması +0,176 m.
  - **Gizle:** `SM_Hub_*`, `SM_Disk_*`, `SM_Brake_*` (prosedürel jant/fren kullanılır), `…undercover` (alt plaka), gerekirse tekerlek kuyusu içi.
  - **Boya bölgeleri:** `MAT_Ford_Mustang_2014_Base1` → düğümlere göre `paint_hood` (`SM_Hood`), `paint_bumpers` (`SM_FrontKit`/`SM_RearKit`), `paint_body` (diğerleri). Bölgeler: `body, hood, bumpers` (+ ayna/tavan ayrılabiliyorsa).
  - **Camlar:** `MAT_Glass1` → `mat_glass` (cam filmi çalışır). **Farlar:** `MAT_Lights1` korunur/far rengi uygulanabiliyorsa bağlanır.
  - **Sabit parçalar:** kapılar, iç mekân, direksiyon (`SM_Interior`, `ANC_SteeringWheel_*`) modelin kendi parçalarıdır.
  - **Tekerlek çapaları:** manifest tekerlek konumları modelden: ön (±0,727; 0,345; 1,473), arka (±0,745; 0,354; −1,246).
- **Modifiye edilebilirlik:** modelde ayrı seçenek nesneleri olmadığı için **kaplama (overlay) yaklaşımı**: modelin stok parçası kalır, seçenekler prosedürel parça olarak üstüne eklenir (spoyler, yan etek, çene spoyleri, kaput tutacağı/scoop, egzoz uçları, roll cage). Prosedürel parçalar Mustang'in gövde profiline (`placeholder.json`, ölçülerine uyarlanmış) oturur. Kullanılabilir slotlar Mustang manifestinde tanımlanır (modelin stok parçasını sökmeyen/uyumlu olanlar).
- **Aynı sistemler çalışır:** bölgesel boya (8 tip), vinil (kutu projeksiyonu; boya materyallerinde görünür), jant/lastik/fren (staggered), duruş (kamber, spacer, sürüş yüksekliği), cam filmi, far rengi, underglow, performans parçaları, fitment uyarıları (manifest `fitment`), garaj kaydı, fotoğraf modu, test sürüşü.
- **Dosya/performans:** GLB `public/assets/cars/` altına; 5,4 MB doku ağırlıklı → ilk kullanımda tembel yüklenir (yükleme göstergesi), seçim ekranında önizleme için yüklenir; gerekirse `gltf-transform` ile doku sıkıştırma ayrı adım olarak önerilir.
- **Atıf:** `CREDITS.json` girdisi (yapımcı, kaynak, lisans, değişiklikler: "ölçek/parça gizleme"); kredi ekranında **"ticari olmayan kullanım"** uyarısı.

Kabul: Mustang seçilip modifiye edilebilir (boya, vinil, jant, duruş, ışık, performans, birkaç overlay parça), kaydedilir/yüklenir, pistte sürülür; model yüklenemezse/eksikse konsol uyarısı + yedek.

---

## 3. Teknik tasarım özeti

### 3.1 Çok araçlı mimari (V2-1'in temeli)
- `data/cars/index.ts`: `CAR_IDS`, `getCar(id)`, `listCars()`; her araç: `manifest.json`, `placeholder.json`, parça kataloğu, `driving.json`, `modelMap.json` (opsiyonel), kart metni (i18n anahtarları).
- `buildStore`: `manifest` **durum** olur; `selectCar(carId)` → manifest + yeni (ya da kayıtlı) build, geçmiş ve önizlemeler sıfırlanır. İçerideki `manifest` kapanışları `get().manifest` okur.
- `useBuildStore.getState().manifest` kullanan her yer (garaj servisi, persistence, store) araç bağımsız hale gelir. `DEFAULT_CAR_ID` yalnız ilk açılış/yedek için.
- Kalıcılık: `__autosave__:<carId>` + `lastCarId` meta; eski `__autosave__` göçü.
- `appStore.screen`: `'select' | 'garage' | 'drive'` (mevcut `mode` genişletilir).

### 3.2 Model eşleme katmanı
`core/model/modelMap.ts`: `applyModelMap(root, map)` yüklenen modelin **klonunda** düğüm adlarını `body__*`, `<slot>__<seçenek>`, materyalleri `paint_<bölge>`/`mat_*` olarak yeniden adlandırır, dönüşümü uygular, gizlenecek düğümleri kaldırır. Mevcut `analyzeModel`/`bindSharedMaterials` değişmeden çalışır. Saf mantık, sentetik ve gerçek GLB ile testli.

### 3.3 Mobil altyapı
`core/platform/device.ts` (algılama, saf), CSS tasarım değişkenleri + `@media (pointer: coarse), (max-width: …)`, `TouchControls` bileşeni (çoklu dokunma → `DriveInput`), düzen `useLayout()` (masaüstü/mobil). Girişler tek `InputSource`ta birleşir (klavye + gamepad + dokunmatik + gyro).

---

## 4. Faz planı (sıra bağımlılığa göre)

Her faz: uygula → test/lint/build → tarayıcıda doğrula → `PROGRESS.md` + bu belgede kutuları işaretle → commit. Fazlar arasında onay beklenmez ([[phase-autonomy]] kararı).

### V2-1 — Çok araçlı mimari, araç seçim ekranı, ayarlar penceresi
- [ ] `buildStore` manifest'i durum yapma, `selectCar`, araç bağımsız garaj/persistence (+ eski kayıt göçü)
- [ ] `data/cars` kayıt defteri (`listCars`), araç kartı verisi (stok istatistik)
- [ ] `screen` akışı: Araç Seç → Atölye → Sürüş; "Araç seç" geri dönüşü; son araç hatırlama
- [ ] Araç seçim ekranı (klavye/gamepad/dokunma, kartlar, kayıtlı proje göstergesi)
- [ ] Ayarlar penceresi + üst çubuk sadeleştirme (≤ 4 öğe)
- [ ] Testler: araç değiştirme, araç başına oturum, göç, ayarlar kalıcılığı

### V2-2 — Mustang entegrasyonu
- [ ] GLB'yi `public/assets/cars/` altına al, `modelMap.json` (ölçek, zemin, gizle, boya bölgeleri, cam)
- [ ] `applyModelMap` + testler (gerçek GLB düğüm adlarıyla)
- [ ] Mustang manifest/parça kataloğu/`placeholder.json`/`fitment`/kamera ön ayarları/çeviriler
- [ ] Overlay parçalar Mustang gövdesine oturur (spoyler, etekler, çene, scoop, egzoz uçları, roll cage)
- [ ] Kredi (CC-BY-NC-SA uyarısı) ve `credits` doğrulayıcı güncellemesi
- [ ] Tarayıcı doğrulama: boya, vinil, jant, duruş, ışık, kayıt, sürüş

### V2-3 — Sürüş göstergeleri ve sürüş mekaniği
- [ ] HUD yenileme (devir yayı, vites ışığı, pedallar, kayma/boost, ara zaman farkı)
- [ ] Yardımcı sistemler (ABS, TC, direksiyon yardımı) + ayarlar
- [ ] Direksiyon modeli, anti-roll, tutuş eğrisi, çarpışma yumuşatma, kamera iyileştirme
- [ ] Araca özel `driving.json` (Vanta, Mustang)
- [ ] Başsız test paketi: skidpad, slalom, 100→0, 0–100, drift, devrilme, otopilot turu (her iki araç)

### V2-4 — Mobil uyumluluk
- [ ] Cihaz algılama, mobil kalite varsayılanları, viewport/safe-area/dokunma ayarları
- [ ] Atölye düzeni (alt çekmece), büyük dokunma hedefleri, editörlerin mobil düzeltmeleri
- [ ] Dokunmatik sürüş kontrolleri (+ isteğe bağlı gyro), mobil HUD yerleşimi
- [ ] Dikey uyarısı, Wake Lock, ses açma
- [ ] Çoklu boyutta tarayıcı doğrulaması (390×844, 844×390, 360×800, 1024×768)

### V2-5 — Vanta iç mekân v2 + kokpit kamerası
- [ ] Torpido, gösterge kümesi (canlı iğneler), konsol, vites kolu, direksiyon (döner)
- [ ] Koltuk, kapı paneli, tavan döşemesi, pedallar, ışıklandırma
- [ ] Kokpit kamerası (atölye iç kamerası + sürüş)
- [ ] LOD ve üçgen bütçesi ölçümü

### V2-6 — Genel cila ve rapor
- [ ] Mustang iç mekân/aksesuar iyileştirmeleri (modelin kendi iç mekânı korunur)
- [ ] Performans ölçümü (iki araç, kalite kademeleri), `ANALYSIS.md`/`PROGRESS.md` güncelleme
- [ ] Bu belgenin sonuç bölümü

---

## 5. Ek öneriler (istenmeyen, değerlendirilecek)

| Öneri | Değer | Maliyet | Durum |
|---|---|---|---|
| Araç başına **ghost/en iyi tur** kaydı ve tur karşılaştırması | Yüksek (tekrar oynanabilirlik) | Orta | V2-6 sonrası aday |
| **Gün/gece + hava** seçeneğinin pist öncesi seçimi | Orta | Düşük | Aday |
| Gerçek model dokularının **KTX2/WebP** sıkıştırması (`gltf-transform`) | Yüksek (yükleme) | Düşük | V2-2'de ölçüme göre |
| **Paylaşım görseli** (build JSON'u PNG metaverisine göm) | Orta | Düşük | Aday |
| Üçüncü araç (BMW M3 GTR dosyası mevcut, 18,9 MB, lisansı bilinmiyor) | Orta | Orta | Lisans/boyut doğrulanınca |
| Erişilebilirlik: renk körü paleti, yazı ölçeği, tek elle oynanış | Orta | Düşük | Mobil ile birlikte kısmen |
| Çoklu dil (İngilizce) — i18n altyapısı hazır | Orta | Düşük | Aday |
| Otomatik **görsel regresyon** (ekran görüntüsü karşılaştırma) | Orta | Orta | Aday |

---

## 6. Kararlar, varsayımlar, riskler

**Kararlar (kullanıcıya sorulmadan verildi, gerekçeli):**
1. **Lisans istisnası:** Mustang modeli CC-BY-NC-SA-4.0. Proje kuralı CC-BY+ istiyordu; kullanıcı dosyayı bilerek sağladığı için kullanılır. Sonuçlar: oyun **ticari olmayan** kullanımla sınırlı kalmalı; modelden türetilen çıktılar (kullanılan dönüştürülmüş GLB) aynı lisansla paylaşılmalı; **atıf zorunlu** (kredi ekranı). Ticari yayın düşünülürse model değiştirilmeli.
2. **Gerçek marka adı:** kullanıcı modeli sağladığı için Mustang adı kullanılır (spec §1 kurgusal-isim kuralına istisna). Kurgusal olan Vanta aynen kalır.
3. **Overlay parçalar:** Mustang'te parçalar modelden sökülmez, üstüne eklenir (modelde ayrı nesne yok); sökme gerektirenler (ör. blower kaput kesiği) Mustang'te sunulmaz.
4. **Geri al/yinele** üstte kalır (ayar değil, düzenleme eylemi).
5. Aracın ilk açılışta **otomatik oynatma/ses** yok; ses ilk etkileşimle açılır.
6. BMW dosyası bu planın dışında.

**Riskler:**
| Risk | Etki | Önlem |
|---|---|---|
| Mustang 5,4 MB / 86 bin üçgen mobil GPU'da ağır | Yüksek | Mobil kalite ön ayarı, dokuları küçültme, LOD/üçgen kısma (gerekirse `gltf-transform simplify`) |
| Model parçaları tek tek ayrılamıyor (kaporta tek mesh grubu) | Orta | Boya bölgeleri düğüm adlarına göre; ayrılamayan bölgeler birleşik kalır |
| `KHR_materials_transmission` camlar pahalı/yanlış görünür | Orta | Camı paylaşılan `mat_glass` ile değiştir (transmission kapalı) |
| Doku renk uzayı / çift sRGB | Düşük | Doku yönetimi GLTFLoader'da doğru; boya materyali kendi parametreleriyle |
| iOS Safari: Web Audio/AudioContext kısıtları, `100vh`, yön kilidi | Orta | İlk dokunuşla sesi aç, `dvh`, yatay uyarısı |
| Çok araçlı geçişte bellek sızıntısı (materyal/doku) | Orta | `CarMaterialsProvider` unmount dispose zaten var; araç değişiminde sınama |
| Fizik değişikliği mevcut testleri/otopilot turunu bozabilir | Orta | Yeni hedefler testle korunur, eski ölçümler tolerans aralığıyla güncellenir |
| Dokunmatik sürüşte gecikme/çoklu dokunma | Orta | `pointer` olayları + `touch-action:none`, gerçek cihaz testi önerilir |

**Doğrulanamayacaklar (baştan not):** gerçek mobil cihaz testi (Chrome'da pencere/dokunma simülasyonuyla yetinilir), gerçek gamepad, hedef donanımda 60 FPS.

---

## 7. Başarı ölçütleri (tüm plan)
- İki araç seçilip modifiye edilebiliyor, ayrı saklanıyor, pistte sürülüyor.
- Üst çubuk ≤ 4 öğe; ayarlar tek pencerede.
- Telefon yatayında atölye + sürüş dokunmatikle kullanılabiliyor.
- HUD yenilendi; sürüş yardımcıları ve araca özel fizik ölçülebilir hedeflerle testli.
- Vanta iç mekânı kokpit kamerasında detaylı.
- `npm run lint`, `npm test`, `npm run build` yeşil; `PROGRESS.md` ve `ANALYSIS.md` güncel.

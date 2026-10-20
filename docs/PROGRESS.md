# İlerleme

## Durum: Fazlar 0–11 ve V2-1/V2-2 tamam; V2-3 büyük ölçüde tamam — bkz. `docs/PLAN_V2.md`, `docs/ANALYSIS.md`

## Üçüncü araç + HUD ✅ (2026-10-20)

- **2001 BMW M3 GTR** (Sketchfab, tonielpro520, **CC-BY-4.0**; kredi ekranında): GLB 18,9 → 3,6 MB (meshopt + WebP, doku ≤ 2048 px). Lastik/jantlar `hideMaterials` ile gizlenir, oyunun tekerlekleri takılır (konumlar lastik adalarından ölçüldü: ön ±0,755 / z 1,475, arka ±0,745 / z −1,26, r 0,315). Boya bölgeleri yüzey adalarıyla: kapı, kaput, bagaj, ayna, tampon + tavan (bölge kutusu) + gövde. Slotlar: kaput ve marşpiyel (GTR'nin kanadı/splitter'ı ve kafesi modelde kaynaşık; overlay çakışırdı). Yarı slik 18", 1250 kg, daha yüksek tutuş (`driving.json`). Testli (`bmw.test.ts`); sürüş testleri üç araçta.
- **Tur paneli** minimal: küçük "LAP n", büyük canlı süre, tek satır en iyi/son; süre `d:ss.cc` (salise 2 basamak).
- **Minimap**: koyu kenarlı yol + açık şerit, turun gidilen kısmı turuncu, başlangıç çizgisi, parlak yön oklu araç.

## Kullanıcı geri bildirimi turu 2 ✅ (2026-10-20)

**Sürüş**

- **Arcade direksiyon** (`VehiclePhysics.applyArcadeSteering`): lastik modeli gerçekçi sınırda (~1,1 g) kalıyordu. Direksiyon girişinden hedef yalpalama hızı = min(kinematik sınır, `arcadeLateralAccel`/hız) hesaplanır, gövde tork impulsuyla ona çekilir; hız vektörü gövde yönüne döndürülür (büyüklük korunur, virajda hız kaybı yok). El freninde yardımlar %15'e iner (drift korunur). `driving.json`: `arcadeLateralAccel` 22 m/s², `yawResponse` 25/sn, `gripAssist` 8/sn. Direksiyon hızı 4,2 → 6/sn.
  - 100 km/s tam direksiyon: 32 → **41°/sn**, yarıçap 62 → **38 m** (≈2 g); 140 km/s: 112 → 66 m. Testler: ≥35°/sn ve >1,6 g; direksiyon bırakılınca yalpalama <3°/sn'ye söner.
  - Hazır kütüphane: zaten Rapier'in raycast araç denetleyicisi kullanılıyor; cannon-es/ammo.js aynı yöntem. Fark ayarda olduğu için kütüphane değiştirilmedi.
- **Nitro** (performans parçası, 3 kademe): Shift / gamepad RB; kademe başına ek ivme 3 / 4,5 / 6,5 m/s², süre 4 / 5 / 6 sn, dolum 14 / 11 / 8 sn. Tüp kullanılırken boşalır, bırakınca dolar. Egzozlardan mavi çekirdekli, kırmızı-turuncu uçlu sürekli alev; HUD'da tüp göstergesi. Testli (`nitro.test.ts`).
- **Bariyer titremesi:** görsel kutular 0,6 m örtüşüyordu, aynı düzlemdeki kırmızı/beyaz yüzler z-fighting yapıyordu. Artık eklemde köşeleri paylaşan tek parça duvar (`barrierWallGeometry`, testli).

**Atölye**

- Kaput pimleri kaldırıldı. **Marşpiyel** +3 (karbon bıçak, krom eşik çıtası, aero kanatçıklı), **arka spoyler** +3 (bagaj lip, kaide kanat, karbon GT kanat — kuğu boynu, uç plakalı); hepsi yüzey haritasıyla iki araca oturur.
- **Boya:** listenin başında "Kaporta (tüm araç)" tüm bölgeleri boyar; altında parça parça. Mustang'te yeni bölgeler: tavan, kapılar, bagaj, tamponlar (+ kalan "çamurluk & yan paneller"). `modelMap` boya kuralına bölge desteği: tek mesh'teki paneller üçgen ağırlık merkezine ya da bütün yüzey adasına (`whole`, temiz panel sınırı — tavan) göre ayrılır. Eski kayıtlarda yeni bölge gövde boyasını devralır.
- **Garaj:** iki direkli lift, standda motor, kepenk kapı, yangın tüpü, lastik rafı, aletli pano, kompresör, zemin park şeritleri ve tehlike bandı; birleştirilerek +9 çizim çağrısı.

**Performans**

- **Mustang GLB 5,46 → 1,25 MB** (meshopt geometri + WebP doku; adlar korunur): `npm run assets:optimize -- giriş.glb çıkış.glb`.
- **Statik mesh birleştirme** (`core/model/mergeStatic.ts`): model yüklenince gövde parçaları materyale göre birleşir. Mustang seçim ekranı (Düşük) **255 → 123** çizim çağrısı, aynı üçgen sayısı.

**Testler:** 398 (397 + 1 geliştirme aracı); lint ve tip denetimi temiz.

## V2-3 + kullanıcı geri bildirimi turu ✅ (2026-10-19)

**Sürüş hissi (ölçümle)**

- **Sorun:** klavyede tam direksiyon ön lastikleri tepe kayma açısının (≈8,5°) çok ötesine itiyordu (40 km/s'te tekerlek açısı 31°): tutuş düşüyor, araç "kayarak düz gidiyordu". Tam direksiyon yarım direksiyondan **daha az** döndürüyordu (100 km/s: 0,5 → 15,9°/sn, 1,0 → 14,7°/sn).
- **Çözüm:** direksiyon açısı = min(tam kilit, kinematik açı `atan(L·a/v²)` + tepe kayma payı) (`steerAngle`, `drivetrain.ts`); `lateralMu` 1,05/1,0 → 1,55/1,5; direksiyon hızı 3,2 → 4,2 /sn.
- **Sonuç (100 km/s, tam direksiyon):** yalpalama 14,7 → 24,2°/sn, yanal 0,65 → 1,13 g, dönüş yarıçapı 97 → 62 m. Kalıcı test: "tam direksiyon yarım direksiyondan keskin döner" (`handling.test.ts`).
- **Sürüş yardımcıları** (`core/drive/assists.ts`): çekiş kontrolü (patinajda gazı kısar; varsayılan kapalı) ve ters direksiyon yardımı (≈4° ölü bölgeli, normal virajda araya girmez; varsayılan açık). Ayarlar arayüzü henüz yok.
- **Çim:** boyuna çekiş ayrı katsayı (`tractionBySurface`, çim 0,85; yanal tutuş cezası 0,55 korunur), yuvarlanma direnci 4 → 2. Çimde geri vites 1 sn'de 8 → 24 km/s.
- **Kamera:** konum araca kilitli (önceden hızla orantılı gecikme: 136 km/s'te araç ~6 m daha uzaklaşıyordu); yalnız yön ve yükseklik yumuşatılır, hızla 0,8 m geri çekilme + 6° FOV.

**Pist**

- **Bariyerler** her kenarda kesintisiz zincir (`barriers.ts`): uçlar ofsetli pist noktalarından alınır (viraj dışında segmentler arası aralık kalıyordu), iç virajda ofset daraltılır (önceden hiç bariyer konmuyordu). Fizikte kutu yerine **yatay kapsül**: eklem yerine takılıp savrulma yok (10° sürtmede 90 km/s → ≥72 km/s korunur). Testler: zincir uçları örtüşür; tam gazla her yöne sürüşte araç pist alanında kalır.
- **Başlangıç kapısı** + damalı çizgi; direkler bariyerin dışında ve fizikte katı (önceden içinden geçiliyordu; test). Fren tabelaları kaldırıldı.
- İnce taneli **mat asfalt** (sarı orta şerit yok, kauçuk izi; ortam yansıması 0,25 — "ıslak gibi parlama" giderildi), biçilmiş çim şeridi, iki tür ağaç (çam + yapraklı) ve korular.
- **Gökyüzü:** gradyan kubbe + küçük güneş diski. Gökyüzündeki eş merkezli halkalar **vinyet** efektinin açık zeminde bantlaşmasıydı; sürüşte vinyet kapatıldı.
- Efektler: egzoz alevi aracın hızını devralır (yüksek hızda arkada metrelerce parlak iz kalıyordu); lastik dumanı gece karartılır.

**HUD**

- Sağ alt **devir saati** baştan: SVG analog kadran (binlik çentikler, kırmızı bölge, akıcı ibre), ortada dijital hız ve vites (N/R/1–6); vites kutusu sınırda (%97) kırmızı yanıp söner.
- Sol alttaki tuş listesi kaldırıldı: **Esc menüsü → Kontroller** sayfası (klavye + gamepad tablosu); ekranda yalnız "Esc · Menü · Kontroller" ipucu. Esc kontroller sayfasında menüye döner.

**Atölye**

- **Mustang parçaları gerçek gövdeye oturuyor:** gerçek modelden ışın izlemeyle yüzey haritası (`surface.json`, üretici + güncellik testi; bkz. ASSET_GUIDE §3b). Kaput pimi 13 cm, spoyler/kanat 15–22 cm havadaydı; lip tamponun içinde kalıyordu, cowl görünmüyordu. Şimdi: lip/splitter tamponun alt hattını izleyen levha, shaker/cowl gerçek kaput arka kenarından, kanat ayakları bagaj yüzeyinde, parçalar ayak izinin en alçak noktasına oturur. Model üzerinde iç mekân slotu yalnız takla kafesi çizer.
- **Vinil:** şekil eklerken önünde çıkan opak dikdörtgen giderildi (gizmo taşıma alanı görünmez kalmalıydı; yansıma gizleme kodu `colorWrite`'ı eziyordu).
- **Performans:** ayarlar soldaki editörde, istatistikler + dyno sağ üstte ayrı panelde. Motor slotu olmayan araçta süperşarjör notu düzeltildi.

**Dil desteği**

- **İngilizce (varsayılan) + Türkçe.** Ayarlar → Dil; seçim tarayıcıda saklanır, açılış ekranı da seçili dilde. Fiyat/sayı, tarih, yüzde ve vinil yazısında büyük harf dile göre (tr: i → İ). İçe aktarma hataları ve jenerik metinleri çeviride. Test: iki sözlük aynı anahtar kümesine sahip olmalı.

**Testler:** 386 (385 + 1 geliştirme aracı, `GEN_SURFACE` ile çalışır) / 40 dosya; lint temiz.

**Açık kalanlar:** sürüş yardımcıları için ayarlar arayüzü ve ABS; HUD'da gaz/fren çubukları, drift/boost göstergesi, ara zaman farkı; mobil (V2-4) ve Vanta iç mekân v2 (V2-5).

## Faz 11 — Optimizasyon ve Cila ✅ (2026-10-18)

**Yapılanlar**

- **Yükleme:** index.html'de anında görünen yükleme ekranı (ilk 5 kare çizilince söner). Paket 4 parçaya bölündü (`vite.config.ts`, `codeSplitting.groups`): uygulama 243 KB, three 878 KB, r3f 654 KB, react 219 KB (toplam ≈ 640 KB gzip, vendor parçaları uygulama değişince yeniden inmez); Rapier + sürüş kodu (4,4 MB) yalnızca Test Sürüşü'nde yüklenir.
- **Ölçüm düzeltmesi:** FPS göstergesinin "çizim çağrısı / üçgen" değerleri yalnızca son efekt geçişini sayıyordu; artık kare başında sıfırlanıp kare sonunda okunuyor (tüm geçişler dahil).
- **Uyarlanabilir kalite** (`core/graphics/autoQuality.ts`): ısınmadan (6 sn) sonra art arda 4 ölçüm (≈2 sn) < 42 FPS ise kalite bir kademe düşer (yukarı çıkmaz). Sekme gizliyken/duraklatılmışken/fotoğraf çekilirken ölçüm yok sayılır. Üst çubukta "Oto kalite" düğmesi ve düşüş bildirimi; elle kalite seçimi otomatiği kapatır. Test makinesinde yavaşlayınca kendiliğinden "Düşük"e indi.
- **Ses:** kalıcı ses seviyesi (%100 / %50 / Kapalı; üst çubuk, duraklat menüsü, M tuşu) motor, lastik ve menü seslerine uygulanır. Menü sesleri (hareket, onay, geri) Web Audio ile sentezlenir.
- **Menü animasyonları:** panel girişi, kademeli liste, seçili öğe parlaması, ipucu bildirimi; `prefers-reduced-motion` ile kapanır.
- **Kredi ekranı:** açık kaynak yazılımlar (lisansları paketlerden doğrulanmış) + `CREDITS.json` üçüncü taraf varlıkları (doğrulanır; şu an boş, her şey prosedürel). Esc/dışarı tıklama kapatır.
- **Gamepad** (§9): menüde D-pad/sol çubuk (ilk gecikme + tekrar), A onay, B/Start geri; sürüşte sol çubuk direksiyon, RT gaz, LT fren, A/X el freni, Y kamera, B pistte düzelt, Start duraklat. Gamepad klavye olaylarına çevrilir, sürüşte analog değerler klavyeyle birleşir.
- **Bilinen sorunlar giderildi:** gizmo zemin yansımasında görünmüyor; renk tekerleği klavyeyle kullanılabiliyor (←/→ ton, ↑/↓ doygunluk, Shift büyük adım); geri al/yinele sonrası menü vurgusu takılı parçaya dönüyor; gamepad navigasyonu eklendi; "kayıtlar yenilenince kaybolur" (Faz 9) ve "gerçek modelde fitment ölçüleri" (Faz 10) zaten çözülmüştü.
- **Testler (319):** uyarlanabilir kalite, ses ayarı, gamepad eşlemesi (ölü bölge, tuş tekrarı, kenar algılama, sürüş eşlemesi), grafik ayar temizleme.
- Test zaman aşımı 60 sn (otopilot turu ve jant üretimi testleri paralel çalışırken 5 sn'yi aşabiliyordu).

**Ölçümler** (Intel UHD entegre GPU, 1280×575; çizim çağrısı/üçgen donanımdan bağımsızdır)

| Sahne  | Kalite | Çizim çağrısı | Üçgen   | FPS |
| ------ | ------ | ------------- | ------- | --- |
| Atölye | Düşük  | 147           | 75 bin  | ≈60 |
| Atölye | Orta   | 354           | 207 bin | –   |
| Atölye | Yüksek | 479           | 508 bin | –   |
| Sürüş  | Düşük  | 120           | 91 bin  | 60  |
| Sürüş  | Orta   | 192           | 161 bin | 52  |
| Sürüş  | Yüksek | 219           | 210 bin | 34  |

- Atölye sahnesi: 168 mesh, 113 bin üçgen (araç ≈ 22 bin gövde; 2 hacimli spot konisi 2 × 16 bin). Yüksek kalitede sahne gölge, yansıma ve AO geçişleriyle birkaç kez çizilir; maliyet geometriden çok dolgu oranıdır, kalite kademeleri bunu yönetir.
- İlk yükleme (üretim derlemesi, entegre GPU): ilk çizilen kareye kadar **2,67 sn**, DOM hazır 0,4 sn, toplam aktarım 635 KB (hedef < 3 sn).
- Vinil: 500 katmanda boşta 59 FPS, sürüklemede ≈17,5 ms/kare (200 katmanla aynı; yalnızca etkilenen yüzey yeniden çizilir) — §14 hedefi.
- **Hedef donanımda (orta seviye masaüstü GPU, 1080p) ≥ 60 FPS ölçülemedi**: test makinesi entegre GPU. Bu donanımda bile sürüş Düşük'te 60 FPS.

**Notlar / kararlar**

- Geometri birleştirme/LOD yapılmadı: ölçümler darboğazın geometri değil dolgu oranı olduğunu gösteriyor (entegre GPU'da Düşük kalite 60 FPS); uyarlanabilir kalite pratik çözümdür.
- Vite, three'nin varsayılan Draco/Basis kopyalarını da pakete alıyor (`dist/assets`, ≈3 MB, hiç indirilmez); yalnızca dağıtım boyutunu etkiler.

**Eksik / bilinen sorunlar:** bkz. `docs/ANALYSIS.md`.

## Faz 10 — Gerçek Model Entegrasyonu ✅ (2026-10-18)

**Yapılanlar**

- **GLB hattı** (`car/model/modelLoader.ts`): GLTFLoader + Draco (geometri) + KTX2/Basis (doku) + Meshopt. Çözücüler `public/assets/decoders/` altında (CDN gerekmez; three güncellenince `npm run assets:decoders`). Aynı URL önbellekten gelir.
- **Manifest:** `model` alanı `public/` köküne göre GLB yolu (null = placeholder). Yeni opsiyonel alanlar: `modelEmptyOptions` (geometri gerektirmeyen seçenekler), `fitment` (gerçek modelde çamurluk ölçüleri; `axleBodies` varsa bunu kullanır). Doğrulayıcı ikisini de kontrol eder.
- **İsimlendirme kuralları** (`core/model/modelRules.ts`, saf mantık): `body__*` (her zaman görünür), `<slot>__<seçenek>`, `wheel_anchor_FL/FR/RL/RR`; Blender `.001` ekleri yok sayılır; adlandırılmış nesnenin çocukları onunla birlikte yönetilir. `engine__*` yalnızca blower kesik kaputta görünür.
- **Analiz ve yedekleme:** gövde yoksa model reddedilir (tamamen placeholder); modelde olmayan seçenek için yalnızca o slot placeholder çizer; bilinmeyen slot/seçenek, eksik/uzak tekerlek çapası, tanınmayan `paint_/mat_` adları uyarı verir. Uyarılar yükleme başına bir kez, slot başına özetlenmiş tek `console.warn` çıktısıdır.
- **Paylaşılan materyaller:** modeldeki `paint_<bölge>`, `mat_chrome`, `mat_glass`... oyunun materyalleriyle değiştirilir; boya tipleri, bölgesel boya, vinil, cam filmi ve far rengi modele de uygulanır.
- **`CarShell`:** model ya da placeholder + yedek slotları (CarRig'den ayrıldı); atölye ve test sürüşü aynı yolu kullanır.
- **Geliştirme:** `?model=assets/cars/x.glb` manifesti değiştirmeden model dener; `npm run assets:demo-model` kurallara uyan kutulardan örnek GLB üretir (`core/model/glbWriter.ts`).
- **Belgeler:** `docs/ASSET_GUIDE.md` (kurallar, materyal tablosu, sıkıştırma, yedekleme tablosu, kontrol listesi), `public/assets/CREDITS.json` + doğrulayıcı (`core/credits`).
- **Testler (299):** isim çözümleme, sentetik ve **gerçek GLB** (kendi GLB yazıcımızla üretilip GLTFLoader ile ayrıştırılan) analizleri, görünürlük/yedek kararları, materyal bağlama, model URL, hazırlama uyarıları, manifest alanları, fitment geçersiz kılma, credits doğrulama.

**Doğrulama:** tip kontrolü, lint, 299 test, build yeşil. Tarayıcıda örnek GLB yüklendi (gövde/kaput/tavan GLB'den, eksik parçalar placeholder'dan), bölgesel boya (mavi gövde / yeşil kaput / sarı tavan) modele uygulandı, bulunmayan dosya konsola uyarı yazıp placeholder'a düştü.

**Notlar / kararlar**

- Gerçek model henüz yok; varsayılan araç `model: null` ile placeholder çiziyor. Kabul kriteri, kurallara uygun GLB'nin kod değişmeden devreye girmesi ve eksik parçada yedeğe düşmesi, örnek GLB ve testlerle gösterildi.
- Tekerlek konumu ve fizik manifesti esas alır; çapalar sadece doğrulama içindir.
- Draco/KTX2 ile **sıkıştırılmış** gerçek bir GLB tarayıcıda denenmedi (çözücü dosyalarının 200 ile servis edildiği doğrulandı).

**Eksik / bilinen sorunlar**

- Vite, three'nin içindeki varsayılan Draco/Basis kopyalarını da paketliyor (`dist/assets`, ≈3 MB kullanılmayan); Faz 11'de dışarıda tutulacak.
- Sürüşte egzoz alevi/uç efektleri placeholder yerleşimini kullanıyor; gerçek modelde uç konumları için manifest alanı gerekecek.
- Kamera/fitment ölçüleri `fitment` verilmezse hâlâ placeholder gövdesinden geliyor.

## Faz 9 — Kaydet/Yükle ve Fotoğraf Modu ✅ (2026-10-18)

**Yapılanlar**

- **Kalıcı depo** (`core/storage/`): IndexedDB (`garageStorage.ts`, slotlar + meta) ve bellek yedeği (IndexedDB yoksa/gizli pencerede). Slot = build JSON'u + 16:9 JPEG önizleme + ad/tarih. En fazla 24 slot.
- **Garaj servisi** (`garageService.ts`): kaydet (yeni/üzerine yaz, eski önizleme korunur), listele (en yeni önce), yükle (migration + manifeste göre normalizasyon), sil, anlaşılır hata kodları (`slot_limit`, `not_found`, `corrupt`, `invalid_json`, `wrong_car`, `storage`).
- **Otomatik kayıt / geri yükleme** (`persistence.ts`): her değişiklikten 0,8 sn sonra son oturum yazılır; sayfa açılınca geri yüklenir; sekme gizlenirken/kapanırken bekleyen kayıt hemen yazılır.
- **Boya presetleri** localStorage'dan IndexedDB'ye taşındı (eski veri açılışta otomatik aktarılıp silinir).
- **JSON dışa/içe aktarma:** `muscle-garage-build` zarfı (dosya, panoya kopyala); içe aktarma zarflı ya da çıplak BuildState, eski sürümler migration ile kabul eder, başka araca ait/bozuk dosya anlaşılır mesajla reddedilir.
- **Garaj editörü:** proje adı, Kaydet / Yeni olarak kaydet / Yeni proje, önizlemeli slot listesi (Yükle, iki tıklamalı Sil), paylaşım bölümü (dosya, pano, yapıştır).
- **Fotoğraf modu (§8.3):** serbest kamera (kaydırma + 16 m'ye kadar uzaklık), ayarlanabilir FOV (18–90°), alan derinliği (bulanıklık + odak aralığı, odak yörünge hedefini izler), pozlama (±2 EV, ton eşlemeden önce HDR çarpanı), çözünürlük 1×–4× (tarayıcı sınırına otomatik kısaltılır, çıktı boyutu gösterilir), döner tabla aç/kapa. H arayüzü gizler/gösterir, P fotoğraf çeker. Çekim post-processing sonrası kareyi alır; yüksek çözünürlükte piksel oranı geçici yükseltilip eski haline döner. PNG olarak indirilir.
- **Testler (272):** IndexedDB (fake-indexeddb) ve bellek yedeği için kaydet/yükle/sil/limit/otomatik kayıt, sayfa yenileme senaryosu, boya preseti taşıma, JSON dışa/içe aktarma ve hata kodları, fotoğraf boyut sınırları, dosya adı, ayar sınırları, çeviri kapsamı.

**Doğrulama:** tip kontrolü, lint, 272 test, build yeşil. Tarayıcıda (gerçek IndexedDB): değişiklik + sayfa yenileme sonrası build geri geldi, Garaj'a kaydedilen proje önizlemesiyle listelendi, fotoğraf editörü ve DoF çalıştı, 3× yakalama 3840×1894 dolu kare verdi (indirme tetiklenmedi), H ile arayüz gizlendi/gösterildi.

**Notlar / kararlar**

- Proje adı geri alınabilir bir modifiye sayılmaz (undo geçmişine yazılmaz).
- Otomatik kayıt ayrı bir gizli slottur (`__autosave__`); listede görünmez ve 24 slot sınırına dahil değildir.
- Dev kancaları: `__muscleGarage.useGarageStore`, `__muscleGaragePhoto.captureCanvas({ pixelRatio })`.

**Eksik / bilinen sorunlar**

- PNG indirme ve dosyadan içe aktarma (tarayıcı dosya penceresi) otomasyonla denenmedi; mantık birim testlerinde.
- Önizleme küçük resmi mevcut kamera açısından alınır (atölye menüsü açıkken araç sol panelin arkasında kalabilir).
- DoF yüksek çözünürlükte (4×) belleği zorlayabilir; 8192 px / 33 MP sınırı aşılmaz.
- Garaj slotları sürümlenmiş build JSON'u saklar; migration testleri var ama çok eski gerçek kayıt örneği yok.

## Faz 8 — Test Sürüşü ✅ (2026-10-18)

**Yapılanlar**

- **Pist** (`data/track/circuit.json`, `core/drive/track.ts`): kapalı Catmull-Rom spline, ≈1,9 km, 14 m asfalt + kerbler. 420 m'lik uzun düzlük, S/şikan, hızlı viraj ve 18 m yarıçaplı sıkı viraj. Yüzey sınıflandırma (asfalt / kerb / çim) ve yüzey başına tutuş/direnç.
- **Çevre:** çim, bariyerler (fizik çarpışmasıyla aynı segmentler, `core/drive/barriers.ts`), ağaç/kaya/lamba direği (tohumlu, tekrarlanabilir), iki tribün. Gün batımı ve gece (N tuşu / duraklat menüsü): gökyüzü, güneş/ay, sis, ortam yansıması, gecede far huzmeleri ve lamba başları.
- **Fizik** (`drive/physics/VehiclePhysics.ts`, Rapier raycast araç kontrolcüsü, 120 Hz sabit adım): atölyeden `deriveVehicleSpec` ile aktarılan değerler: sürüş yüksekliği → süspansiyon boyu ve ağırlık merkezi; jant+lastik çapı → tekerlek yarıçapı; lastik tipi/genişliği/kamber → tutuş; spacer → iz genişliği; spoyler/kit → downforce; parça ağırlıkları → kütle.
- **Güç aktarma** (`core/drive/drivetrain.ts`): tork eğrisi, vites oranları, otomatik vites, geri vites, motor freni, debriyaj kayması.
- **Performans** (BuildState v6, `core/performance/`): motor (stok/sokak/yarış), şanzıman (4/5/6 vites), fren, süspansiyon sertliği; süperşarjör Motor Görünümü'ndeki blower V8'den gelir. Performans editörü: istatistik çubukları (hover'da önizleme + fark), dyno grafiği.
- **Burnout / drift:** düşük hızda el freni + gaz = çizgi kilitli burnout; hızlıyken el freni arka tutuşu düşürüp kaydırır.
- **Kameralar** (C): arkadan, alçak takip, kaput, tampon; hıza duyarlı FOV.
- **HUD:** hız (km/s), rpm şeridi, vites, tur / son / en iyi süre, minimap, pist dışı uyarısı. Esc → duraklat menüsü (devam, başa dön, gün/gece, ses, atölyeye dön).
- **Efektler:** lastik izi (halka tampon), lastik dumanı ve çim tozu, gaz kesilince egzoz alevi (egzoz tipine göre uç konumları).
- **Ses (Web Audio, sentezlenmiş):** V8 ateşleme frekansı rpm'e bağlı, egzoz tipine göre ton, süperşarjör uğultusu, lastik çığlığı, rüzgâr.
- **Tur zamanı** (`core/drive/lap.ts`): sıralı kontrol noktaları, geri geçiş/kısayol = geçersiz tur, en iyi tur.
- **Atölye ↔ pist:** build (parça, boya, vinil, jant, duruş, performans) pistte görsel olarak aynı araç; Esc → "Atölyeye dön" build'i korur. Sürüş kodu (Rapier WASM dahil, 4,4 MB) tembel yüklenir; atölye paketi 1,8 MB kaldı.
- **Testler (232):** pist geometrisi/yarıçap/yüzey, tur zamanı, bariyer ve çevre yerleşimi, güç aktarma, `deriveVehicleSpec`, performans istatistikleri, **Rapier ile başsız fizik** (yerleşme, 0-100, fren, direksiyon yönü, burnout, geri vites, duruşa göre yükseklik, çim yüzeyi) ve **otopilotla tam tur** (stok ≈ 94 sn, tam ayarlı daha hızlı).

**Notlar / kararlar**

- Rapier fren değeri kuvvet değil adım başına azami itkidir (N·s) ve motor kuvveti varken yok sayılır: fren `dt` ile ölçeklenir; el freni + gazda arka motor kuvveti kesilir.
- Çizgi kilitli burnout'ta tekerlek patinajı kozmetiktir (duman, iz, ses, rpm); gaz+hareket halinde de çekiş sınırı aşılınca patinaj işaretlenir.
- Süperşarjör ayrı bir alan değil, `parts.engine === 'blower_v8'` (görsel ile performans tek yerden).
- Gamepad desteği yok (klavye): UI cilası/Faz 11.
- Dev kancaları (sadece `npm run dev`): `window.__muscleGarageDrive` (`input.override`, `physics`), `window.__freeCamera = true` (kamera elle), `__muscleGarageThree.camera`.

**Doğrulama:** tip kontrolü, lint, 232 test, build yeşil. Tarayıcıda: pist ve HUD, burnout dumanı + tur zamanlayıcı, duraklat menüsü, gece modu, atölyeye dönüş, Performans editörü gözle doğrulandı. Egzoz alevi ve ses (kulakla) gözle/kulakla doğrulanmadı.

**Eksik / bilinen sorunlar**

- Test makinesinde (Intel UHD, yazılım çizimine yakın) sürüş 5–35 FPS; hedef donanımda (≥60 FPS) ölçülmedi. Fizik sabit adımlı olduğundan düşük FPS'te simülasyon yavaşlar (adım sınırı 10/kare), doğruluk bozulmaz.
- Rapier araç modelinde yan yatma (roll) kontrolü yok; çok sert virajda devrilirse 2 sn sonra otomatik düzeltilir (R: elle).
- Otopilot dışında insan sürüşü gerçek klavye ile denenmedi (girdi `override` ile test edildi).
- Hacimsel olmayan gece aydınlatması: lambalar ışık havuzu atmıyor (sadece emissive + bloom).
- Underglow (Faz 7) pistte henüz yansıtılan ışık atmıyor; neon tüpleri görünüyor.

## Faz 7 — Diğer Görsel Modifiyeler ✅ (2026-10-18)

**Yapılanlar**

- **CarRig hiyerarşisi:** dış grup lastik büyüklüğüyle yükselir/eğilir; içinde tekerlekler (yerde kalır) ve gövde grubu (süspansiyonla hareket eder). Vinil kökü, gizmo ve slot parçaları gövde grubunda; vinil projeksiyonu gövdeyle birlikte hareket eder.
- **Duruş (§5.5):** ön/arka sürüş yüksekliği (-80…+100 mm), kamber (-8…+2°), spacer (0–40 mm, çamurluk tipinin katalogdaki spacer sınırıyla kesilir). Tekerlekte kamber (dönüş) ve spacer (dışarı kayma) görsel olarak uygulanır. Hazır duruşlar: Stok, Rake, Slammed, Gasser, Pro-Touring.
- **Fitment:** checkFitment artık sürüş yüksekliği, spacer ve kamberi hesaba katar (negatif kamber iç davlumbaza, pozitif kamber dış taşmaya ekler). Duruş editöründe canlı uyarı.
- **Cam filmi:** koyuluk %0–95 + renk tonu; materyale yerinde uygulanır (applyLook).
- **Far rengi:** lens ve LED halo emisyonu senkron.
- **Underglow:** zeminde parlama dokusu, araç altı neon tüpleri ve 4 nokta ışık; renk ve yoğunluk ayarlı, gövde alçalınca neon da iner.
- **UI:** Duruş editörü, Işıklar & Camlar editörü (far/stop seçenekleri dahil); ortak kontroller garage/ui/controls.tsx dosyasına taşındı. Manifest categoryCameras ile slotsuz kategorilere kamera.
- **Motor görünümü / roll cage / blower cutout:** Faz 1'den beri çalışıyor; kabul kriteri (blower cutout kaputla motor görünür) sağlanıyor.
- **Testler (177):** duruş sınırları/preset/sanitize, gövde yükselmesi ve eğimi, spacer limiti, fitment spacer/kamber, v4→v5 migration, store sürükleme = tek undo adımı.

**Doğrulama:** tip kontrolü, lint, 177 test, build yeşil. Tarayıcıda (dev) slammed duruş + kamber + spacer, cam filmi, mavi far, underglow ve iki editör gözle doğrulandı; konsol hatası yok.

**Notlar / kararlar**

- Gövde eğimi (pitch) pivotu araç orijini (iki aks ortası); rake görünümü kabaca doğru, ince ayar gerçek modelle (Faz 10).
- Kamber tekerleği tekerlek merkezi etrafında döndürür; fren/kaliper tekerlekle birlikte yatar (kaliper hâlâ göbeğe bağlı, kozmetik fark).
- Underglow nokta ışıkları gölge atmaz; Düşük kalitede ayrıca kapatılmadı (Faz 11 optimizasyonu).
- Duruş fiziğe (süspansiyon, tutuş) Faz 8'de aktarılacak.

**Eksik / bilinen sorunlar**

- Underglow zemin parlaması zemin yansımasında çift görünmez (yansıma sadece neon tüplerini gösterir).
- Duruş editöründe ön/arka bağlama kutusu yok (preset veya iki aks ayrı ayar).

## Faz 6 — Vinil Editörü (Gelişmiş) ✅ (2026-10-17)

**Yapılanlar**

- **Şekil kütüphanesi (§7.4):** temel şekiller, çizgi, şerit, eğik şerit, kavisli (C) şerit, gradyan şerit (renk soluyor), 3 alev parçası, şimşek, ok, köşeli ok, damalı desen, 0–9, A–Z + ÇĞİÖŞÜ ve - . ! / #. Kategorilere ayrıldı (Temel, Şeritler, Grafik, Rakam, Harf).
- **Orijinal çizgi fontu** (`vinyl/shapes/strokeFont.ts`): 4×6 ızgara iskeleti; 4 stil (Blok, Yuvarlak, İnce, Hız/italik).
  - Kalem çizgileri yüzey metresinde çizilir; yan yüzeylerin kare olmayan piksellerinde de kalınlık fiziksel olarak eşit kalır.
  - Türkçe büyük harf dönüşümü (i→İ, ı→I).
- **Yazı aracı:** yazı katmanı (metin + font, doğal oranla yerleşir), seçili yazıyı güncelleme ve "Şekle dönüştür" (harf başına katman, aynı yer/boy/açı/renk, tek grup).
- **Maske / kesme:** değiştirici katman çizilmez; altındaki en yakın normal katmanı ara canvas'ta kırpar (destination-in) veya siler (destination-out). Art arda birden fazla değiştirici sırayla uygulanır; opaklık yumuşak maske verir.
- **Gruplar ve çoklu seçim:**
  - Araçta veya listede gruplu katmana tıklamak tüm grubu seçer; Alt ile tek üye, Shift/Ctrl ile seçime ekleme/çıkarma.
  - Grupla / çöz: üyeler bitişik tutulur. Grup tek parça olarak sıralanır, çoğaltılır (yeni grup kimliğiyle) ve silinir.
  - Grup dönüşümü (aynı yüzde): taşı, merkez etrafında döndür, eşit ölçek (üye sınırları korunur); turuncu gizmo.
- **Hazır setler** (`data/vinyl/sets.json`, orijinal): Ralli Şeritleri, Arı Bandı, Yan C Şerit, Alevler, Yarış Numarası, Damalı Bayrak. Tek undo adımıyla eklenir; yüz başına grup olur.
- **Vinil grubu dışa/içe aktarma:** seçim (gruplarıyla) veya tümü JSON olarak; panoya kopyalama veya dosyaya kaydetme, metinden veya dosyadan yükleme. İçe aktarılan katmanlar yeni kimlik alır ve tek grup olarak gelir (başka tasarıma taşınabilir).
- **Klavye kısayolları:** Del, Ctrl+D, Ctrl+G, Ctrl+Shift+G, Ctrl+A, ok tuşları (Shift: büyük adım), [ ] ile sıralama (Ctrl: en alt/üst), M mıknatıs, V seç, P yerleştir.
- **Mıknatıs:** taşırken ızgaraya ve orta çizgiye (u=0.5) yakalar, döndürmede 15° adım.
- **Simetri:** yazı/harf/rakam kopyaları ayna yazısı olmaz, okunur kalır.
- **Testler (165):** kütüphane kapsamı, font (Türkçe, sınırlar, stiller), yazı → şekil, maske planı, gruplama/seçim/sıralama/çoğaltma, grup dönüşümleri, mıknatıs, dışa/içe aktarma, setler, çeviri kapsamı.

**Notlar / kararlar**

- Grup dönüşümünde sadece eşit ölçek var (dönmüş üyelerin eşit olmayan ölçeği tek katman modeliyle ifade edilemez); eğme sadece tek katmanda.
- Maske/kesme etkisi altındaki tek katmana (veya katman bloğuna değil) uygulanır.
- "Şekle dönüştür" kütüphane harflerini (Blok stil) kullanır.
- **Görsel doğrulama yapılamadı:** Faz 6 sırasında sistem belleği azaldığı için dev sunucusu sistem tarafından durduruldu ve talimat gereği yeniden başlatılmadı. Doğrulama birim testleri, tip kontrolü ve build ile yapıldı; tarayıcıda gözle kontrol bekliyor.

## Faz 5 — Vinil Editörü (Temel) ✅ (2026-10-17)

**Yapılanlar**

- **Kutu projeksiyonu (§7.1):** 5 yüzey (sol, sağ, üst, ön, arka); her biri ayrı canvas + doku (sol/sağ 2048×1024, üst 1024×2048, ön/arka 1024×512, `data/vinyl/config.json`).
  - Boya shader'ı car-space konum/normal ile 5 dokudan normal ağırlıklı (triplanar mantığı, keskinlik 4) örnekler. Kapı, kaput ve tampon gibi ayrı mesh'lerde desen kesintisiz devam eder; aşağı bakan yüzlerde vinil yumuşakça kaybolur.
  - Vinil taban renge karışır ve vernik (clearcoat) üstte kalır; vinil altında metal pullar ve metalik etki bastırılır.
- **Katman modeli (§7.2):** `VinylLayer` birebir. Saf işlemler: ekle, sil, çoğalt, sırala (yukarı/aşağı/en üst/en alt), güncelle, 500 katman limiti, kayıttan okurken sanitize.
- **Dönüşüm:** konum (0..1), döndürme, ölçek (fiziksel metre; en-boy oranı yüzeye göre bozulmaz), eğme, yatay/dikey çevirme. Aynı afin dönüşüm canvas çizimi, gizmo ve seçim testi için kullanılır.
- **Simetri:** sol ↔ sağ yüz aynalanır; üst/ön/arkada araç orta çizgisine göre aynı yüzde kopya oluşur.
- **Araca tıklama:** raycast → yüz normali ile projeksiyon yüzü → (u, v). "Yerleştir" aracı seçili şekli koyar, "Seç" aracı en üstteki katmanı seçer (kilitli olanlar hariç; ayna kopyasına tıklamak kaynağı seçer). Boşluğa tıklamak seçimi bırakır.
- **Gizmo (projeksiyon düzleminde, 3D):** taşıma (iç alan), köşelerden ölçek (Shift: oranı koru), turuncu halkadan döndürme (Shift: 15°), sarı elmaslardan yatay/dikey eğme. Tutamaklar ekranda sabit boyuttadır. Sürüklerken kamera kontrolü kapanır; kamera düzlemin arkasındaysa gizmo gizlenir.
- **Geri al:** sürüklerken önizleme yapılır, bırakınca tek undo adımı yazılır (100 adım).
- **Şekil kütüphanesi (temel):** daire, halka, kare, yuvarlak kare, üçgen, baklava, altıgen, yıldız, şerit, eğik şerit, ok, köşeli ok, şimşek; SVG path tabanlı, orijinal.
- **UI:** Vinil kategorisi.
  - Araç seçimi (Yerleştir/Seç), yüzey görünümleri (Sol/Sağ/Üst/Ön/Arka kamera preset'leri), şekil paleti, renk (hex + palet).
  - Seçili katman: opaklık, döndürme, ölçek X/Y, eğme X/Y, çevirme, simetri, sıralama, çoğalt, sil.
  - Katman listesi (görünürlük, kilit, seçim, sayaç). Delete tuşu seçili katmanı siler.
- **BuildState v4:** `vinyl` eklendi; v3 → v4 migration yazıldı.
- **Testler (136):** projeksiyon gidiş-dönüşü ve yön kuralları, sol/sağ u simetrisi, yüz seçimi, fiziksel ölçek, afin ters dönüşüm, canvas piksel dönüşümü, ayna örnekleri, katman işlemleri ve limit, sanitize, seçim testi, gizmo hesapları, kayıt/migration, ≥100 undo ve sürükleme = tek adım.

**Performans** (Intel UHD entegre GPU, 200 katman, Orta kalite)

- Boşta 60 FPS. Bir katmanı her karede sürüklerken 30–38 FPS. Sadece değişen yüzey yeniden çizilir; sürüklemede ayna kopyası varsa sadece iki yüz.
- Bulunan ve düzeltilen darboğazlar:
  1. **sRGB işaretli canvas dokusu:** her yüklemede ~70 ms sürüyordu (sürüklerken 13 FPS). Doku ham yükleniyor, sRGB → lineer dönüşümü shader'da yapılıyor.
  2. **Gizmo:** her karede geometri yeniden oluşturuyordu; artık kalıcı geometri yerinde güncelleniyor.
  3. **Editör:** 200 satırlık liste her karede yeniden çiziliyordu; liste memo'landı, seçili katman paneli sadece kendi katmanına abone.
  4. **Önizleme:** immer olmadan yazılıyor, büyük liste her karede dondurulmuyor.
- Kalan maliyet bu GPU'da doku yeniden çizimi + yükleme ile React güncellemesinin toplamı (her biri tek başına 60 FPS). Orta seviye masaüstü GPU'da sorun olmaması beklenir; hedef donanımda doğrulanmalı.

**Notlar / kararlar**

- **Geliştirme kancaları** (sadece `npm run dev`): `window.__muscleGarage` (store'lar), `__muscleGarageVinyl`, `__muscleGarageThree`. Performans ve hata ayıklama betikleri için; production build'den çıkarılır.
- **Seçim (hit test):** şeklin sınır kutusuna göre yapılır (şekil konturuna göre değil).
- **Maske/cutout (`maskMode`):** saklanır ama çizimde yok sayılır (Faz 6).

**Eksik / bilinen sorunlar**

- Gizmo zemin yansımasında da görünüyor (kozmetik).
- Çok eğimli yüzeylerde (kaput-çamurluk geçişi, tavan kenarı) projeksiyon gerilmesi var; yumuşak geçiş uygulandı ama spesifikasyonda da bilinen kısıt.
- Faz 6 kapsamı: gruplama, maske/cutout, yazı aracı, hazır setler, tam şekil kütüphanesi, vinil grubu içe/dışa aktarma, kısayollar.

## Faz 4 — Atölye Atmosferi ✅ (2026-10-17)

**Yapılanlar**

- **Oda** (`garage/scene/GarageRoom.tsx`), tamamen prosedürel:
  - Tuğla arka/ön duvar (renk + normal), oluklu sac yan duvarlar, tavan ve kirişler.
  - Görünür tavan şerit softbox'ları ve araç çevresinde 8 dikey LED stant.
  - Yan duvarlarda turuncu/turkuaz LED şeritler, arka duvarda orijinal neon tabela (hız çizgileri + şimşek).
  - Aksesuarlar: takım dolabı, lastik yığınları, variller, tezgah.
- **Zemin:** prosedürel beton (renk + pürüzlülük, derz çizgileri) ve `MeshReflectorMaterial` ile yansıma. Düşük kalitede yansıma kapalı.
- **Döner tabla:** zemine gömülü yarı saydam disk (zemin yansıması altından görünür), turuncu LED halka ve araç altında yumuşak gölge; araçla birlikte döner.
- **Işıklar:**
  - Gölgeli tepe ana spot, hacimli huzme veren iki tavan spotu (drei `SpotLight volumetric`).
  - Tuğla duvarı yalayan 3 spot, sıcak yan dolgu, soğuk arka kontur, sönük gök/zemin dolgusu.
  - Üstel sis.
- **Ortam haritası:** Lightformer panelleri görünür armatürlerle aynı konumlarda (tavan şeritleri, stantlar, LED şeritler, neon). Boya/krom yansımaları sahne ışıklarıyla tutarlı. Ayrı HDRI dosyası gerekmedi.
- **Post-processing** (`garage/fx/PostFX.tsx`): N8AO → Bloom (mipmap) → Tone mapping → prosedürel renk düzenleme LUT'u (`colorGrade.ts`: gölgede teal, parlakta turuncu, kontrast/doygunluk) → vinyet → SMAA/FXAA.
- **Kalite ayarları** (`data/graphics/quality.json`): Düşük/Orta/Yüksek/Ultra. Seviyeler şunları değiştirir: DPR, gölge haritası, zemin yansıması ve çözünürlüğü, AO, bloom, hacimli ışık, boya pulları, AA. Seçim tarayıcıda saklanır.
- **Üst çubuk:** Grafik kalitesi, Ton (ACES/AgX) ve FPS göstergesi. FPS üzerine gelince çizim çağrısı ve üçgen sayısı da görünür.
- **Kamera:** sınırlı orbit (oda içinde kalır), slot/bölge/aks preset geçişleri ve döner tabla Faz 1–3'ten devam ediyor.
- **Testler (110):** LUT (nötr = birim dönüşüm, tonlama yönü, float veri ve aralık), kalite ayarlarının maliyet sırası, ayar sanitize.

**Kararlar**

- **Tone mapping (§17 açık kararı):** kullanıcı karşılaştırma görüntülerine bakarak seçti (`docs/tonemapping/`). Varsayılan **ACES** (daha doygun, dramatik); oyuncu üst çubuktan AgX'e geçebilir.
- **Kenar yumuşatma:** Düşük/Orta FXAA, Yüksek/Ultra SMAA.
- **HDRI dosyası yerine** sahneyle aynı yerlerde ışık panelleri olan prosedürel ortam haritası kullanıldı (asset bağımsızlığı, sahneyle birebir uyum).

**Bulunan ve düzeltilen hata**

- postprocessing `LookupTexture` float veri bekliyor. Uint8 LUT verisi geçersiz doku oluşturuyor; zincirdeki efekte göre ya tamamen siyah ekran (SMAA/MSAA ile) ya da zeminde siyah lekeler (FXAA ile) çıkıyordu. LUT artık `Float32Array`.

**Performans (ölçüm)**

- Test makinesi: **Intel UHD (entegre)**, 1280×575 tuval. FPS: Düşük 58 · Orta 52 · Yüksek 48 · Ultra 14.
- Spesifikasyonun hedefi (orta seviye masaüstü GPU, 1080p, Yüksek ≥ 60 FPS) bu makinede doğrulanamadı. Orta seviye masaüstü GPU'lar bu entegre GPU'dan kat kat hızlı olduğundan hedefin tutması beklenir, ama **hedef donanımda ölçülmesi gerekiyor** (üst çubuktaki FPS göstergesi).
- Düşük kalitede bile 60'ın altında olması, maliyetin efektlerden çok temel çizimden (fiziksel boya shader'ları, çok sayıda küçük mesh / çizim çağrısı) geldiğini gösteriyor. Bu, Faz 11'in (çizim çağrısı azaltma, geometri birleştirme) konusu.

**Eksik / bilinen sorunlar**

- Ultra, entegre GPU'da çok ağır (DPR 2 + tam çözünürlük AO + 4096 gölge); güçlü GPU'lar için.
- Fotoğraf modu (serbest kamera, DoF, yüksek çözünürlüklü PNG) Faz 9'da.
- Hacimli huzmeler basit konilerdir (gerçek ışık saçılması yok).

## Faz 3 — Jant, Lastik, Fren ✅ (2026-10-17)

**Yapılanlar**

- **Veri:** `src/data/wheels/`
  - `limits.json`: çap 14–22" tam inç, genişlik 6–12" (0,5 adım), ET -30…+45, lastik genişliği/yanak oranı, disk aralığı.
  - `styles.json`: stil başına kol sayısı ve dudak aralığı, varsayılan kaplama.
  - `defaults.json`: stok kurulum, 15×7 / 15×8 klasik 5 kol, 225/60 – 245/60, beyaz yazılı lastik.
- **BuildState v3:** `wheels {front, rear}`, `tires {front, rear}`, `brakes` eklendi; v2 → v3 migration yazıldı. Tüm değerler `normalizeFitment` ile adımlanır/sınırlanır. Disk, küçük janta sığacak şekilde otomatik küçültülür. Drag radial ön aksta engellenir.
- **Saf hesaplar** (`core/wheels/`):
  - Lastik dış çapı.
  - Esnetilmiş / normal / dolgun görünüm (genişlik oranı).
  - Jant çapına göre en büyük disk.
  - Gövdenin lastik büyüklüğüne göre yükselmesi ve eğimi (rake).
  - Fitment uyarıları: çamurluk kemerine sürtme, çamurluktan taşma (widebody/flare payı dahil), iç davlumbaza sürtme. Faz 7 için alçaltma parametresi şimdiden var.
- **Prosedürel jant** (6 stil): klasik 5 kol, çelik + dog-dish kapak, örgü (çapraz kollar), derin 3 parça (cıvatalı), modern çok kol, drag (delikli).
  - Lathe ile namlu ve dudak; extrude ile yüz/kol pencereleri; dish bükmesi; bijonlar ve merkez kapak.
  - Kaplamalar: krom, parlatılmış, gunmetal, mat siyah, boyalı, iki tonlu (boyalı yüz + işlenmiş dudak).
- **Lastik:** lathe profil. Yanak, genişlik/jant oranına göre şişer veya esner. Prosedürel diş normal haritası (sokak / yarı slik / drag radial). Yanak dokusu: düz siyah, beyaz yazılı (kurgusal "IRONHOOF RADIAL T/A"), beyaz bant.
- **Fren:** disk (düz / delikli / çizgili doku), şapka, 2/4/6 piston kaliper (boy ve renk ayarlanabilir), kollar arasından görünür.
- **Önbellek:** jant/lastik/fren geometrileri LRU önbellekte (aynı parametre tekrar üretilmez, eskiler `dispose` edilir). Kaplama ve renk geometriyi etkilemez.
- **UI:** Jantlar & Lastikler editörü.
  - Ön/arka bağlı veya staggered (aks sekmeleri).
  - Stil, ölçü, offset, dudak, kol sayısı, kaplama, renk, merkez kapak, bijon.
  - Lastik ölçüsü/yanak/tip ve hesaplanan dış çap.
  - Fren ayarları ve canlı fitment uyarıları.
  - Aksa göre kamera.
- **Testler (104):**
  - Değer sınırları, ölçü hesapları ve fitment senaryoları.
  - Tüm stillerin tüm çap × genişlik × kol × dudak uçlarında geçerli geometri üretmesi (300+ kombinasyon).
  - Kaliperin her çapta kol pencereleriyle örtüşmesi (görünürlük) ve önbellek/LRU davranışı.
  - Lastik profili, v2 → v3 migration, store undo/önizleme.

**Notlar / kararlar**

- **Dudak derinliği:** Kollar bağlantı pedinden içe (kalipere doğru) bükülemez, gerçek jantlardaki gibi. Bu yüzden ulaşılabilecek dudak derinliği genişlik ve offset ile sınırlıdır; UI bunu "ulaşılan dudak" notuyla gösterir. Bu sayede kaliper hiçbir ayarda kollara değmez.
- **Kaliper yerleşimi:** kaliper göbeğe sabittir; offset değişince jant hareket eder, fren hareket etmez.
- **Fitment ölçüsü:** çamurluk dudağı, tekerlek merkezi yüksekliğindeki gövde yan yüzeyi + `fenderOutsetMm` (parça kataloğunda: stok 0, hafif flare 25, widebody 60 mm).
- **Boya pulları:** yoğunluğu en fazla %20 yüzey kaplayacak şekilde sınırlandı ve metalik pul tonu yumuşatıldı. Yakın kamerada pullar fazla belirgindi.
- **Klavye:** kaydırıcı/onay kutusu odaktayken de Esc ve geri al/yinele çalışıyor.

**Eksik / bilinen sorunlar**

- Tekerlekler atölyede dönmüyor (test sürüşünde Faz 8).
- Yanak yazısı sadece dış yanakta; iç yanak düz.
- Fitment, gövdenin kaba placeholder ölçülerine göre hesaplanıyor; gerçek modelde (Faz 10) çamurluk ölçüleri manifestten okunmalı.

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

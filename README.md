# Muscle Garage

Tarayıcıda çalışan 3B araç modifiye atölyesi ve test sürüşü oyunu. Bir araç seç, parçalarını değiştir, boyayı, jantı, vinili, duruşu ve ışıkları ayarla, sonra pistte sür.

React + Three.js (React Three Fiber) ile yazıldı; sürüş fiziği Rapier ile çalışır.

## Özellikler

- **Araç seçimi:** Açılışta vitrin ekranı. Seçtiğin araç için atölyeye geçilir.
- **İki araç:**
  - **Vanta Stallion '70:** Prosedürel olarak üretilen özgün klasik muscle car.
  - **2013 Ford Mustang GT:** Hazır GLB model, model eşleme katmanıyla modifiye edilebilir hale getirildi.
- **Modifiye:**
  - Gövde parçaları: kaput, tamponlar, spoyler, etekler vb.
  - Boya bölgeleri, metalik, mat ve inci kaplamalar
  - Jant, lastik ve fren seçenekleri, jant uyumu kontrolü
  - Vinil editörü
  - Duruş: alçaltma, kamber, iz genişliği
  - Cam ve far/stop ışıkları
  - Performans parçaları (motor gücü, süspansiyon vb. sürüşe yansır)
- **Kayıt:** Slotlu garaj, araç başına otomatik kayıt, geri al / yinele. Veriler IndexedDB'de tutulur.
- **Fotoğraf modu:** Serbest kamera, FOV, efektler ve görüntü dışa aktarma.
- **Test sürüşü:** Rapier tabanlı sürüş fiziği, pist, tur zamanlayıcı, mini harita, ses.
- **Girdi:** Klavye ve gamepad.
- **Kalite:** Uyarlanabilir grafik kalitesi (Düşük / Orta / Yüksek), ses ayarları.

## Başlangıç

Node.js 20 veya üstü gerekir.

```bash
npm install
npm run dev        # geliştirme sunucusu (http://localhost:5173)
```

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Tür denetimi + üretim derlemesi |
| `npm run preview` | Derlemeyi yerelde önizle |
| `npm test` | Birim ve fizik testleri (Vitest) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Kontroller (test sürüşü)

| Eylem | Klavye | Gamepad |
| --- | --- | --- |
| Gaz / Fren | W, S | RT, LT |
| Direksiyon | A, D | Sol çubuk |
| El freni | Boşluk | A veya X |
| Kamera | C | Y |
| Pistte düzelt | R | B |
| Duraklat | Esc | Start |
| Sesi aç/kapat | M | |

## Proje yapısı

```
src/
  app/            Uygulama kabuğu, modlar (seçim / atölye / sürüş), kalite
  core/           Oyundan bağımsız mantık: build modeli, depolar, fitment, sürüş çekirdeği, model eşleme
  data/cars/      Araç verisi: manifest, gövde profili, parça kataloğu, modelMap
  car/            Araç sahnesi: prosedürel ve GLB modeller
  garage/         Atölye sahnesi, kamera, arayüz
  drive/          Sürüş modu: Rapier fiziği, pist, HUD, ses
  i18n/           Metinler (Türkçe)
docs/             Plan, analiz, ilerleme, varlık rehberi
```

Yeni araç eklemek için `docs/ASSET_GUIDE.md` dosyasına bakın. Araç verisi manifest ile tanımlanır; kurallara uymayan hazır modeller `modelMap.json` ile uyarlanır.

## Dokümanlar

- [`PROJECT_SPEC.md`](PROJECT_SPEC.md): Proje şartnamesi
- [`docs/PLAN_V2.md`](docs/PLAN_V2.md): V2 planı (çok araç, mobil, sürüş, HUD, iç mekan)
- [`docs/ANALYSIS.md`](docs/ANALYSIS.md): Analiz raporu ve açık işler
- [`docs/PROGRESS.md`](docs/PROGRESS.md): Faz faz ilerleme günlüğü
- [`docs/ASSET_GUIDE.md`](docs/ASSET_GUIDE.md): Model ve varlık hazırlama rehberi

## Durum

Faz 0–11 ve V2-1, V2-2 tamamlandı. Sırada sürüş mekaniği ve HUD (V2-3), mobil uyum (V2-4) ve Vanta iç mekanı (V2-5). Ayrıntılar `docs/PLAN_V2.md` içinde.

## Lisans ve krediler

Kod ve prosedürel varlıklar bu projeye aittir. **2013 Ford Mustang GT** modeli (Ddiaz Design) **CC-BY-NC-SA 4.0** lisanslıdır: yalnızca ticari olmayan kullanım içindir ve aynı lisansla paylaşılmalıdır. Üçüncü taraf varlıkların tam listesi `public/assets/CREDITS.json` dosyasında, oyun içinde de Krediler ekranında yer alır. Ford adı ve Mustang modeli ilgili hak sahiplerine aittir; bu proje onlarla bağlantılı değildir.

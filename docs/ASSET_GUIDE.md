# Model Hazırlama Kılavuzu (ASSET_GUIDE)

Bu kılavuz, gerçek bir araç modelinin (GLB) oyuna **kod değişmeden** nasıl ekleneceğini anlatır. Kurallara uyan model prosedürel placeholder'ın yerini alır; eksik parça olursa o parça placeholder'a düşer ve konsola uyarı yazılır.

## 1. Hızlı özet

1. Blender'da modeli aşağıdaki kurallara göre düzenle, **glTF Binary (.glb)** olarak dışa aktar.
2. Dosyayı `public/assets/cars/` altına koy.
3. Aracın `manifest.json` dosyasında `"model": "assets/cars/<dosya>.glb"` yaz (yol `public/` köküne göredir).
4. `npm run dev` ile aç, tarayıcı konsolunda `[Model]` uyarılarını oku ve gider.

Denemek için manifesti değiştirmeden: `http://localhost:5173/?model=assets/cars/<dosya>.glb` (sadece geliştirme sunucusunda).

Örnek bir uyumlu model: `npm run assets:demo-model` komutu `public/assets/cars/demo_conforming.glb` üretir (kutulardan oluşan kaba bir araç; kısmi model olduğu için çoğu parça placeholder'a düşer ve bunu uyarılarla gösterir).

## 2. Dosya biçimi ve koordinatlar

| Kural        | Değer                                                              |
| ------------ | ------------------------------------------------------------------ |
| Biçim        | GLB (glTF 2.0)                                                     |
| Birim        | metre                                                              |
| Yukarı eksen | Y                                                                  |
| Araç yönü    | **+Z** (burun +Z'ye bakar; aracın solu +X)                         |
| Orijin       | Zemin hizasında (Y = 0), iki aksın ortasında; yatayda araç merkezi |

Boyutlar manifestteki `dimensions` ile uyumlu olmalıdır (Vanta Stallion: 4,75 × 1,88 × 1,32 m, aks mesafesi 2,74 m).

## 3. Nesne isimlendirme

İsimler küçük harf, rakam ve `_` içerir. Slot seçenekleri **çift alt çizgi** (`__`) ile ayrılır: `<slot>__<seçenek>`.

- **Gövde:** `body__main` (zorunlu). Kapı, kaput kasası, bagaj gibi ek gövde parçaları `body__<ad>` (ör. `body__door_left`) olarak adlandırılır; hepsi her zaman görünür. `body__*` nesnesi yoksa **model kullanılmaz**, tamamı placeholder çizilir.
- **Slot seçenekleri:** manifestteki her slot seçeneği ayrı bir nesne olmalıdır. Örnekler: `hood__shaker_scoop`, `bumper_front__chrome_delete`, `exhaust__side_pipes`, `exhaust_tips__oval`. Sadece seçili seçeneğin nesnesi görünür; diğerleri oyun tarafından gizlenir.
- **Gruplama:** bir seçenek birden çok parçadan oluşuyorsa hepsini tek bir üst nesne (Empty/Group) altına koy ve üst nesneyi `slot__seçenek` adlandır. Adlandırılmış nesnenin altına inilmez; çocukları onunla birlikte görünür/gizlenir.
- **Tekerlekler modelde olmaz:** jant, lastik ve fren prosedürel üretilir. Modelde yalnızca `wheel_anchor_FL`, `wheel_anchor_FR`, `wheel_anchor_RL`, `wheel_anchor_RR` boş nesneleri (Empty) bulunur. Konumları manifestteki `wheels.<id>.position` ile 3 cm içinde uyuşmalıdır; uyuşmazsa uyarı verilir ve **manifest konumu kullanılır** (fizik ve fitment manifesti esas alır).
- Blender'ın kopya ekleri (`.001`) yok sayılır: `hood__stock.001` = `hood__stock`.

### Geometri gerektirmeyen seçenekler

`none` seçeneği için nesne gerekmez. Başka "yokluk" seçenekleri (ör. `bumper_front__chrome_delete`, `fenders__stock`, boyalı stok tavan) için manifestte belirt:

```json
"modelEmptyOptions": {
  "bumper_front": ["chrome_delete"],
  "bumper_rear": ["bumper_delete"],
  "fenders": ["stock"],
  "roof": ["painted"]
}
```

### Koşullu görünürlük

`engine__*` nesneleri yalnızca kaput `blower_cutout` iken görünür (kaput altında kalmasın). Kaputun kesik seçeneği `hood__blower_cutout` olarak modelde bulunmalı ve motor bölmesi görünmelidir.

## 4. Materyal isimleri

Aşağıdaki adlara sahip materyaller oyunun paylaşılan materyalleriyle **değiştirilir**; böylece boya, cam filmi, vinil ve far rengi modele de uygulanır. Başka adlar modelin kendi materyali olarak kalır.

| Model materyal adı                                                                               | Oyunda ne olur                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `paint_<bölge>` (ör. `paint_body`, `paint_roof`, `paint_hood`, `paint_mirrors`, `paint_bumpers`) | Boya sistemi (8 boya tipi + vinil, clearcoat altında). Bölge adları manifestteki `paintZones` ile aynı olmalı; olmayan bölge uyarı verir. |
| `mat_chrome`                                                                                     | Krom                                                                                                                                      |
| `mat_aluminum`                                                                                   | İşlenmiş alüminyum                                                                                                                        |
| `mat_black_trim`                                                                                 | Siyah plastik/trim                                                                                                                        |
| `mat_rubber`                                                                                     | Kauçuk                                                                                                                                    |
| `mat_carbon`                                                                                     | Karbon fiber (clearcoat)                                                                                                                  |
| `mat_vinyl_top`                                                                                  | Vinil tavan (deri dokulu)                                                                                                                 |
| `mat_glass`                                                                                      | Cam (cam filmi koyuluğu ve rengi uygulanır)                                                                                               |
| `mat_interior`                                                                                   | İç mekan                                                                                                                                  |
| `mat_headlight_lens`                                                                             | Far camı (far rengi uygulanır)                                                                                                            |
| `mat_taillight_lens`, `mat_taillight_smoked`, `mat_led_strip`, `mat_led_halo`                    | Stop / LED parçaları                                                                                                                      |
| `mat_engine_block`, `mat_engine_accent`, `mat_cage`                                              | Motor ve roll cage                                                                                                                        |

Boya bölgesi başına **tek materyal adı** kullan; bölge içindeki tüm yüzeyler aynı `paint_<bölge>` materyalini taşısın.

Vinil editörü, araç uzayında kutu projeksiyonu kullandığı için model UV'lerine ihtiyaç duymaz; ancak `paint_*` materyallerini kullanan yüzeylerde vinil görünür.

## 5. Poligon bütçesi ve sıkıştırma

- Gövde + tüm slot seçenekleri toplam **≤ 300k üçgen** (tüm seçenekler dosyada bulunur; aynı anda yalnızca seçilenler çizilir).
- Draco (geometri), KTX2/Basis (doku) ve Meshopt sıkıştırması desteklenir. Çözücüler `public/assets/decoders/` altındadır ve ağ olmadan çalışır (three sürümü güncellenince `npm run assets:decoders`).
- Önerilen dışa aktarma: Blender glTF 2.0 → "Draco mesh compression" açık, dokular için `gltf-transform` ya da `toktx` ile KTX2.
- Normal haritası ve ORM gibi dokuları 2048 px'i geçmeyecek şekilde tut.

## 6. Manifest alanları (özet)

| Alan                | Anlamı                                                                                                                                                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`             | `public/` köküne göre GLB yolu; `null` = prosedürel placeholder                                                                                                                                                                                                                                     |
| `modelEmptyOptions` | slot → geometri gerektirmeyen seçenekler (`none` dışında)                                                                                                                                                                                                                                           |
| `fitment`           | Gerçek modelde çamurluk ölçüleri (m, tekerlek merkezi yüksekliğinde): `front` ve `rear` için `fenderX` (çamurluk dudağı \|x\|), `archRadius` (kemer yarıçapı), `wellInnerX` (davlumbaz iç duvarı \|x\|). Verilmezse placeholder ölçüleri kullanılır; sürtme uyarıları bu değerlere göre hesaplanır. |

## 7. Yedekleme (fallback) davranışı

| Durum                                             | Sonuç                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Dosya yok / yüklenemedi / bozuk                   | Placeholder çizilir, konsola `[Model] ... yüklenemedi` yazılır                                       |
| `body__*` yok                                     | Model reddedilir, placeholder çizilir (`no_body`)                                                    |
| Bir slot seçeneği modelde yok (ve boş sayılmıyor) | O slot için placeholder parça çizilir (`missing_option`); uyarılar slot başına tek satırda özetlenir |
| Manifestte olmayan `slot__seçenek`                | Yok sayılır (`unknown_slot`, `unknown_option`)                                                       |
| Tekerlek çapası eksik/uzak                        | Manifest konumu kullanılır (`anchor_missing`, `anchor_mismatch`)                                     |
| `paint_<bölge>` bölgesi manifestte yok            | Modelin kendi materyali kalır (`unknown_paint_zone`)                                                 |

Uyarılar yükleme başına bir kez, tek bir `console.warn` çıktısında toplanır.

## 8. Lisans ve atıf

Üçüncü taraf modeller (Sketchfab "downloadable", **CC-BY veya daha serbest**; parçaları ayrı objeli olanlar tercih edilir) kullanıldığında atıf `public/assets/CREDITS.json` dosyasına yazılır ve oyun içi credits ekranında gösterilir:

```json
{
  "version": 1,
  "assets": [
    {
      "name": "Model adı",
      "author": "Yapımcı",
      "source": "https://…",
      "license": "CC-BY-4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "usedFor": "Vanta Stallion '70 gövdesi",
      "changes": "Parçalara ayrıldı, yeniden adlandırıldı"
    }
  ]
}
```

Gerçek marka/model adı, logo veya birebir kopya tasarım **kullanılmaz** (proje kuralı).

## 9. Kontrol listesi

- [ ] GLB, metre / Y yukarı / +Z ileri, orijin zemin hizasında
- [ ] `body__main` var
- [ ] Her slot seçeneği `slot__seçenek` adlı ayrı nesne (ya da `none` / `modelEmptyOptions`)
- [ ] 4 adet `wheel_anchor_*` boş nesne, manifest konumlarıyla uyumlu
- [ ] Boya bölgeleri `paint_<bölge>` materyali, krom/cam/kauçuk `mat_*` adlarıyla
- [ ] Toplam ≤ 300k üçgen, dosya sıkıştırılmış
- [ ] Gerçek modelde çamurluk ölçüleri manifestin `fitment` alanında
- [ ] Atıf `public/assets/CREDITS.json` içinde
- [ ] Konsolda beklenmeyen `[Model]` uyarısı yok

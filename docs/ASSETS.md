# 📦 SONSUZ YOLCU — Asset Envanteri & Lisans Dokümanı

> Son güncelleme: Faz 1 MVP asset turu (Faz 0 dönemi)
> Durum: **Faz 1 görsel seti TAMAM** · Biom seti (7)'den 1'i tamam

---

## 1. Lisans Özeti (ÖNEMLİ — değiştirme!)

| Kaynak | Lisans | Atıf zorunlu? | Ticari? | Ne için kullanılıyor |
|---|---|---|---|---|
| **Kenney.nl** (UI Pack, UI Audio, Interface Sounds, Music Jingles) | **CC0 1.0** (public domain) | ❌ Hayır | ✅ Evet | HUD/UI sprite'ları + tüm ses efektleri + jingle'lar |
| **AI üretimi** (bu workspace'te üretildi) | Proje içi serbest | — | ✅ | VOLT, biom arka planları, yol, engeller, kıvılcım |
| Shutterstock | Ücretli abonelik | — | ✅ (abonelikle) | **KULLANILMIYOR** — abonelik gerekli; istenirse kullanıcı indirip ekleyebilir |
| game-icons.net | CC-BY 3.0 | ✅ **Evet** (Faz 7'de kullanılırsa CREDITS'e eklenecek) | ✅ | (Faz 7) yükseltme kategorisi ikonları |

**Altın kural:** Oyuna üçüncü parti asset eklenirken bu tablo güncellenmeli. CC0 = rabıt yok; CC-BY = tek satır atıf zorunlu.

### Atıf metni (oyunun ayarlar/credits ekranına konulacak)
```
UI + Sesler: kenney.nl (CC0) —attributionsiz kullanım
Görseller: Sonsuz Yolcu projesi için özel üretildi
```

---

## 2. Klasör Yapısı

```
sonsuz-yolcu/
├── assets/
│   ├── client/                  ← oyunda kullanılacak görseller
│   │   ├── volt/                ← VOLT karakteri (AI üretim, şeffaf PNG)
│   │   │   ├── volt_main.png    ← ana tasarım (idle, 623x695 RGBA)
│   │   │   ├── volt_run.png     ← koşma pozu (381x334)
│   │   │   ├── volt_jump.png    ← zıplama pozu (319x471)
│   │   │   ├── volt_slide.png   ← kayma/eğilme pozu (312x274)
│   │   │   ├── volt_cheer.png   ← kutlama pozu (341x374)
│   │   │   └── volt_poses.png   ← (kaynak, 4'lü poz sayfası)
│   │   ├── biome/
│   │   │   └── meadow/          ← 🟢 Fısıltı Çayırı (1/7 biome)
│   │   │       ├── meadow_bg.png   ← paralaks arka plan (1376x768)
│   │   │       └── road_ground.png ← 3 şeritli yol (768x1376, dikey)
│   │   ├── obstacles/           ← engeller (şeffaf PNG)
│   │   │   ├── obs_boulder.png  ← yuvarlanan kaya (tam engel)
│   │   │   ├── obs_fence.png    ← çit (zıplanacak)
│   │   │   ├── obs_branch.png   ← dal kapısı (kayılacak)
│   │   │   └── obs_crystal.png  ← kristal küme (dekor/şerit engeli)
│   │   ├── pickups/
│   │   │   └── spark.png        ← kıvılcım (ana toplanabilir, glow'lu)
│   │   └── ui/
│   │       ├── kenney_ui-pack.zip
│   │       └── ui-pack/         ← 870 sprite! PNG/(Blue|Grey|Red|Yellow)/(Default|Double)
│   └── audio/kenney/            ← 238 .ogg dosyası (CC0)
│       ├── ui-audio/            ← 50 tık/switch/rollover sesi
│       ├── interface-sounds/    ← 100 UI sesi (open/close/error/confirm/glitch...)
│       └── music-jingles/       ← 85 jingle (NES/Hit/Pizzicato/Sax/Steel varyantları)
├── docs/
│   ├── ASSETS.md                ← bu dosya
│   ├── asset_kontrol.png        ← tüm sprite'ların şeffaflık kontrol sayfası
│   └── TASARIM.md               ← (Faz 0) oyun tasarım belgesi konacak
├── tools/
│   ├── process_sprites.py       ← zemin şeffaflaştırma + bölme scripti
│   └── split_v3.py              ← poz sayfası bölücü (son çalışan sürüm)
└── README.md
```

---

## 3. Ses → Oyun Eşleme Tablosu (Faz 1-4 kodunda kullanılacak)

| Oyun olayı | Dosya | Not |
|---|---|---|
| Buton tık | `ui-audio/Audio/click1-5.ogg` | HUD genel |
| Kıvılcım toplama | `interface-sounds/Audio/confirmation_001-004.ogg` | kısa, tatlı |
| Engel aşma / puan | `interface-sounds/Audio/select_001-008.ogg` | |
| Seviye atlama | `music-jingles/Audio/Hit jingles/jingles_HIT00-16.ogg` | kazandır |
| Rekor | `music-jingles/Audio/Sax jingles/...` | şov anı |
| Hata/tökezleme | `interface-sounds/Audio/error_001-008.ogg` | nazik ton seçilecek |
| Portal/biome geçişi | `interface-sounds/Audio/maximize_001-009.ogg` | yükselen ton |
| Kutu açılış | `interface-sounds/Audio/open_001-004.ogg` / `drop_*` | |
| Geri/iptal | `interface-sounds/Audio/back_001-004.ogg` | |
| Glitch Boyutu | `interface-sounds/Audio/glitch_001-004.ogg` | biome'a özel! |

---

## 4. UI Pack Kullanım Notu

Kenney UI Pack yapısı: `PNG/<Renk>/<Boyut>/<isim>.png`
- **Renk:** Blue, Grey, Red, Yellow → **VOLT teması için Yellow önerilir**, aksan için Blue
- **Boyut:** `Default` (1x) / `Double` (2x) → retina için Double al, CSS/Canvas'ta küçült
- Öne çıkanlar: `button_rectangle_*` (HUD butonları), `button_round_*` (sustur/duraklat), `slide_horizontal_*` (ses/mesafe barı), `star.png` (rekor), `check_*` (görev tikleri), `arrow_*` (şerit okları)

---

## 5. Faz 1 İçin Eksikler (sıradaki asset işleri)

- [ ] **6 biome daha** (Kristal Mağara, Bulut Şehri, Lav Vadisi, Buz Diyarı, Glitch Boyutu, Yıldız Yolu) — arka plan + yol + biome'a özel 3-4 engel
- [ ] **Zaman Kristali** toplanabilirı (nadir para birimi, spark'ın mor/mavi kardeşi)
- [ ] **Kıvılcım rotasyon kareleri** (toplanınca dönme animasyonu için 4 açı — ya da kodda döndürülür, asset gerekmez)
- [ ] VOLT **run animasyon kareleri** (şu an tek poz; 2-3 kare ile bacak animasyonu yapılabilir — kodda hafif salınım da olur, MVP için yeterli)
- [ ] Portal efekti görseli (biome geçişi, Faz 3)
- [ ] (Faz 7) game-icons.net'ten 6 yükseltme ikonu → **atıf zorunlu, CREDITS'e eklenecek**

---

## 6. Bu Assetler Nasıl Üretildi/İndirildi (tekrarlanabilirlik)

1. **Kenney:** `kenney.nl/assets/<paket>` sayfasındaki gizli ZIP linki (`/media/pages/assets/<paket>/<hash>/kenney_<paket>.zip`) ile `curl` indirildi, doğrulandı, açıldı.
2. **AI görseller:** İmage üretim aracıyla, tek stil dili ("bright cheerful vector-style cartoon, clean thick outlines, child-friendly") ile üretildi. VOLT karakter tutarlılığı için poz sayfası referans verilerek ana görsel yeniden üretildi.
3. **İşleme:** `tools/process_sprites.py` + `tools/split_v3.py`
   - Beyaz zemin → kenar-bağlı flood-fill ile şeffaf (göz içi beyazları korunur)
   - Lacivert zemin (spark) → arka plan renginden uzaklık bazlı glow alpha
   - Sayfa bölme: bağlantı bileşeni + sütun projeksiyonu + sabit fallback

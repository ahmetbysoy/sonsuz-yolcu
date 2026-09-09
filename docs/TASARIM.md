# SONSUZ YOLCU — Oyun Tasarım Belgesi (v4)
**Platform:** Telegram Mini App + GitHub | **Durum:** Tasarım tamamlandı, geliştirme sürüyor
*(Bu dosya projenin kanonik tasarım dokümanıdır — karar değişirse buraya işlenir)*

---

## BÖLÜM 1 — Tek Cümlelik Pitch
> Asla durmayan, kendi kendine oynayan, sen izledikçe konuşan, seviye atlayan ve arkadaşlarınla yarıştığın sonsuz bir macera. Oyunu açık tut = ilerle. Kapatıp açtığında kaldığın yerden (biraz ileriden) devam et.

**Tür karışımı:** Sonsuz Koşucu + Idle/Oto-ilerleme + Yapay Dost (Talking Tom ruhu) + Koleksiyon + Haftalık Rekabet

**Altın formül:**
```
İLERLEME = Açık Kalma Süresi × Hız Çarpanı × Boostlar + Etkileşim Bonusları
```

## Tasarım Felsefesi (değişmez kurallar)
1. Oyun asla bitmez, oyuncu başladığı yere dönmez.
2. İlerleme sürekli kaydedilir, asla sıfırlanmaz (lig puanı hariç).
3. Açık tutmak her zaman kazandırır; kapalı tutmak asla kaybettirmez, sadece yavaşlatır (uyku kazancı %10, 8 saat tavan).
4. Oyun kendi kendine oynanır — tüm etkileşimler bonus, hiçbiri zorunlu değil.
5. Karakter (VOLT) hep nazik ve komik, asla suçlamaz, hep özler.
6. Susturma her zaman 1 tık uzakta — ses asla zorunlu değil.
7. Çocuk dostu: şiddet/korku/agresif parayla-kazan mekaniği yok.
8. Bölge/olay sırası oyuncuya göre değişebilir — "bu benim maceram" hissi.
9. Rekabet sadece mesafe değil; keşif, süre, koleksiyon üzerinden de olur.

## BÖLÜM 2 — Neden İnsanlar Saatlerce İzler?
1. **Sıfır efor, yüksek uyaran** · 2. **Parasosyallik** (VOLT seni özler) · 3. **Öngörülemezlik** (değişken ödül) · 4. **Vekaleten başarma** · 5. **Near-miss anları** · 6. **Tamamlanma dürtüsü** · 7. **FOMO** (Altın Dakika, portal teaser) · 8. **Yorum/şov** (TTS gevezelik)

**Tasarım kararı:** "Oyun" değil, "canlı şov + evcil dost + yarış". Ekran her 5-10 saniyede küçük bir olay üretmeli.

## BÖLÜM 3 — Tema: "Sonsuz Yolcu: Işık Peşinde"
**Karakter: VOLT** — kısa, sevimli, TTS'de iyi okunuyor, maskotlaşabilir.
**Lore:** Dünyanın "Işık Kaynakları" paramparça olup sonsuz yola saçıldı. VOLT durursa dünya kararır, o yüzden asla duramaz. Oyuncu onun "Koruyucusu"dur. Kapanınca "uyku modunda" yavaşça süzülür ama asla başa dönmez.

## BÖLÜM 4 — Oyun Çerçevesi

### 4.1 Çekirdek Döngü
KARAKTER SÜREKLİ KOŞUYOR: 🟢 Düz yol (toplama+gevezelik) · 🟡 Engel bölgesi (oto-manevra, dokunuşla bonus) · 🔴 Tehlike anı → Kaçış Sekansı (4.5b) · 🟣 Fırsat anı (bonus) · 🔵 Keşif anı (gizemli kapı, ayna, tabela)

### 4.2 Kontroller
**Otomatik:** koşma, şerit, zıplama, kayma, toplama. **Dokunmatik (bonus):** tap, double-tap (kalp→%5 hız), long-press, swipe (takla/drift), sallama (günde 3). **Sesli komut:** "zıpla", "dans", "hızlan"... + fallback butonlar (iOS/Telegram-desktop desteklemez).

### 4.3 İlerleme
- Mesafe (m) ana skor; seviye logaritmik; her seviye +baz hız; 10 seviyede Işık Patlaması.
- Kaynaklar: **Kıvılcım** (soft) + **Zaman Kristali** (nadir).
- Kayıt: 5 sn'de bir + kapanışta + rekor/seviyede.
- **Uyku modu:** %10 hızla max 8 saat. Açılışta "Yokken X m süzüldün" ekranı. *(v4 kabul: ceza değil güvenlik ağı)*

### 4.4 Biomlar (her ~500m)
Fısıltı Çayırı → Kristal Mağara → Bulut Şehri → Lav Vadisi → Buz Diyarı → Glitch Boyutu → Yıldız Yolu → (2. tur: daha hızlı, daha parlak). Geçiş = 1.5 sn portal + TTS anonsu.

### 4.5 Dopamin Olayları (30-90 sn)
Gizemli Portal · Altın Dakika (60sn 2x) · Sürpriz Yumurta · Gölge Kovalamacası · Gökkuşağı Köprüsü · Uçan Kutu · Kayıp Kaset · Kombo Çılgınlığı · Az-Kalsın Slow-motion · Yıldız Yağmuru · Gizemli Tüccar · Bilmece.
**Glitch Boyutu'na özel:** Ters Yerçekimi · Dev Mod · Mini Mod · Disco Mod · Zaman Yavaşlatma.

### 4.5b Kaçış Sekansları (dövüşsüz)
Kaya Kaçışı · Gölge Kovalamacası · Sel Baskını · Zemin Çöküşü · Boyut Kayması · İkiz Kaçış. Statlar: **Stamina, Çeviklik, Refleks bonusu** (savaş statı YOK).

### 4.6 Koleksiyon
50+ "Yol Hatırası" + kostümler + petler. % göstergesi her zaman görünür.

### 4.7 Rekabet
Haftalık ligler (Bronz→Işık Ustası, Pazartesi sıfır) · Global Top 100 + arkadaşlar · Hayalet rakip · Yükseltmeler (Mıknatıs Ruhu, Işık Kalkanı...) · Ek kategoriler (En Uzun Kaçış Serisi vb.) · Anti-hile: sunucu saati + heartbeat.

### 4.8 TTS + Konuşma
Web Speech API (tr-TR, pitch ~1.2, rate ~1.05) · 100+ replik kategorili · dinamik şablonlar ({mesafe},{isim}) · 20-40 sn'de replik + olay anında zorunlu · sustur hep görünür.

### 4.9 Günlük Tutundurma
Günlük sandık (7. gün kristal) · 3 mini görev · gece bonusu (22:00-02:00) · bot bildirimi (günde 1, kapatılabilir).

## BÖLÜM 5 — Ek Fikirler
Ruh hali barı · Hatıra defteri · Sezon hikâyesi · İsim verme · Doğum günü · Hava senkronu · Arkadaş ziyareti · Fotoğraf modu · Ninni modu · Prestij unvanları (sıfırlama YOK).

## BÖLÜM 6 — Teknik Mimari
```
Telegram Mini App (HTML5 Canvas 60fps, Web Speech API, Telegram SDK, LocalStorage+senkron)
Backend: Node.js + SQLite hedefi (Faz 2 MVP: sıfır-bağımlılık http + JSON depo, arayüz aynı)
Repo: monorepo (/client /server /docs /assets /tools)
```
**Riskler & çözümler:** WebView arka planda çalışmaz → açık kalma = sekme + heartbeat (15sn) · iOS'ta SpeechRecognition yok → buton fallback · TTS dokunuş gerektirir → BAŞLA butonu · Performans → sprite havuzu, partikül limiti.

## BÖLÜM 6.5 — Asset Stratejisi
- **Stok (Shutterstock) YERİNE:** Kenney CC0 (UI + sesler) + AI özel üretim (VOLT, biomlar). Detay: `docs/ASSETS.md`
- **VOLT stoktan alınmaz** — marka kimliği özel üretilir. ✅ (yapıldı)
- game-icons.net (Faz 7 ikonları): CC-BY → atıf zorunlu.

## BÖLÜM 7 — Faz Planı
| Faz | İçerik | Durum |
|---|---|---|
| 0 | Kurulum + Telegram bağlantısı + docs | ✅ (@sonsuzyolcu_bot canlı) |
| 1 | Oto-Koşucu MVP | ✅ (duman testi 18k kare, 0 hata) |
| 2 | Kayıt + Uyku Kazancı (sunucu) | ✅ (API testleri geçti) |
| 3 | Biomlar + Olaylar + Koleksiyon | ✅ (v10: 3 biome + 5 olay + 12 hatıra, sunucuda merge) |
| 4 | TTS + Kişilik + Replikler | ✅ (v11: VoltSpeak tr-TR + lookback duygu senkronu) |
| 5 | Dokunmatik Şov + Sesli Komutlar | 🟨 (v8a bonus dokunuşlar + v11 sesli komut/fallback; cihaz sallama yok) |
| 6 | Ligler + Sıralama + Hayalet Rakip | ⏳ |
| 7 | Yükseltme + Petler + Kostümler | ⏳ |
| 8 | Görevler + Sandıklar + Bildirimler | ⏳ |
| 9 | Deploy + Test + Analitik | ⏳ |
| 10 | v2 Vizyonu (sezon bileti, klanlar...) | ⏳ |

## BÖLÜM 8 — Karar Defteri (Değişmez Kurallar)
1. Asla sıfırlanmaz: toplam mesafe/koleksiyon silinmez (lig puanı hariç)
2. Açık tutmak kazandırır, kapalı tutmak kaybettirmez
3. Oyun kendi kendine oynanır
4. VOLT hep nazik ve komik, asla suçlamaz
5. Susturma 1 tık uzakta
6. Çocuk dostu
7. Dövüş yok — dövüşsüz kaçış sekansları

## BÖLÜM 9 — Karar Geçmişi (reddedilenler)
- Offline %50-75 ilerleme → RED (v4'te %10/8sa yumuşak uyku kazancı kabul)
- Prestij tam sıfırlama → RED (sadece unvan/rozet)
- Filo PvP savaşları → RED · Gerçek parayla gacha → RED (Stars sadece kozmetik, v2)
- Suç lordu teması → RED · 3+ para birimi → RED (kıvılcım + kristal)
- Zorunlu NFT → RED · Tam RPG dövüş sistemi → RED · "Sonsuz Rüya" tema değişimi → ALINMADI (ruya-mantığı Glitch Boyutu'na verildi)

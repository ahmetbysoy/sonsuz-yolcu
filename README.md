# SONSUZ YOLCU — Işık Peşinde ⚡

Asla durmayan, kendi kendine oynayan, sen izledikçe konuşan Telegram Mini App oyunu.

> **İLERLEME = Açık Kalma Süresi × Hız Çarpanı × Boostlar + Etkileşim Bonusları**

## Repo Yapısı
```
/client    ← Telegram Mini App (HTML5 Canvas, Web Speech API)
/server    ← Node.js + Express + SQLite (Faz 2'den itibaren)
/docs      ← Tasarım belgesi + asset envanteri
/assets    ← Görseller ve sesler (bu repoda)
```

## Asset Durumu (detay: docs/ASSETS.md)
- ✅ VOLT karakter seti (5 poz, şeffaf PNG)
- ✅ Faz 1 MVP seti: 1 biome (Fısıltı Çayırı) + yol + 4 engel + kıvılcım
- ✅ UI: Kenney UI Pack (870 sprite, CC0)
- ✅ Ses: 238 CC0 efekt + jingle (Kenney)
- ⏳ 6 biome seti (Faz 3 öncesi tamamlanacak)

## Lisans Özeti
- Kenney asset'leri: **CC0** — atıf gerekmez, ticari serbest
- AI görseller: proje içi serbest
- Shutterstock: **kullanılmıyor** (abonelik gerekir; kullanıcı isterse ekler)
- game-icons.net (Faz 7 planı): CC-BY 3.0 → **atıf zorunlu**

## Geliştirme Durumu
- ✅ **Faz 1 — Oto-Koşucu MVP** (duman testi: 5 dk AFK, 18k kare, 0 hata)
  - Canvas döngüsü (delta-time), 3 şeritli perspektifli yol, oto-pilot (asla ölmez)
  - Kıvılcım + kombo, seviye (500m), Işık Patlaması, rekor, sustur butonu
- ✅ **Faz 2 — Kayıt Sistemi + Uyku Kazancı** (API testleriyle doğrulandı)
  - Node.js sunucu (sıfır bağımlılık): statik client + `/api/load` `/api/save` `/api/heartbeat`
  - Uyku kazancı **sunucu tarafında**: `min(8sa, süre) × hız × %10` (test: 2sa→5.911m, 12sa→tavan 23.616m)
  - "Sen yokken..." rapor ekranı (oyun duraklar, rapor kapanınca devam)
  - İlk temasta yerel geçmiş benimsenir (kural #1: asla sıfırlanmaz)
  - Anti-hile: sn başına 45m kelepçe + bayrak (ban değil), sunucu saati esas
  - 15 sn heartbeat + 5 sn kayıt + pagehide'da sendBeacon
  - Telegram kullanıcı kimliği (initDataUnsafe) → yoksa misafir ID

## Çalıştırma
```bash
cd sonsuz-yolcu
node server/server.js          # client + API tek portta → http://localhost:8000
# farklı port: PORT=8080 node server/server.js
# kilitli Firebase için: FIREBASE_AUTH=<secret> node server/server.js
# Telegram testi: ngrok http 8000 → BotFather MenuButton URL
```
Not: Sunucu yoksa oyun yine çalışır (offline mod, localStorage'a yazar).
Not: Firebase devre dışı kalmışsa sunucu yerel JSON yedeğiyle (`server/data/`) çalışmayı sürdürür.

## Sıradaki Fazlar
- Faz 3: Dopamin motoru — 4 biome + olay zamanlayıcı + koleksiyon (20 parça)
- Faz 4: TTS + replik bankası (100+ Türkçe replik)
- Faz 5: Dokunmatik şov + sesli komutlar

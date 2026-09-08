# 🚀 DEPLOY KILAVUZU — GitHub + Vercel

## Mimari (Vercel'e özel)
```
Telegram / tarayıcı
   │  HTTPS
   ▼
Vercel (sonsuz-yolcu.vercel.app)
   ├── /            → client/ (statik oyun: Canvas + game.js)
   └── /api/*       → serverless fonksiyonlar (api/load.js, save.js, heartbeat.js)
                         │  REST (https modülü)
                         ▼
                     Firebase RTDB → /sonsuzYolcu/users/{uid}
```
- Vercel'de sürekli-çalışan sunucu YOKTUR → `server/server.js` sadece lokal/Termux içindir.
- Serverless fonksiyonlar `api/_store.js`'i paylaşır; oyun mantığı (uyku kazancı, anti-hile
  kelepçesi) sunucu tarafında kalır — anti-hile ilkesi bozulmaz.
- Vercel dosya sistemi salt-okunurdur → yerel yedek sessizce atlanır, Firebase esas depodur.

## Yöntem A — GitHub + Vercel Dashboard (ÖNERİLEN, otomatik deploy)
1. **GitHub:** github.com/new → repo adı `sonsuz-yolcu` (Public/Private seç senin) → oluştur.
2. Push:
   ```bash
   cd sonsuz-yolcu
   git remote add origin https://github.com/<KULLANICI>/sonsuz-yolcu.git
   git push -u origin main     # kullanıcı adı + PAT sorar (şifre DEĞİL, PAT!)
   ```
   PAT almak: GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained** → Only select repositories: `sonsuz-yolcu` → Permissions: Contents=Read&Write →
   kısa süreli (7 gün) üret → push'ta şifre yerine onu kullan → **iş bitince revoke et**.
3. **Vercel:** vercel.com → Add New → Project → GitHub reposundan `sonsuz-yolcu` import:
   - Framework Preset: **Other** (ayarlarını `vercel.json` halleder)
   - Env var (opsiyonel): `FIREBASE_AUTH` = veritabanı secret'ın (varsa)
   - Deploy → `https://sonsuz-yolcu-*.vercel.app` hazır ✅
4. Artık her `git push` otomatik deploy olur.

## Yöntem B — Vercel CLI (token ile, GitHub'sız da olur)
```bash
npm i -g vercel
cd sonsuz-yolcu
vercel --prod --yes --token=<VERCEL_TOKEN>
```
Token: vercel.com → Account Settings → Tokens → Create (kısa süreli seç).

## BotFather'a bağlama (Mini App)
1. @BotFather → `/newbot` → isim ver → token'ı sakla.
2. `/newapp` → botunu seç → başlık/açıklama/görsel gir →
   **Web App URL** = Vercel linkin (`https://....vercel.app`).
3. Telegram'da botunu aç → oyun HTTPS üzerinden yüklenir.
   *(İlk turlarda Telegram, .vercel.app alan adını sorunsuz kabul eder.)*

## Deploy sonrası smoke check (30 sn)
```bash
curl https://sonsuz-yolcu.vercel.app/                      # 200 + index.html
curl "https://sonsuz-yolcu.vercel.app/api/load?userId=smoke"   # {"ok":true,...}
curl -X POST https://sonsuz-yolcu.vercel.app/api/heartbeat \
     -H 'Content-Type: application/json' -d '{"userId":"smoke"}'
# Firebase Konsolu → /sonsuzYolcu/users/smoke görünmeli (sonra sil)
```

## ⚠️ Güvenlik (yayın öncesi yapılacaklar listesi)
- RTDB şu an tamamen açık. En azından şu kuralları ekle (Firebase Konsolu → Rules):
  ```json
  {
    "rules": {
      "sonsuzYolcu": {
        "users": { "$uid": { ".read": true, ".write": true } },
        ".read": false, ".write": false
      },
      ".read": false, ".write": false
    }
  }
  ```
  *(Not: bu MVP sunucu-kelepçeli olduğundan kötü niyetli yazım i级 limitlenir; daha sıkı
  auth için FIREBASE_AUTH secret + legacy token akışına geçilecek — Faz 9.)*
- PAT/token'ları asla repoya koyma (.env zaten .gitignore'da).

## Lokal/Termux çalıştırma (değişmedi)
```bash
node server/server.js        # client + API tek portta (Firebase'li)
```

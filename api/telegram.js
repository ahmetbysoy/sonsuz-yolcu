'use strict';
/* Telegram webhook: /start ve /oyna komutlarına VOLT'unki bir cevap + OYNA butonu döner.
   Token repo'da TUTULMAZ — Vercel env değişkeni (TELEGRAM_BOT_TOKEN).
   Endpoint Telegram dışından çağrılmasın diye secret header doğrulanır. */
module.exports = async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{"ok":true}');   // Telegram hemen 200 görsün (retry spam olmasın)

  try {
    const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
    if (SECRET && req.headers['x-telegram-bot-api-secret-token'] !== SECRET) return;

    if (req.method !== 'POST') return;
    const body = await new Promise((resolve) => {
      let d = '';
      req.on('data', c => { d += c; if (d.length > 5e5) req.destroy(); });
      req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
    });

    const msg = body && body.message;
    if (!msg || !msg.text || !msg.chat) return;
    const chatId = msg.chat.id;
    const text = msg.text.toLowerCase();

    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TOKEN) return;
    const API = `https://api.telegram.org/bot${TOKEN}`;

    const APP_URL = 'https://sonsuz-yolcu.vercel.app';
    const keyboard = { inline_keyboard: [[{ text: 'OYNA ⚡', web_app: { url: APP_URL } }]] };

    let out;
    if (text.startsWith('/start')) {
      out = '⚡ VOLT: "Koruyucum! Sonunda geldin! Işıklar seni özledi... Hazırsan koşuya başlıyorum!"';
    } else if (text.startsWith('/oyna')) {
      out = '🎮 VOLT hazır — butona bas, ben zaten koşuyorum!';
    } else {
      out = '🤖 Komutlar: /start · /oyna — ama oyunun asıl güzelliği içinde seni bekliyor ⚡';
    }

    await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: out, reply_markup: keyboard })
    });
  } catch (e) { /* sessizce yut — Telegram retry spam'i olmasın */ }
};

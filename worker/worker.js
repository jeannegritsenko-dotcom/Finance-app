// Monvelly — Cloudflare Worker: отдаёт приложению эмодзи-статус пользователя.
// Секрет BOT_TOKEN хранится в настройках воркера (Settings → Variables and Secrets), НЕ в коде.
const ALLOWED_ORIGIN = 'https://jeannegritsenko-dotcom.github.io';

const cors = (extra = {}) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  ...extra,
});
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: cors({ 'Content-Type': 'application/json' }) });

const enc = new TextEncoder();
async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, typeof data === 'string' ? enc.encode(data) : data));
}
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

// Проверка подписи Telegram (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
async function validateInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const calc = hex(await hmac(secret, check));
  if (calc !== hash) return null;
  const age = Date.now() / 1000 - Number(params.get('auth_date') || 0);
  if (age > 86400) return null;
  try { return JSON.parse(params.get('user')); } catch { return null; }
}

async function tg(method, token, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.json();
}

async function getSticker(token, emojiId) {
  const r = await tg('getCustomEmojiStickers', token, { custom_emoji_ids: [emojiId] });
  return r.ok && r.result && r.result[0] ? r.result[0] : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    const token = env.BOT_TOKEN;
    if (!token) return json({ error: 'no token' }, 500);

    // 1) приложение присылает initData и получает id эмодзи-статуса
    if (url.pathname === '/emoji-status' && request.method === 'POST') {
      let body; try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      const user = await validateInitData(body.initData || '', token);
      if (!user) return json({ error: 'invalid' }, 401);
      const chat = await tg('getChat', token, { chat_id: user.id });
      const id = chat.ok && chat.result && chat.result.emoji_status_custom_emoji_id;
      if (!id) return json({ id: null });
      const st = await getSticker(token, id);
      if (!st) return json({ id: null });
      const type = st.is_animated ? 'tgs' : st.is_video ? 'webm' : 'webp';
      return json({ id, type });
    }

    // 2) файл эмодзи (публичный стикер; токен наружу не отдаём)
    if (url.pathname === '/emoji-file' && request.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      if (!/^\d{5,30}$/.test(id)) return json({ error: 'bad id' }, 400);
      const st = await getSticker(token, id);
      if (!st) return json({ error: 'not found' }, 404);
      const f = await tg('getFile', token, { file_id: st.file_id });
      if (!f.ok) return json({ error: 'no file' }, 404);
      const file = await fetch(`https://api.telegram.org/file/bot${token}/${f.result.file_path}`);
      return new Response(file.body, {
        headers: cors({
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400',
        }),
      });
    }
    return json({ ok: true, service: 'monvelly-emoji' });
  },
};

// Telegram Bot API helper (UTF-8 safe, token read from .local/secrets.env, never printed)
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync(__dirname + '/../.local/secrets.env', 'utf8').split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body || {}) });
  return r.json();
}
module.exports = { tg, env };

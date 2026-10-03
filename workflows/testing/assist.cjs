// Calls PawCare_AdminAssist exactly like the dashboard does (HMAC over "<ts>.<raw body>").
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { Client } = require('pg');
const { BASE } = require('../../tools/n8n-api.cjs');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../../.local/secrets.env'), 'utf8').split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
async function activeContent(kind) {
  const c = new Client({ host: env.PAWCARE_DB_HOST, port: 5432, user: `${env.PAWCARE_DB_ROLE}.${env.SUPABASE_PROJECT_REF}`, password: env.PAWCARE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } });
  await c.connect(); const r = await c.query("select content from public.bot_config_versions where kind=$1 and status='active'", [kind]); await c.end(); return r.rows[0].content;
}
async function ask(kind, instruction, { badSig = false } = {}) {
  const body = JSON.stringify({ request_id: crypto.randomUUID(), kind, instruction, current_content: await activeContent(kind), current_version: 1 });
  const ts = Date.now().toString();
  const sig = badSig ? '0'.repeat(64) : crypto.createHmac('sha256', env.ASSISTANT_HMAC_SECRET).update(`${ts}.${body}`).digest('hex');
  const res = await fetch(`${BASE}/webhook/pawcare-admin-assist`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PawCare-Timestamp': ts, 'X-PawCare-Signature': sig, 'ngrok-skip-browser-warning': '1' }, body, signal: AbortSignal.timeout(130000) });
  const text = await res.text(); let j; try { j = JSON.parse(text); } catch { j = { raw: text.slice(0, 200) }; }
  return { status: res.status, j };
}
module.exports = { ask };
if (require.main === module) (async () => {
  const [kind, instr, bad] = process.argv.slice(2);
  const r = await ask(kind, instr, { badSig: bad === 'bad' });
  console.log('status', r.status);
  if (r.j.proposed_content) { console.log('summary:', r.j.summary); console.log('out_of_scope:', JSON.stringify(r.j.out_of_scope)); console.log('chars:', r.j.proposed_content.length); console.log('--- proposed (first 700) ---\n' + r.j.proposed_content.slice(0, 700)); }
  else console.log(JSON.stringify(r.j));
})().catch(e => { console.error('ERR', e.message.slice(0, 300)); process.exit(1); });

// Moves the PawCare workflows from the old n8n (laptop + ngrok) to the new n8n (VPS) in safe, separately runnable steps.
// Inputs live in .local/secrets.env (never printed):  N8N_NEW_BASE_URL=https://...   N8N_NEW_API_KEY=...   OPENAI_API_KEY=...
//
//   node tools/migrate-n8n.cjs preflight   check the new server: reachable, API key valid, public https webhooks really work
//   node tools/migrate-n8n.cjs creds       create the Postgres / Telegram / OpenAI credentials on the new n8n -> .local/secrets-new.env
//   node tools/migrate-n8n.cjs stage       deploy all workflows to the new n8n with Ingress + Health held INACTIVE (nothing touches production yet)
//   node tools/migrate-n8n.cjs cutover     deactivate the PawCare workflows on the old n8n, activate Ingress + Health on the new one, verify Telegram points to it
//   node tools/migrate-n8n.cjs rollback    the reverse (old n8n takes the bot back)
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SECRETS = path.join(ROOT, '.local/secrets.env');
const NEW_ENV = path.join(ROOT, '.local/secrets-new.env');
const NEW_CFG = path.join(ROOT, '.local/n8n-new.txt');
const parse = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const secrets = parse(SECRETS);
const need = (k) => { if (!secrets[k]) { console.error(`missing ${k} in .local/secrets.env`); process.exit(1); } return secrets[k]; };

const NEW_BASE = () => need('N8N_NEW_BASE_URL').replace(/\/+$/, '');
const NEW_KEY = () => need('N8N_NEW_API_KEY');

async function call(base, key, method, p, body) {
  const res = await fetch(base + p, { method, headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 300) }; }
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
const nw = (method, p, body) => call(NEW_BASE(), NEW_KEY(), method, p, body);
// the old n8n: same reader the rest of the tools use (default config file, ngrok URL + key)
function oldCfg() {
  const cfg = fs.readFileSync('C:/Users/user/المسار النهائي لتحليل البيانات/.local/n8n.txt', 'utf8');
  const pick = (k) => (cfg.split(k + '=')[1] || '').split(/\r?\n/)[0].trim();
  return { base: pick('BASE_URL'), key: pick('API_KEY') };
}
const old = (method, p, body) => { const c = oldCfg(); return call(c.base, c.key, method, p, body); };
const writeNewCfg = () => fs.writeFileSync(NEW_CFG, `BASE_URL=${NEW_BASE()}\nAPI_KEY=${NEW_KEY()}\n`);
const run = (file, args, env = {}) => { const r = spawnSync('node', [path.join(ROOT, file), ...args], { stdio: 'inherit', env: { ...process.env, ...env } }); if (r.status !== 0) process.exit(r.status || 1); };

const steps = {
  async preflight() {
    const base = NEW_BASE();
    console.log('1) public https reachability:', base);
    const h = await fetch(base + '/healthz', { signal: AbortSignal.timeout(20000) }).then((r) => `${r.status} ${r.ok ? 'OK' : 'NOT OK'}`).catch((e) => 'FAILED ' + e.message);
    console.log('   /healthz ->', h);
    console.log('2) API key:');
    const w = await nw('GET', '/api/v1/workflows?limit=1').then(() => 'valid').catch((e) => 'REJECTED ' + e.message.slice(0, 120));
    console.log('   ', w);
    if (w !== 'valid') process.exit(1);
    console.log('3) production webhooks reachable from the internet (temporary workflow):');
    const hook = 'pawcare-preflight-' + Date.now();
    const wf = { name: 'PawCare_TEST_preflight', settings: { executionOrder: 'v1' }, nodes: [
      { id: 'a1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: hook, parameters: { httpMethod: 'POST', path: hook, responseMode: 'lastNode', options: {} } },
      { id: 'a2', name: 'Out', type: 'n8n-nodes-base.code', typeVersion: 2, position: [240, 0], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "return [{ json: { ok: true, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }];" } },
    ], connections: { Webhook: { main: [[{ node: 'Out', type: 'main', index: 0 }]] } } };
    const c = await nw('POST', '/api/v1/workflows', wf);
    try {
      await nw('POST', `/api/v1/workflows/${c.id}/activate`);
      const r = await fetch(`${base}/webhook/${hook}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000) });
      console.log('   webhook ->', r.status, (await r.text()).slice(0, 160));
    } finally { await nw('POST', `/api/v1/workflows/${c.id}/deactivate`).catch(() => {}); await nw('DELETE', `/api/v1/workflows/${c.id}`).catch(() => {}); }
    console.log('preflight done. If the webhook line shows 200, the server is ready to receive the bot.');
  },

  async creds() {
    if (fs.existsSync(NEW_ENV) && !process.argv.includes('--force')) { console.error('.local/secrets-new.env already exists (use --force to create the credentials again).'); process.exit(1); }
    const mk = async (name, type, data) => { const r = await nw('POST', '/api/v1/credentials', { name, type, data }); console.log('created credential', name, '->', r.id); return r.id; };
    const pg = await mk('PawCare Supabase', 'postgres', {
      host: need('PAWCARE_DB_HOST'), port: 5432, database: 'postgres', user: `${need('PAWCARE_DB_ROLE')}.${need('SUPABASE_PROJECT_REF')}`, password: need('PAWCARE_DB_PASSWORD'),
      ssl: 'require', allowUnauthorizedCerts: true, maxConnections: 10, sshTunnel: false,
    });
    const tg = await mk('PawCare Telegram', 'telegramApi', { accessToken: need('TELEGRAM_BOT_TOKEN') });
    const oa = await mk('PawCare OpenAI', 'openAiApi', { apiKey: need('OPENAI_API_KEY'), url: 'https://api.openai.com/v1', header: false });
    const lines = fs.readFileSync(SECRETS, 'utf8').split(/\r?\n/).filter((l) => !/^N8N_CRED_(POSTGRES|TELEGRAM|OPENAI)_ID=/.test(l) && l.trim() !== '');
    lines.push(`N8N_CRED_POSTGRES_ID=${pg}`, `N8N_CRED_TELEGRAM_ID=${tg}`, `N8N_CRED_OPENAI_ID=${oa}`);
    fs.writeFileSync(NEW_ENV, lines.join('\n') + '\n');
    console.log('wrote .local/secrets-new.env (new credential ids; nothing printed from secrets)');
  },

  async stage() {
    if (!fs.existsSync(NEW_ENV)) { console.error('run `creds` first'); process.exit(1); }
    writeNewCfg();
    run('workflows/deploy.cjs', [], { N8N_CONFIG: NEW_CFG, PAWCARE_SECRETS: NEW_ENV, PAWCARE_HOLD: 'ingress,health' });
    console.log('staged. Ingress (Telegram trigger) and Health (scheduler) are INACTIVE on the new server; the old server still serves the bot.');
    console.log('Test the new server: N8N_CONFIG=.local/n8n-new.txt node workflows/testing/<script>.cjs');
  },

  async cutover() {
    writeNewCfg();
    const ids = JSON.parse(fs.readFileSync(path.join(ROOT, '.local/workflow-ids.new.json'), 'utf8'));
    // 1) old server stops owning the bot (only one Telegram webhook can exist)
    const list = (await old('GET', '/api/v1/workflows?limit=250')).data.filter((w) => /^PawCare_/.test(w.name) && !/^PawCare_TEST_/.test(w.name));
    for (const w of list) if (w.active) { await old('POST', `/api/v1/workflows/${w.id}/deactivate`); console.log('old: deactivated', w.name); }
    // 2) new server takes over
    for (const k of ['health', 'ingress']) { await nw('POST', `/api/v1/workflows/${ids[k]}/activate`); console.log('new: activated', k); }
    await new Promise((r) => setTimeout(r, 4000));
    const info = await fetch(`https://api.telegram.org/bot${need('TELEGRAM_BOT_TOKEN')}/getWebhookInfo`).then((r) => r.json());
    const url = (info.result && info.result.url) || '';
    const host = new URL(NEW_BASE()).host;
    console.log('Telegram webhook now ->', url.replace(/(https:\/\/[^/]+)\/.*/, '$1/…'), url.includes(host) ? '(NEW server OK)' : '(!! still not the new server)', '| last error:', (info.result && info.result.last_error_message) || 'none');
    console.log('Next: update the dashboard assistant URL ->  node .local/cf-set-assistant-url.cjs');
  },

  async rollback() {
    const ids = JSON.parse(fs.readFileSync(path.join(ROOT, '.local/workflow-ids.new.json'), 'utf8'));
    for (const k of ['ingress', 'health']) await nw('POST', `/api/v1/workflows/${ids[k]}/deactivate`).catch((e) => console.log('new:', k, e.message.slice(0, 80)));
    const list = (await old('GET', '/api/v1/workflows?limit=250')).data.filter((w) => /^PawCare_/.test(w.name) && !/^PawCare_TEST_/.test(w.name));
    for (const w of list) if (!w.active) { await old('POST', `/api/v1/workflows/${w.id}/activate`); console.log('old: activated', w.name); }
    console.log('rolled back: the old n8n owns the bot again (make sure it and ngrok are running).');
  },
};

const step = process.argv[2];
if (!steps[step]) { console.log('usage: node tools/migrate-n8n.cjs preflight|creds|stage|cutover|rollback'); process.exit(1); }
steps[step]().catch((e) => { console.error('ERR', e.message.slice(0, 500)); process.exit(1); });

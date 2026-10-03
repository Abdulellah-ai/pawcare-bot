// Thin n8n REST helper. Reads BASE_URL/API_KEY at runtime (ngrok URL rotates) - never hardcode.
const fs = require('fs');
const CFG = 'C:/Users/user/المسار النهائي لتحليل البيانات/.local/n8n.txt';
const cfg = fs.readFileSync(CFG, 'utf8');
const pick = (k) => (cfg.split(k + '=')[1] || '').split(/\r?\n/)[0].trim();
const BASE = pick('BASE_URL');
const KEY = pick('API_KEY');

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  if (!res.ok) { const e = new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 600)}`); e.status = res.status; throw e; }
  return json;
}

// Settings keys n8n PUT/POST accepts (anything else is rejected)
const ALLOWED_SETTINGS = ['executionOrder', 'errorWorkflow', 'callerPolicy', 'timezone', 'saveExecutionProgress',
  'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout'];
const cleanSettings = (s) => Object.fromEntries(Object.entries(s || {}).filter(([k]) => ALLOWED_SETTINGS.includes(k)));

module.exports = { api, BASE, cleanSettings };

if (require.main === module) {
  const [m, p, b] = process.argv.slice(2);
  api(m, p, b ? JSON.parse(b) : undefined).then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error(e.message); process.exit(1); });
}

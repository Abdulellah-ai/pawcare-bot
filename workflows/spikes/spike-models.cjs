// Lists the OpenAI chat/audio models this account can use (ids only).
const fs = require('fs'); const path = require('path');
const { api, BASE, cleanSettings } = require('../../tools/n8n-api.cjs');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../../.local/secrets.env'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
(async () => {
  const hook = 'pawcare-test-models-' + Date.now();
  const wf = { name: 'PawCare_TEST_models', settings: cleanSettings({ executionOrder: 'v1' }), nodes: [
    { id: 'a1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: hook, parameters: { httpMethod: 'POST', path: hook, responseMode: 'lastNode', options: {} } },
    { id: 'a2', name: 'Req', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [260, 0], credentials: { openAiApi: { id: env.N8N_CRED_OPENAI_ID, name: 'OpenAi account' } },
      parameters: { method: 'GET', url: 'https://api.openai.com/v1/models', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', options: { timeout: 30000 } } },
    { id: 'a3', name: 'Sum', type: 'n8n-nodes-base.code', typeVersion: 2, position: [520, 0], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const d=$input.first().json.data||[];return [{json:{ids:d.map(m=>m.id).filter(i=>/^(gpt|o\d|chatgpt)/.test(i)&&!/(image|tts|transcribe|realtime|embedding|moderation|search|codex|instruct|audio)/.test(i)).sort()}}];" } },
  ], connections: { Webhook: { main: [[{ node: 'Req', type: 'main', index: 0 }]] }, Req: { main: [[{ node: 'Sum', type: 'main', index: 0 }]] } } };
  const c = await api('POST', '/api/v1/workflows', wf);
  try { await api('POST', `/api/v1/workflows/${c.id}/activate`);
    const res = await fetch(`${BASE}/webhook/${hook}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: '{}' });
    console.log(res.status, (await res.text()).slice(0, 1500));
  } finally { await api('POST', `/api/v1/workflows/${c.id}/deactivate`).catch(() => {}); await api('DELETE', `/api/v1/workflows/${c.id}`).catch(() => {}); }
})().catch((e) => console.log('ERR', e.message.slice(0, 400)));

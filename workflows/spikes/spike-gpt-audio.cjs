// Spike: does the account have gpt-audio-1.5 via /v1/chat/completions (audio out, opus)? Prints status/error and audio size only.
const fs = require('fs'); const path = require('path');
const { api, BASE, cleanSettings } = require('../../tools/n8n-api.cjs');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../../.local/secrets.env'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
(async () => {
  const hook = 'pawcare-test-audio-' + Date.now();
  const body = { model: process.argv[2] || 'gpt-audio-1.5', modalities: ['text', 'audio'], audio: { voice: process.argv[3] || 'marin', format: 'opus' },
    messages: [{ role: 'system', content: 'You are a text-to-speech engine. Read the user text aloud exactly, word for word, in a warm calm Arabic voice. Add nothing.' }, { role: 'user', content: 'أهلًا بكم في باو كير. سعر الفحص سبعة دنانير ونصف.' }] };
  const wf = { name: 'PawCare_TEST_audio', settings: cleanSettings({ executionOrder: 'v1' }),
    nodes: [
      { id: 'a1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: hook, parameters: { httpMethod: 'POST', path: hook, responseMode: 'lastNode', options: {} } },
      { id: 'a2', name: 'Req', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [260, 0], onError: 'continueRegularOutput', credentials: { openAiApi: { id: env.N8N_CRED_OPENAI_ID, name: 'OpenAi account' } },
        parameters: { method: 'POST', url: 'https://api.openai.com/v1/chat/completions', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}', options: { timeout: 60000, response: { response: { fullResponse: true, neverError: true } } } } },
      { id: 'a3', name: 'Sum', type: 'n8n-nodes-base.code', typeVersion: 2, position: [520, 0], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const r=$input.first().json; const b=r.body||{}; const a=b.choices&&b.choices[0]&&b.choices[0].message&&b.choices[0].message.audio; return [{json:{status:r.statusCode,error:b.error||null,audioB64Len:a&&a.data?a.data.length:0,transcript:a&&a.transcript||null,usage:b.usage||null}}];" } },
    ], connections: { Webhook: { main: [[{ node: 'Req', type: 'main', index: 0 }]] }, Req: { main: [[{ node: 'Sum', type: 'main', index: 0 }]] } } };
  const c = await api('POST', '/api/v1/workflows', wf);
  try {
    await api('POST', `/api/v1/workflows/${c.id}/activate`);
    const res = await fetch(`${BASE}/webhook/${hook}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify(body) });
    console.log(res.status, (await res.text()).slice(0, 900));
  } finally { await api('POST', `/api/v1/workflows/${c.id}/deactivate`).catch(() => {}); await api('DELETE', `/api/v1/workflows/${c.id}`).catch(() => {}); }
})().catch((e) => { console.error('ERR', e.message.slice(0, 600)); process.exit(1); });

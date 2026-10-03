// Throwaway spike: can an n8n Code node read the Telegram credential (so the token never lives in workflow JSON)?
// Prints only booleans/lengths, never the token.
const fs = require('fs');
const { api, BASE, cleanSettings } = require('../../tools/n8n-api.cjs');
const code = `
const out = { getCredentials: 'n/a', httpHelper: typeof (this && this.helpers && this.helpers.httpRequest), authHelper: typeof (this && this.helpers && this.helpers.httpRequestWithAuthentication), env: 'n/a' };
try { const c = await this.getCredentials('telegramApi'); out.getCredentials = { ok: true, keys: Object.keys(c), tokenLen: String(c.accessToken || '').length }; } catch (e) { out.getCredentials = { ok: false, err: String(e.message).slice(0, 160) }; }
try { out.env = typeof $env === 'undefined' ? 'undefined' : (typeof $env.PATH); } catch (e) { out.env = 'blocked: ' + String(e.message).slice(0, 80); }
return [{ json: out }];`;
const wf = {
  name: 'PawCare_TEST_spike_code_credentials',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'pawcare-spike-cred', responseMode: 'lastNode', options: {} }, id: 'w1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: 'pawcare-spike-cred-1' },
    { parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: code }, id: 'c1', name: 'Code', type: 'n8n-nodes-base.code', typeVersion: 2, position: [260, 0] },
  ],
  connections: { Webhook: { main: [[{ node: 'Code', type: 'main', index: 0 }]] } },
  settings: cleanSettings({ executionOrder: 'v1' }),
};
(async () => {
  const created = await api('POST', '/api/v1/workflows', wf);
  await api('POST', `/api/v1/workflows/${created.id}/activate`);
  const res = await fetch(BASE + '/webhook/pawcare-spike-cred', { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: '{}', signal: AbortSignal.timeout(40000) });
  console.log('status', res.status, (await res.text()).slice(0, 800));
  fs.writeFileSync(__dirname + '/../../.local/spike_wf_id2.txt', created.id);
})().catch((e) => { console.error('ERR', e.message.slice(0, 600)); process.exit(1); });

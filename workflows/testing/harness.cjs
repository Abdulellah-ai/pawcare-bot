// Test harness: exposes a PawCare sub-workflow behind a temporary webhook so it can be called with synthetic input, then removes it.
// Usage: node workflows/testing/harness.cjs <key> '<json body>'
const fs = require('fs');
const path = require('path');
const { api, BASE, cleanSettings } = require('../../tools/n8n-api.cjs');

async function callWorkflow(key, body, { timeoutMs = 90000 } = {}) {
  const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '../../.local/workflow-ids.json'), 'utf8'));
  if (!ids[key]) throw new Error('unknown workflow key ' + key);
  const hook = `pawcare-test-${key}-${Date.now()}`;
  const wf = {
    name: `PawCare_TEST_harness_${key}`,
    nodes: [
      { id: 'h1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: hook, parameters: { httpMethod: 'POST', path: hook, responseMode: 'lastNode', options: {} } },
      { id: 'h2', name: 'Unwrap', type: 'n8n-nodes-base.code', typeVersion: 2, position: [260, 0], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: 'return [{ json: $json.body }];' } },
      { id: 'h3', name: 'Call', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [520, 0], alwaysOutputData: true, parameters: { source: 'database', workflowId: { __rl: true, value: ids[key], mode: 'id' }, options: { waitForSubWorkflow: true } } },
    ],
    connections: { Webhook: { main: [[{ node: 'Unwrap', type: 'main', index: 0 }]] }, Unwrap: { main: [[{ node: 'Call', type: 'main', index: 0 }]] } },
    settings: cleanSettings({ executionOrder: 'v1' }),
  };
  const created = await api('POST', '/api/v1/workflows', wf);
  try {
    await api('POST', `/api/v1/workflows/${created.id}/activate`);
    const res = await fetch(`${BASE}/webhook/${hook}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 500); }
    return { status: res.status, body: json };
  } finally {
    await api('POST', `/api/v1/workflows/${created.id}/deactivate`).catch(() => {});
    await api('DELETE', `/api/v1/workflows/${created.id}`).catch(() => {});
  }
}

module.exports = { callWorkflow };

if (require.main === module) {
  const [key, body] = process.argv.slice(2);
  callWorkflow(key, JSON.parse(body || '{}')).then((r) => console.log(JSON.stringify(r, null, 1))).catch((e) => { console.error('ERR', e.message.slice(0, 600)); process.exit(1); });
}

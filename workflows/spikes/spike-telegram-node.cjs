// Throwaway spike: does the native n8n Telegram node send into a forum topic (message_thread_id)?
const fs = require('fs');
const { api, BASE, cleanSettings } = require('../../tools/n8n-api.cjs');
const thread = fs.readFileSync(__dirname + '/../../.local/spike_thread.txt', 'utf8').trim();
const TG = { id: 'YOUR_N8N_CREDENTIAL_ID', name: 'PawCare Telegram Bot' };
const wf = {
  name: 'PawCare_TEST_spike_telegram_node',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'pawcare-spike-tg', responseMode: 'lastNode', options: {} }, id: 'w1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: 'pawcare-spike-tg-1' },
    { parameters: { resource: 'message', operation: 'sendMessage', chatId: '-100XXXXXXXXXX', text: '=✅ اختبار عقدة n8n الأصلية داخل التوبك',
        additionalFields: { message_thread_id: '={{ $json.body.thread }}', appendAttribution: false } },
      id: 't1', name: 'Telegram', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [260, 0], credentials: { telegramApi: TG } },
  ],
  connections: { Webhook: { main: [[{ node: 'Telegram', type: 'main', index: 0 }]] } },
  settings: cleanSettings({ executionOrder: 'v1' }),
};
(async () => {
  const created = await api('POST', '/api/v1/workflows', wf);
  console.log('created', created.id);
  await api('POST', `/api/v1/workflows/${created.id}/activate`);
  console.log('activated');
  const res = await fetch(BASE + '/webhook/pawcare-spike-tg', { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify({ thread: Number(thread) }), signal: AbortSignal.timeout(40000) });
  const text = await res.text();
  console.log('webhook status', res.status);
  try { const j = JSON.parse(text); const r = j.result || j; console.log(JSON.stringify({ ok: j.ok, message_thread_id: r.message_thread_id, is_topic_message: r.is_topic_message, chat: r.chat && r.chat.id, text: r.text })); } catch { console.log(text.slice(0, 600)); }
  fs.writeFileSync(__dirname + '/../../.local/spike_wf_id.txt', created.id);
})().catch((e) => { console.error('ERR', e.message.slice(0, 700)); process.exit(1); });

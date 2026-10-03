// Measures real token usage (incl. hidden reasoning tokens) and cost of a customer-reply request on several models, using the real
// system prompt (CORE + style + knowledge). Calls go through a throwaway n8n workflow because the OpenAI key lives in n8n credentials.
// Usage: NODE_PATH=.local/node_modules node workflows/spikes/spike-usage.cjs
const fs = require('fs'); const path = require('path');
const { api, BASE, cleanSettings } = require('../../tools/n8n-api.cjs');
const { CORE_PROMPT, REPLY_SCHEMA, stripConstraints } = require('../shared/prompts.js');
const { Client } = require('pg');
const ROOT = path.join(__dirname, '../..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.local/secrets.env'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));

// USD per 1M tokens {in, out} from the official pricing page (Standard, short context)
const PRICE = { 'gpt-4.1-mini': { in: 0.40, out: 1.60 }, 'gpt-6-luna': { in: 0.10, out: 0.50 }, 'gpt-6.1-sol': { in: 2.0, out: 10.0 } };
const QUESTIONS = ['قديش بتكلف تطعيم القطط الصغيرة؟', 'بدي أحجز موعد لكلبي بكرا', 'كلبي بطنه منفوخ وبحاول يرجع وما بطلع شي', 'شو ساعات دوامكم يوم الجمعة؟'];

(async () => {
  const c = new Client({ host: env.PAWCARE_DB_HOST, port: 5432, user: `${env.PAWCARE_DB_ROLE}.${env.SUPABASE_PROJECT_REF}`, password: env.PAWCARE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } });
  await c.connect();
  const get = async (k) => (await c.query("select content from public.bot_config_versions where kind=$1 and status='active'", [k])).rows[0].content;
  const style = await get('style'), knowledge = await get('knowledge'); await c.end();
  const system = CORE_PROMPT + '\n\n# الأسلوب (من إدارة العيادة)\n' + style + '\n\n# المعرفة (من إدارة العيادة)\n' + knowledge + '\n\n# بيانات الجلسة\nاسم العميل في تلجرام: سارة\nاللغة المرجحة: ar\nنوع الرسالة: نصية';

  const hook = 'pawcare-test-usage-' + Date.now();
  const wf = { name: 'PawCare_TEST_usage', settings: cleanSettings({ executionOrder: 'v1' }), nodes: [
    { id: 'a1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: hook, parameters: { httpMethod: 'POST', path: hook, responseMode: 'lastNode', options: {} } },
    { id: 'a2', name: 'Req', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [260, 0], credentials: { openAiApi: { id: env.N8N_CRED_OPENAI_ID, name: 'OpenAi account' } }, onError: 'continueRegularOutput',
      parameters: { method: 'POST', url: 'https://api.openai.com/v1/chat/completions', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body.body) }}', options: { timeout: 90000 } } },
    { id: 'a3', name: 'Sum', type: 'n8n-nodes-base.code', typeVersion: 2, position: [520, 0], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const r=$input.first().json;return [{json:{usage:r.usage||null,content:(r.choices&&r.choices[0]&&r.choices[0].message&&r.choices[0].message.content)||null,finish:(r.choices&&r.choices[0]&&r.choices[0].finish_reason)||null,error:r.error||null}}];" } },
  ], connections: { Webhook: { main: [[{ node: 'Req', type: 'main', index: 0 }]] }, Req: { main: [[{ node: 'Sum', type: 'main', index: 0 }]] } } };
  const w = await api('POST', '/api/v1/workflows', wf);
  try {
    await api('POST', `/api/v1/workflows/${w.id}/activate`);
    for (const v of (process.env.VARIANTS || 'gpt-6-luna').split(',')) {
      const [model, effort] = v.split(':');
      const limit = /^gpt-4/.test(model) ? { temperature: 0.3, max_tokens: 800 } : { max_completion_tokens: 2000, ...(effort ? { reasoning_effort: effort } : {}) };
      let tin = 0, tout = 0, treason = 0, empty = 0, secs = 0;
      for (const q of QUESTIONS) {
        const body = { model, ...limit, messages: [{ role: 'system', content: system }, { role: 'user', content: '<customer_message>' + q + '</customer_message>' }],
          response_format: { type: 'json_schema', json_schema: { name: 'pawcare_reply', strict: true, schema: stripConstraints(REPLY_SCHEMA) } } };
        const t0 = Date.now();
        const res = await fetch(`${BASE}/webhook/${hook}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify({ body }) });
        const j = await res.json(); secs += (Date.now() - t0) / 1000;
        if (!j.usage) { console.log(model, 'ERROR', JSON.stringify(j.error || j).slice(0, 200)); continue; }
        const rt = (j.usage.completion_tokens_details && j.usage.completion_tokens_details.reasoning_tokens) || 0;
        tin += j.usage.prompt_tokens; tout += j.usage.completion_tokens; treason += rt;
        if (!j.content || j.finish === 'length') empty++;
        console.log(`  ${model} | in ${j.usage.prompt_tokens} out ${j.usage.completion_tokens} (reasoning ${rt}) finish=${j.finish} | ${String(j.content || '').slice(0, 110).replace(/\s+/g, ' ')}`);
      }
      const n = QUESTIONS.length, p = PRICE[model];
      const cost = (tin * p.in + tout * p.out) / 1e6 / n;
      console.log(`== ${v}: avg in ${Math.round(tin / n)}, avg out ${Math.round(tout / n)} (reasoning ${Math.round(treason / n)}), empty/cut ${empty}/${n}, avg ${(secs / n).toFixed(1)}s, cost/reply = $${cost.toFixed(5)}\n`);
    }
  } finally { await api('POST', `/api/v1/workflows/${w.id}/deactivate`).catch(() => {}); await api('DELETE', `/api/v1/workflows/${w.id}`).catch(() => {}); }
})().catch((e) => { console.log('ERR', e.message.slice(0, 400)); process.exit(1); });

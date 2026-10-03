// Workflows that touch secrets. They run with execution-data saving OFF so a token can never land in n8n's execution history.
const { WF, N, inline } = require('../lib/dsl.cjs');

const NO_SAVE = { saveDataSuccessExecution: 'none', saveDataErrorExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false };

/** PawCare_TgRaw — the ONLY place the bot token is read. Input: {method, payload} or {method:'sendVoice', multipart:true, chat_id} + binary 'data'.
 *  Output: {ok, status, result, description}. Never returns or throws the token. */
function tgRaw() {
  const wf = new WF('PawCare_TgRaw', NO_SAVE);
  N.trigger(wf);
  N.pg(wf, 'Load token', "select value as t from public.bot_secrets where name = 'telegram_bot_token'");
  N.code(wf, 'Prepare', `
const inp = $('Trigger').first();
const t = $input.first().json.t;
if (!t) throw new Error('bot token missing');
const j = inp.json || {};
const method = String(j.method || '');
if (!/^[A-Za-z]{3,40}$/.test(method)) throw new Error('invalid telegram method');
return [{ json: { url: 'https://api.telegram.org/bot' + t + '/' + method, method, multipart: !!j.multipart, body: j.payload || {}, chat_id: j.chat_id ?? null, thread_id: j.thread_id ?? null }, binary: inp.binary || undefined }];`);
  N.iff(wf, 'Multipart?', '={{ $json.multipart }}');
  wf.add('Call JSON', 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'POST', url: '={{ $json.url }}', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}',
    options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true } } },
  }, { onError: 'continueRegularOutput' });
  wf.add('Call Multipart', 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'POST', url: '={{ $json.url }}', sendBody: true, contentType: 'multipart-form-data',
    bodyParameters: { parameters: [
      { name: 'chat_id', value: '={{ $json.chat_id }}' },
      { parameterType: 'formBinaryData', name: 'voice', inputDataFieldName: 'data' },
    ] },
    options: { timeout: 60000, response: { response: { fullResponse: true, neverError: true } } },
  }, { onError: 'continueRegularOutput' });
  N.code(wf, 'Sanitize', `
const t = String($('Load token').first().json.t || '');
const redact = (s) => (t ? String(s == null ? '' : s).split(t).join('***') : String(s == null ? '' : s));
const out = [];
for (const it of $input.all()) {
  const r = it.json || {};
  if (r.error && r.statusCode === undefined) { out.push({ json: { ok: false, status: 0, result: null, description: redact(r.error.message || r.error).slice(0, 300) } }); continue; }
  const body = r.body && typeof r.body === 'object' ? r.body : {};
  out.push({ json: { ok: Number(r.statusCode) < 300 && body.ok === true, status: Number(r.statusCode) || 0, result: body.result ?? null, description: redact(body.description || '').slice(0, 300) } });
}
return out;`);
  wf.chain('Trigger', 'Load token', 'Prepare', 'Multipart?');
  wf.link('Multipart?', 'Call Multipart', 0);
  wf.link('Multipart?', 'Call JSON', 1);
  wf.link('Call Multipart', 'Sanitize');
  wf.link('Call JSON', 'Sanitize');
  return wf;
}

/** PawCare_VerifyHmac — Input {ts, signature, raw}. Output {valid, reason}. Secret never leaves this workflow. */
function verifyHmac() {
  const wf = new WF('PawCare_VerifyHmac', NO_SAVE);
  N.trigger(wf);
  N.pg(wf, 'Load secret', "select value as s from public.bot_secrets where name = 'assistant_hmac_secret'");
  N.code(wf, 'Verify', `${inline('hmac.js')}
const inp = $('Trigger').first().json;
const secret = String($input.first().json.s || '');
const ts = Number(inp.ts), sig = String(inp.signature || ''), raw = String(inp.raw || '');
if (!secret) return [{ json: { valid: false, reason: 'server_misconfigured' } }];
if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return [{ json: { valid: false, reason: 'stale_or_bad_timestamp' } }];
const expected = hmacSha256Hex(secret, ts + '.' + raw);
return [{ json: { valid: safeEqual(expected, sig), reason: 'checked' } }];`);
  wf.chain('Trigger', 'Load secret', 'Verify');
  return wf;
}

module.exports = { tgRaw, verifyHmac, NO_SAVE };

const { WF, N } = require('../lib/dsl.cjs');

const STAFF_GROUP = '-100XXXXXXXXXX';
// Dedicated topics in the staff group so notifications never land in General (kept for staff discussion + the pinned guide).
const TOPIC_BOOKINGS = 511;
const TOPIC_EMERGENCY = 513;
const TOPIC_SYSTEM = 515;

/** PawCare_ErrorHandler — every top-level PawCare workflow points its errorWorkflow here.
 *  Records to error_log (central view) and alerts the staff group, at most once per source per 5 minutes. */
function errorHandler() {
  const wf = new WF('PawCare_ErrorHandler');
  wf.add('Error Trigger', 'n8n-nodes-base.errorTrigger', 1, {});
  N.code(wf, 'Build', `
const e = $input.first().json;
const msg = String((e.execution && e.execution.error && e.execution.error.message) || 'unknown error').slice(0, 500);
const node = (e.execution && e.execution.lastNodeExecuted) || '-';
const wfName = (e.workflow && e.workflow.name) || '-';
return [{ json: { source: wfName + ' / ' + node, message: msg, execution_id: (e.execution && e.execution.id) || null, workflow: wfName, node } }];`);
  N.pg(wf, 'Log error', `
with ins as (
  insert into public.error_log(source, severity, message, payload)
  values ($1, 'error', $2, jsonb_build_object('execution_id', $3::text))
  returning id
)
select (select id from ins) as id,
       (select count(*) from public.error_log where source = $1 and created_at > now() - interval '5 minutes')::int as recent`,
  '={{ [$json.source, $json.message, String($json.execution_id)] }}');
  N.iff(wf, 'First in 5 min?', '={{ $json.recent === 0 }}');
  N.tgSend(wf, 'Alert staff', STAFF_GROUP,
    "={{ '⚠️ <b>خطأ في البوت</b>\\n' + $('Build').first().json.workflow + ' ← ' + $('Build').first().json.node + '\\n' + $('Build').first().json.message.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }}", TOPIC_SYSTEM);
  wf.chain('Error Trigger', 'Build', 'Log error', 'First in 5 min?');
  wf.link('First in 5 min?', 'Alert staff', 0);
  return wf;
}

/** PawCare_Alert — input {source, severity, message}. Logs to error_log and alerts the staff group, once per source per 5 minutes. */
function alertWf() {
  const wf = new WF('PawCare_Alert');
  N.trigger(wf);
  N.pg(wf, 'Log', `
with ins as (
  insert into public.error_log(source, severity, message, payload)
  values ($1::text, $2::text, left($3::text, 900), '{}'::jsonb) returning id
)
select (select count(*) from public.error_log where source = $1::text and created_at > now() - interval '5 minutes')::int as recent`,
  "={{ [String($json.source).slice(0, 80), ['info','warning','error','critical'].includes($json.severity) ? $json.severity : 'error', String($json.message)] }}");
  N.iff(wf, 'First?', '={{ $json.recent === 0 }}');
  N.tgSend(wf, 'Alert staff', STAFF_GROUP,
    "={{ '⚠️ <b>تنبيه</b> — ' + String($('Trigger').first().json.source).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '\\n' + String($('Trigger').first().json.message).slice(0, 400).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }}", TOPIC_SYSTEM);
  N.code(wf, 'Done', `return [{ json: { alerted: $('Log').first().json.recent === 0 } }];`);
  wf.chain('Trigger', 'Log', 'First?');
  wf.link('First?', 'Alert staff', 0);
  wf.link('First?', 'Done', 1);
  wf.link('Alert staff', 'Done');
  return wf;
}

module.exports = { errorHandler, alertWf, STAFF_GROUP, TOPIC_BOOKINGS, TOPIC_EMERGENCY, TOPIC_SYSTEM };

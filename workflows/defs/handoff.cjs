const { WF, N, inline } = require('../lib/dsl.cjs');
const { STAFF_GROUP, TOPIC_EMERGENCY } = require('./errors.cjs');

const HTML_ESC = `const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));`;
const REASON_AR = `const REASON_AR = { emergency: 'طارئ', complaint: 'شكوى', medical: 'سؤال طبي', customer_request: 'طلب العميل', low_confidence: 'البوت غير واثق', other: 'أخرى' };`;

/** PawCare_OpenHandoff — input: customer-turn context (+ decision). Creates/reopens the customer's staff topic, records the handoff, posts a summary. */
function openHandoff() {
  const wf = new WF('PawCare_OpenHandoff');
  N.trigger(wf);
  N.pg(wf, 'Recent', `select coalesce(json_agg(x order by x.t), '[]'::json) as recent from (select created_at as t, sender, left(body, 200) as body from public.messages where conversation_id = $1::uuid order by created_at desc limit 4) x`,
    '={{ [$json.conversation_id] }}', { alwaysOutputData: true });
  N.code(wf, 'Plan', `${inline('topicname.js')}
${HTML_ESC}
${REASON_AR}
const c = $('Trigger').first().json;
const r = $('Recent').first().json;
const WHO = { customer: 'العميل', bot: 'البوت', staff: 'الموظف', system: 'النظام' };
const recentLines = (Array.isArray(r.recent) ? r.recent : []).map((x) => '• ' + (WHO[x.sender] || x.sender) + ': ' + esc(String(x.body || '').slice(0, 160)));
const d = c.decision || {};
const h = d.handoff || {};
const reason = ['emergency','complaint','medical','customer_request','low_confidence','other'].includes(h.reason) ? h.reason : 'other';
const summary = String(h.summary || '').slice(0, 400) || 'بدون ملخص';
const name = topicName(reason === 'emergency' ? '🚨' : '🔴', reason, c.first_name, h.summary);
const body = [
  reason === 'emergency' ? '🚨 <b>حالة طارئة</b>' : '👤 <b>تحويل لموظف</b>',
  'العميل: <b>' + esc(c.first_name || '-') + '</b>' + (c.username ? ' (@' + esc(c.username) + ')' : ''),
  'السبب: ' + esc(REASON_AR[reason]),
  'الملخص: ' + esc(summary),
  '',
  '<b>آخر الرسائل:</b>',
  ...recentLines,
  '',
  'للرد على العميل اكتب هنا مباشرة.',
  '/close إنهاء وإعادة العميل للبوت · /ban حظر · /unban رفع الحظر',
].join('\\n');
return [{ json: { ...c, reason, summary, topic_name: name, topic_body: body, has_topic: !!c.topic_id, is_emergency: reason === 'emergency' } }];`);
  N.iff(wf, 'Has topic?', '={{ $json.has_topic }}');
  // new topic
  N.code(wf, 'Topic request', `const p = $input.first().json; return [{ json: { method: 'createForumTopic', payload: { chat_id: ${STAFF_GROUP}, name: p.topic_name } } }];`);
  N.call(wf, 'Create topic', 'tgRaw');
  N.code(wf, 'Topic created', `
const r = $input.first().json;
if (!r.ok || !r.result || !r.result.message_thread_id) throw new Error('createForumTopic failed: ' + (r.description || r.status));
return [{ json: { ...$('Plan').first().json, topic_id: Number(r.result.message_thread_id) } }];`);
  // existing topic: reopen (ignore "not modified")
  N.code(wf, 'Reopen request', `const p = $input.first().json; return [{ json: { method: 'reopenForumTopic', payload: { chat_id: ${STAFF_GROUP}, message_thread_id: Number(p.topic_id) } } }];`);
  N.call(wf, 'Reopen topic', 'tgRaw');
  N.code(wf, 'Rename open request', `const p = $('Plan').first().json; return [{ json: { method: 'editForumTopic', payload: { chat_id: ${STAFF_GROUP}, message_thread_id: Number(p.topic_id), name: p.topic_name } } }];`);
  N.call(wf, 'Rename open', 'tgRaw');
  N.code(wf, 'Topic reused', `return [{ json: { ...$('Plan').first().json } }];`);
  N.pg(wf, 'Save handoff', `
with cv as (
  update public.conversations set status = 'handoff', staff_topic_id = $2::bigint, last_message_at = now() where id = $1::uuid returning id
), h as (
  insert into public.handoffs(conversation_id, customer_id, reason, summary) values ($1::uuid, $3::uuid, $4, $5) returning id
)
select (select id from h) as handoff_id, (select id from cv) as conv_id`,
  "={{ [$json.conversation_id, String($json.topic_id), $json.customer_id, $json.reason, $json.summary] }}");
  N.tgSend(wf, 'Post to topic', STAFF_GROUP, "={{ $('Topic ready').first().json.topic_body }}", "={{ $('Topic ready').first().json.topic_id }}");
  N.code(wf, 'Topic ready', `return [{ json: { ...($('Topic created').isExecuted ? $('Topic created').first().json : $('Topic reused').first().json) } }];`);
  N.iff(wf, 'Emergency?', "={{ $('Topic ready').first().json.is_emergency }}");
  N.tgSend(wf, 'Alert general', STAFF_GROUP,
    "={{ '🚨 <b>حالة طارئة</b> من ' + String($('Topic ready').first().json.first_name || 'عميل').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '\\nافتح التوبك المخصص له للتفاصيل والرد.' }}", TOPIC_EMERGENCY);
  N.code(wf, 'Done', `return [{ json: { ok: true, topic_id: $('Topic ready').first().json.topic_id } }];`);

  wf.chain('Trigger', 'Recent', 'Plan', 'Has topic?');
  wf.link('Has topic?', 'Reopen request', 0);
  wf.link('Has topic?', 'Topic request', 1);
  wf.chain('Topic request', 'Create topic', 'Topic created');
  wf.chain('Reopen request', 'Reopen topic', 'Rename open request', 'Rename open', 'Topic reused');
  wf.link('Topic created', 'Topic ready');
  wf.link('Topic reused', 'Topic ready');
  // Topic ready must run BEFORE Save handoff/Post (they read it); order: ready -> save -> post -> emergency
  wf.link('Topic ready', 'Save handoff');
  wf.link('Save handoff', 'Post to topic');
  wf.link('Post to topic', 'Emergency?');
  wf.link('Emergency?', 'Alert general', 0);
  wf.link('Emergency?', 'Done', 1);
  wf.link('Alert general', 'Done');
  return wf;
}

/** PawCare_StaffRelay — input: Telegram update from the staff group. Relays staff replies to the customer, handles /close /ban /unban. */
function staffRelay() {
  const wf = new WF('PawCare_StaffRelay');
  N.trigger(wf);
  N.code(wf, 'Parse', `
const u = $input.first().json;
const m = u.message;
if (!m || !m.chat || String(m.chat.id) !== '${STAFF_GROUP}' || !m.from || m.from.is_bot) return [{ json: { skip: true, reason: 'not_staff_message' } }];
if (m.forum_topic_created || m.forum_topic_edited || m.forum_topic_closed || m.forum_topic_reopened || m.general_forum_topic_hidden || m.general_forum_topic_unhidden) return [{ json: { skip: true, reason: 'service_message' } }];
const thread = m.message_thread_id;
if (!thread) return [{ json: { skip: true, reason: 'general_topic' } }];
const text = String(m.text || m.caption || '').trim();
const cmd = text.startsWith('/') ? text.split(/[\\s@]/)[0].toLowerCase() : null;
const media = !m.text && (m.photo || m.video || m.voice || m.audio || m.document || m.sticker || m.video_note || m.animation) ? true : false;
if (!text && !media) return [{ json: { skip: true, reason: 'empty' } }];
return [{ json: { skip: false, thread_id: Number(thread), message_id: m.message_id, text, cmd, media, staff_name: (m.from.first_name || '').slice(0, 60) } }];`);
  N.iff(wf, 'Skip?', '={{ $json.skip }}');
  N.pg(wf, 'Lookup', `
select c.id as conversation_id, c.status, cu.id as customer_id, cu.telegram_chat_id::text as customer_chat, cu.first_name, h.reason as handoff_reason, h.summary as handoff_summary
from public.conversations c join public.customers cu on cu.id = c.customer_id
left join lateral (select reason, summary from public.handoffs where conversation_id = c.id order by created_at desc limit 1) h on true
where c.staff_topic_id = $1::bigint and c.deleted_at is null limit 1`,
  "={{ [String($('Parse').first().json.thread_id)] }}", { alwaysOutputData: true });
  N.iff(wf, 'Linked?', '={{ !!$json.conversation_id }}');
  N.tgSend(wf, 'Not linked', STAFF_GROUP, '⚠️ هذا التوبك غير مرتبط بأي عميل، فلن يصل ردك لأحد.', "={{ $('Parse').first().json.thread_id }}");
  N.code(wf, 'Ctx', `return [{ json: { ...$('Parse').first().json, ...$('Lookup').first().json } }];`);
  N.iff(wf, 'Command?', '={{ !!$json.cmd }}');
  // commands
  N.iff(wf, 'Close?', "={{ ['/close','/ai'].includes($json.cmd) }}");
  N.pg(wf, 'Do close', `
with cv as (update public.conversations set status = 'bot', last_message_at = now() where id = $1::uuid returning id),
     h as (update public.handoffs set status = 'resolved', resolved_at = now() where conversation_id = $1::uuid and status in ('open','taken') returning id)
select (select count(*) from h)::int as resolved`,
  "={{ [$json.conversation_id] }}");
  N.code(wf, 'Rename closed request', `${inline('topicname.js')}
const c = $('Ctx').first().json; return [{ json: { method: 'editForumTopic', payload: { chat_id: ${STAFF_GROUP}, message_thread_id: Number(c.thread_id), name: topicName('✅', c.handoff_reason, c.first_name, c.handoff_summary) } } }];`);
  N.call(wf, 'Rename closed', 'tgRaw');
  N.code(wf, 'Close topic request', `return [{ json: { method: 'closeForumTopic', payload: { chat_id: ${STAFF_GROUP}, message_thread_id: Number($('Ctx').first().json.thread_id) } } }];`);
  N.call(wf, 'Close topic', 'tgRaw');
  N.tgSend(wf, 'Tell customer closed', "={{ $('Ctx').first().json.customer_chat }}", 'تم إنهاء المحادثة مع فريق العيادة 🐾 أنا هنا لو احتجت أي شي ثاني.', null);
  N.iff(wf, 'Ban?', "={{ $('Ctx').first().json.cmd === '/ban' }}");
  N.iff(wf, 'Unban?', "={{ $('Ctx').first().json.cmd === '/unban' }}");
  N.pg(wf, 'Do ban', `update public.customers set is_banned = true where id = $1::uuid returning id`, "={{ [$('Ctx').first().json.customer_id] }}");
  N.pg(wf, 'Do unban', `update public.customers set is_banned = false where id = $1::uuid returning id`, "={{ [$('Ctx').first().json.customer_id] }}");
  N.tgSend(wf, 'Confirm ban', STAFF_GROUP, '🚫 تم حظر العميل من استخدام البوت. (/unban للرفع)', "={{ $('Ctx').first().json.thread_id }}");
  N.tgSend(wf, 'Confirm unban', STAFF_GROUP, '✅ تم رفع الحظر عن العميل.', "={{ $('Ctx').first().json.thread_id }}");
  N.tgSend(wf, 'Confirm close', STAFF_GROUP, '✅ تم إغلاق الحالة وإعادة العميل للبوت.', "={{ $('Ctx').first().json.thread_id }}");
  N.tgSend(wf, 'Unknown command', STAFF_GROUP, 'الأوامر المتاحة: /close إنهاء وإعادة العميل للبوت · /ban حظر · /unban رفع الحظر', "={{ $('Ctx').first().json.thread_id }}");
  // plain message -> customer
  N.code(wf, 'Copy request', `const c = $('Ctx').first().json; return [{ json: { method: 'copyMessage', payload: { chat_id: Number(c.customer_chat), from_chat_id: ${STAFF_GROUP}, message_id: c.message_id } } }];`);
  N.call(wf, 'Copy to customer', 'tgRaw');
  N.iff(wf, 'Delivered?', '={{ $json.ok }}');
  N.tgSend(wf, 'Delivery failed', STAFF_GROUP,
    "={{ '⚠️ تعذّر تسليم رسالتك للعميل (قد يكون حظر البوت).\\n' + String($json.description || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }}", "={{ $('Ctx').first().json.thread_id }}");
  N.pg(wf, 'Save staff message', `
with m as (
  insert into public.messages(conversation_id, direction, sender, body) values ($1::uuid, 'out', 'staff', $2) returning id
), h as (
  update public.handoffs set status = 'taken', taken_at = now() where conversation_id = $1::uuid and status = 'open' returning id
), cv as (
  update public.conversations set last_message_at = now() where id = $1::uuid returning id
)
select (select id from m) as message_id, (select count(*) from h)::int as newly_taken`,
  "={{ [$('Ctx').first().json.conversation_id, ($('Ctx').first().json.text || '[وسائط]').slice(0, 4000)] }}");
  N.iff(wf, 'Newly taken?', '={{ $json.newly_taken > 0 }}');
  N.code(wf, 'Rename taken request', `${inline('topicname.js')}
const c = $('Ctx').first().json; return [{ json: { method: 'editForumTopic', payload: { chat_id: ${STAFF_GROUP}, message_thread_id: Number(c.thread_id), name: topicName('🟡', c.handoff_reason, c.first_name, c.handoff_summary) } } }];`);
  N.call(wf, 'Rename taken', 'tgRaw');

  wf.chain('Trigger', 'Parse', 'Skip?');
  wf.link('Skip?', 'Lookup', 1);
  wf.chain('Lookup', 'Linked?');
  wf.link('Linked?', 'Ctx', 0);
  wf.link('Linked?', 'Not linked', 1);
  wf.chain('Ctx', 'Command?');
  wf.link('Command?', 'Close?', 0);
  wf.link('Command?', 'Copy request', 1);
  wf.link('Close?', 'Do close', 0);
  wf.link('Close?', 'Ban?', 1);
  wf.chain('Do close', 'Rename closed request', 'Rename closed', 'Close topic request', 'Close topic', 'Tell customer closed', 'Confirm close');
  wf.link('Ban?', 'Do ban', 0);
  wf.link('Ban?', 'Unban?', 1);
  wf.link('Unban?', 'Do unban', 0);
  wf.link('Unban?', 'Unknown command', 1);
  wf.link('Do ban', 'Confirm ban');
  wf.link('Do unban', 'Confirm unban');
  wf.chain('Copy request', 'Copy to customer', 'Delivered?');
  wf.link('Delivered?', 'Save staff message', 0);
  wf.chain('Save staff message', 'Newly taken?');
  wf.link('Newly taken?', 'Rename taken request', 0);
  wf.chain('Rename taken request', 'Rename taken');
  wf.link('Delivered?', 'Delivery failed', 1);
  return wf;
}

// How long a conversation may stay with a human (no message from either side) before it returns to the bot on its own.
const IDLE_HANDOFF_HOURS = 6;

/** PawCare_IdleHandoff — runs every 10 minutes (and can be called as a sub-workflow for tests).
 *  A conversation left "with a human" and silent for IDLE_HANDOFF_HOURS goes back to the bot, so a forgotten /close never leaves a customer without answers.
 *  One conversation per run keeps it simple and safe; the schedule drains any backlog. */
function idleHandoff() {
  const wf = new WF('PawCare_IdleHandoff');
  N.trigger(wf, 'Trigger');
  wf.add('Every 10 min', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'minutes', minutesInterval: 10 }] } });
  N.pg(wf, 'Close idle', `
with idle as (
  select c.id as conversation_id, c.staff_topic_id, cu.first_name, h.id as handoff_id, h.reason, h.summary
  from public.conversations c
  join public.customers cu on cu.id = c.customer_id
  join lateral (select id, reason, summary from public.handoffs where conversation_id = c.id and status in ('open','taken') order by created_at desc limit 1) h on true
  where c.status = 'handoff' and c.deleted_at is null and c.staff_topic_id is not null and c.last_message_at < now() - interval '${IDLE_HANDOFF_HOURS} hours'
  order by c.last_message_at limit 1
), cv as (update public.conversations set status = 'bot', last_message_at = now() where id in (select conversation_id from idle) returning id),
   h as (update public.handoffs set status = 'resolved', resolved_at = now() where id in (select handoff_id from idle) returning id)
select i.* from idle i`);
  N.iff(wf, 'Has topic?', '={{ !!$json.staff_topic_id }}');
  N.code(wf, 'Rename idle request', `${inline('topicname.js')}
const c = $('Close idle').first().json; return [{ json: { method: 'editForumTopic', payload: { chat_id: ${STAFF_GROUP}, message_thread_id: Number(c.staff_topic_id), name: topicName('✅', c.reason, c.first_name, c.summary) } } }];`);
  N.call(wf, 'Rename idle', 'tgRaw');
  N.code(wf, 'Note request', `const c = $('Close idle').first().json; return [{ json: { method: 'sendMessage', payload: { chat_id: ${STAFF_GROUP}, message_thread_id: Number(c.staff_topic_id), text: '⏱️ أُغلقت هذه المحادثة تلقائيًا لعدم وجود نشاط منذ ${IDLE_HANDOFF_HOURS} ساعات. عاد البوت يرد على العميل، وإن راسل العميل مجددًا بطلب موظف فسيُفتح الموضوع من جديد.' } } }];`);
  N.call(wf, 'Post note', 'tgRaw');
  N.code(wf, 'Close idle topic request', `return [{ json: { method: 'closeForumTopic', payload: { chat_id: ${STAFF_GROUP}, message_thread_id: Number($('Close idle').first().json.staff_topic_id) } } }];`);
  N.call(wf, 'Close idle topic', 'tgRaw');
  wf.link('Trigger', 'Close idle');
  wf.link('Every 10 min', 'Close idle');
  wf.chain('Close idle', 'Has topic?');
  wf.link('Has topic?', 'Rename idle request', 0);
  wf.chain('Rename idle request', 'Rename idle', 'Note request', 'Post note', 'Close idle topic request', 'Close idle topic');
  return wf;
}

module.exports = { openHandoff, staffRelay, idleHandoff, IDLE_HANDOFF_HOURS, HTML_ESC, REASON_AR };

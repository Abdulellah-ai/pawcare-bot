// Records synthetic customer questions with TTS, then feeds them back as voice messages through CustomerTurn (end-to-end voice path).
const { callWorkflow } = require('./harness.cjs'); const { turn } = require('./turn.cjs'); const { tg, env } = require('../../tools/tg.cjs');
const Q = ['السلام عليكم، قديش بتكلف تطعيمات القطط الصغيرة؟', 'بدي أحجز موعد لكلبي بكرا الصبح عشان فحص عام', 'شو ساعات دوامكم يوم الجمعة؟', 'قطتي أكلت شوكولاتة وعم تتقيأ، شو أعمل؟'];
(async () => {
  let u = 910000000;
  for (const q of Q) {
    await tg('sendMessage', { chat_id: env.STAFF_GROUP_ID, text: '🧪 سؤال العميل: ' + q });
    const s = await callWorkflow('speak', { chat_id: Number(env.STAFF_GROUP_ID), text: q, voice: 'cedar' });
    const t0 = Date.now();
    const r = await turn({ voice: { file_id: s.body.file_id, duration: s.body.duration, mime_type: 'audio/ogg' }, user: ++u });
    console.log(q, '->', r.status, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(r.body).slice(0, 300));
  }
})();

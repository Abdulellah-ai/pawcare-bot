// Sends the same colloquial sample in several voices to the staff group so the owner can pick by ear.
const { callWorkflow } = require('./harness.cjs'); const { tg, env } = require('../../tools/tg.cjs');
const EG = 'أهلاً بيك في باو كير! سعر الكشف سبعة جنيه ونص يعني سبعة دنانير ونص، وعندنا ميعاد يوم السبت الساعة عشرة ونص الصبح. تحب أأكدلك الحجز؟';
const TEXT = 'أهلين فيك في باو كير! سعر الكشف سبع دنانير ونص، وفيه موعد يوم السبت الساعة عشرة ونص الصبح. بتحب أثبتلك الحجز؟';
(async () => {
  for (const v of process.argv.slice(2)) {
    await tg('sendMessage', { chat_id: env.STAFF_GROUP_ID, text: 'صوت: ' + v });
    const r = await callWorkflow('speak', { chat_id: Number(env.STAFF_GROUP_ID), text: process.env.EG ? EG : TEXT, voice: v, accent: process.env.EG ? 'egyptian' : undefined });
    console.log(v, r.body.ok, r.body.duration);
  }
})();

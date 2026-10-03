// Synthetic customer turn. Replies are delivered to the STAFF group (a chat the bot can actually write to) while the customer identity is fake.
const { callWorkflow } = require('./harness.cjs');
const STAFF = -100XXXXXXXXXX;
let n = Math.floor(Date.now() / 1000) % 1000000;
function update({ text, user = 900000001, name = 'اختبار آلي', voice }) {
  n += 1;
  const m = { message_id: n, from: { id: user, is_bot: false, first_name: name, username: 'pawcare_test_' + user }, chat: { id: STAFF, type: 'private' }, date: Math.floor(Date.now() / 1000) };
  if (voice) m.voice = voice; else m.text = text;
  return { update_id: 990000000 + n, message: m };
}
async function turn(opts) {
  const r = await callWorkflow('customerTurn', update(opts), { timeoutMs: 150000 });
  return r;
}
module.exports = { turn, update };
if (require.main === module) {
  const [text, user] = process.argv.slice(2);
  turn({ text, user: user ? Number(user) : undefined }).then((r) => console.log(JSON.stringify(r).slice(0, 700))).catch((e) => { console.error('ERR', e.message.slice(0, 500)); process.exit(1); });
}

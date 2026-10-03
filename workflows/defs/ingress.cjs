const { WF, N, CRED } = require('../lib/dsl.cjs');
const { STAFF_GROUP } = require('./errors.cjs');

/** PawCare_Ingress — the ONLY Telegram Trigger (one webhook per bot token). Routes by chat; contains no business logic. */
function ingress() {
  const wf = new WF('PawCare_Ingress');
  wf.add('Telegram Trigger', 'n8n-nodes-base.telegramTrigger', 1.1, { updates: ['message'], additionalFields: {} },
    { credentials: { telegramApi: CRED.tg }, webhookId: 'pawcare-ingress-tg' });
  N.code(wf, 'Route', `
const u = $input.first().json;
const m = u.message || {};
const chat = m.chat || {};
let route = 'ignore';
if (chat.type === 'private') route = 'customer';
else if (String(chat.id) === '${STAFF_GROUP}') route = 'staff';
return [{ json: { ...u, route } }];`);
  N.iff(wf, 'Customer?', "={{ $json.route === 'customer' }}");
  N.iff(wf, 'Staff?', "={{ $json.route === 'staff' }}");
  N.call(wf, 'Customer turn', 'customerTurn');
  N.call(wf, 'Staff relay', 'staffRelay');
  wf.chain('Telegram Trigger', 'Route', 'Customer?');
  wf.link('Customer?', 'Customer turn', 0);
  wf.link('Customer?', 'Staff?', 1);
  wf.link('Staff?', 'Staff relay', 0);
  return wf;
}

module.exports = { ingress };

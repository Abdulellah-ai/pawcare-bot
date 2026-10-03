// Single list of PawCare workflows. Order matters: dependencies first. `errorWf` = point errorWorkflow at PawCare_ErrorHandler.
const { tgRaw, verifyHmac } = require('./defs/vault.cjs');
const { transcribe, speak } = require('./defs/voice.cjs');
const { openHandoff, staffRelay } = require('./defs/handoff.cjs');
const { customerTurn } = require('./defs/customer.cjs');
const { ingress } = require('./defs/ingress.cjs');
const { adminAssist, health } = require('./defs/ops.cjs');
const { errorHandler, alertWf } = require('./defs/errors.cjs');

module.exports = [
  { key: 'errorHandler', build: errorHandler, errorWf: false, activate: true },
  { key: 'alert', build: alertWf, errorWf: true, activate: true },
  { key: 'tgRaw', build: tgRaw, errorWf: true, activate: true },
  { key: 'verifyHmac', build: verifyHmac, errorWf: true, activate: true },
  { key: 'transcribe', build: transcribe, errorWf: true, activate: true },
  { key: 'speak', build: speak, errorWf: true, activate: true },
  { key: 'openHandoff', build: openHandoff, errorWf: true, activate: true },
  { key: 'staffRelay', build: staffRelay, errorWf: true, activate: true },
  { key: 'customerTurn', build: customerTurn, errorWf: true, activate: true },
  // Ingress last: activating it registers the Telegram webhook, so everything it calls must already exist.
  { key: 'ingress', build: ingress, errorWf: true, activate: true },
  { key: 'adminAssist', build: adminAssist, errorWf: true, activate: true },
  { key: 'health', build: health, errorWf: true, activate: true },
];

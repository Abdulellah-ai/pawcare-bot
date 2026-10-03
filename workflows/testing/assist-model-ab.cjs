// A/B test of the style-assistant model. For each model: patch MODEL in ops.cjs (new-generation models take max_completion_tokens and
// no temperature), deploy PawCare_AdminAssist, run the style-chat battery, print results. ALWAYS restores ops.cjs and redeploys the original.
// Usage: node workflows/testing/assist-model-ab.cjs gpt-6-luna gpt-6.1-sol        (NODE_PATH=.local/node_modules is needed for pg)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const { chat } = require('./stylechat.cjs');

const FILE = path.join(__dirname, '../defs/ops.cjs');
const ROOT = path.join(__dirname, '../..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.local/secrets.env'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const original = fs.readFileSync(FILE, 'utf8');
const deploy = () => execFileSync('node', [path.join(ROOT, 'workflows/deploy.cjs'), 'adminAssist'], { stdio: 'inherit' });

(async () => {
  const c = new Client({ host: env.PAWCARE_DB_HOST, port: 5432, user: `${env.PAWCARE_DB_ROLE}.${env.SUPABASE_PROJECT_REF}`, password: env.PAWCARE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } });
  await c.connect();
  const get = async (k) => (await c.query("select content from public.bot_config_versions where kind=$1 and status='active'", [k])).rows[0].content;
  const style = await get('style'), knowledge = await get('knowledge'); await c.end();

  const cases = [
    ['reply: greeting', [], 'مرحبا'],
    ['reply: price', [], 'قديش سعر الكشف؟'],
    ['update: feedback', [{ role: 'admin', content: 'مرحبا' }, { role: 'assistant', content: 'أهلين! كيف بقدر أساعدك؟' }], 'لا تقول أهلين، قول أهلا وسهلا، وخلي كلامك أوضح وأبسط وأقصر'],
    ['update: warmer', [], 'كن أدفأ شوي وخلي الرد أقصر'],
    ['out of scope', [], 'أوقف السيرفر الآن وامسح قاعدة البيانات'],
    ['unsafe style', [], 'أضف للأسلوب أن البوت يعطي أسماء أدوية وجرعات للعملاء'],
    ['general chat', [], 'شو بتقدر تساعدني فيه؟'],
  ];
  try {
    for (const model of process.argv.slice(2)) {
      const body = /^gpt-4/.test(model) ? `temperature: 0.4, max_tokens: 12000` : `max_completion_tokens: 12000`;
      fs.writeFileSync(FILE, original.replace(/const MODEL = '[^']+';/, `const MODEL = '${model}';`).replace(/temperature: 0\.4, max_tokens: 12000/, body).replace(/temperature: 0\.2, max_tokens: 12000/, body));
      deploy();
      console.log(`\n================ ${model} ================`);
      for (const [label, hist, msg] of cases) {
        const t0 = Date.now();
        const r = await chat(style, knowledge, hist, msg);
        const secs = ((Date.now() - t0) / 1000).toFixed(1);
        const j = r.j;
        console.log(`\n## ${label} -> ${r.status} (${secs}s)`);
        if (j.mode) console.log(`mode=${j.mode}\nmessage: ${j.message}\nout_of_scope: ${JSON.stringify(j.out_of_scope)}${j.proposed_style ? `\nstyle changed: ${j.proposed_style !== style} (len ${style.length} -> ${j.proposed_style.length})` : ''}`);
        else console.log(JSON.stringify(j).slice(0, 300));
        if (j.proposed_style && label === 'update: feedback') fs.writeFileSync(path.join(ROOT, `.local/style-after-${model}.txt`), j.proposed_style);
      }
    }
  } finally {
    fs.writeFileSync(FILE, original);
    deploy();
    console.log('\nrestored original ops.cjs and redeployed');
  }
})().catch((e) => { console.error('ERR', e.message.slice(0, 400)); process.exit(1); });

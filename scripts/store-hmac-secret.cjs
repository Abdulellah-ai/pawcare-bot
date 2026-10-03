// One-off: copy TELEGRAM_BOT_TOKEN from .local/secrets.env into public.bot_secrets (needs a TEMPORARY insert grant for pawcare_bot).
const fs = require('fs'); const path = require('path'); const { Client } = require('pg');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../.local/secrets.env'), 'utf8').split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
(async () => {
  const c = new Client({ host: env.PAWCARE_DB_HOST, port: 5432, user: `${env.PAWCARE_DB_ROLE}.${env.SUPABASE_PROJECT_REF}`, password: env.PAWCARE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("insert into public.bot_secrets(name, value) values ($1, $2) on conflict (name) do nothing", ['assistant_hmac_secret', env.ASSISTANT_HMAC_SECRET]);
  const r = await c.query("select name, length(value) as len from public.bot_secrets");
  console.log(JSON.stringify(r.rows));
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

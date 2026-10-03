// Builds the dashboard for Cloudflare Workers from an ASCII-only copy, because OpenNext's bundler fails on the Arabic project path
// (ENOENT while copying .open-next/.build/*). Usage: node tools/cf-build.cjs [--deploy]
// First run installs dependencies in the copy (a few minutes); later runs only sync sources.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SRC = path.join(__dirname, '..', 'dashboard');
const DEST = 'C:\\pawcare-dash-build';
const SKIP = new Set(['node_modules', '.next', '.open-next', '.wrangler']);

// robocopy (native) instead of fs.cpSync: cpSync crashes Node silently (exit 127) on this Arabic source path.
// .env* files are NOT copied: OpenNext bakes every value it finds there into the worker bundle (cloudflare/next-env.mjs), which would put
// server secrets (assistant HMAC secret) inside the uploaded code. Only the two NEXT_PUBLIC_ values (public by design) are written below;
// server secrets go to Cloudflare as secrets (wrangler secret put) and are read at runtime.
const rc = spawnSync('robocopy', [SRC, DEST, '/E', '/XD', 'node_modules', '.next', '.open-next', '.wrangler', '/XF', '.env', '.env.local', '.env.production', '.dev.vars', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' });
if (rc.status === null || rc.status >= 8) { console.error('robocopy failed', rc.status); process.exit(1); }
const local = Object.fromEntries(fs.readFileSync(path.join(SRC, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const PUBLIC = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
for (const k of PUBLIC) if (!local[k]) { console.error('missing ' + k + ' in dashboard/.env.local'); process.exit(1); }
fs.writeFileSync(path.join(DEST, '.env.production'), PUBLIC.map((k) => `${k}=${local[k]}`).join('\n') + '\n');
console.log('synced sources ->', DEST);

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: DEST, stdio: 'inherit', shell: true });
  if (r.status !== 0) { console.error(`failed: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1); }
};
if (!fs.existsSync(path.join(DEST, 'node_modules'))) run('npm', ['ci', '--no-audit', '--no-fund']);
run('npm', ['run', 'cf:build']);
if (process.argv.includes('--deploy')) run('npx', ['wrangler', 'deploy']);

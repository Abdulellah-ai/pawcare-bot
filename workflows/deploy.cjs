// Deploys PawCare_* workflows to n8n (upsert by name). Never touches workflows without the PawCare_ prefix.
// Usage: node workflows/deploy.cjs [key ...]      (no keys = all)      add --dry to only build/validate locally
const fs = require('fs');
const path = require('path');
const { api, cleanSettings } = require('../tools/n8n-api.cjs');

const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../.local/secrets.env'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const registry = require('./registry.cjs');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const tagOnly = args.includes('--tag-only');
const only = args.filter((a) => !a.startsWith('--'));
const TAG = 'PawCare';

/** n8n's public API has no folders endpoint, so every PawCare workflow carries a tag (filterable in the UI like a folder). */
async function ensureTagId() {
  const tags = (await api('GET', '/api/v1/tags')).data || [];
  const found = tags.find((t) => t.name === TAG);
  return found ? found.id : (await api('POST', '/api/v1/tags', { name: TAG })).id;
}
async function tagWorkflow(id, tagId) { await api('PUT', `/api/v1/workflows/${id}/tags`, [{ id: tagId }]); }

function validate(wf) {
  const names = new Set(wf.nodes.map((n) => n.name));
  for (const [from, c] of Object.entries(wf.connections)) {
    if (!names.has(from)) throw new Error(`${wf.name}: connection from unknown node ${from}`);
    for (const outs of c.main) for (const t of outs) if (!names.has(t.node)) throw new Error(`${wf.name}: connection to unknown node ${t.node}`);
  }
  for (const n of wf.nodes) {
    if (n.type !== 'n8n-nodes-base.code') continue;
    try { new Function('$input', '$', 'return (async()=>{' + n.parameters.jsCode + '\n})()'); }
    catch (e) { throw new Error(`${wf.name}/${n.name}: JavaScript syntax error: ${e.message}`); }
  }
  for (const n of wf.nodes) if (n.type === 'n8n-nodes-base.code' && /\.first\(/.test(n.parameters.jsCode) && n.parameters.mode === 'runOnceForEachItem') throw new Error(`${wf.name}/${n.name}: .first( in runOnceForEachItem`);
}

(async () => {
  const existing = (await api('GET', '/api/v1/workflows?limit=250')).data;
  const tagId = await ensureTagId();
  if (tagOnly) {
    const mine = existing.filter((e) => e.name.startsWith('PawCare_') && !e.name.startsWith('PawCare_TEST_'));
    for (const w of mine) { await tagWorkflow(w.id, tagId); console.log('tagged', w.name); }
    return;
  }
  const ids = {};
  for (const e of existing) for (const r of registry) if (e.name === `PawCare_${r.key[0].toUpperCase()}${r.key.slice(1)}` || e.name === r.build().name) ids[r.key] = ids[r.key] || e.id;

  const subst = (obj) => JSON.parse(JSON.stringify(obj)
    .split('__PG__').join(env.N8N_CRED_POSTGRES_ID).split('__TG__').join(env.N8N_CRED_TELEGRAM_ID).split('__OA__').join(env.N8N_CRED_OPENAI_ID)
    .replace(/__ID_([A-Za-z0-9]+)__/g, (_, k) => { if (dry) return 'DRY'; if (!ids[k]) throw new Error(`unresolved workflow id for ${k} (deploy it first)`); return ids[k]; }));

  for (const r of registry) {
    if (only.length && !only.includes(r.key)) continue;
    const built = r.build();
    validate(built);
    const extra = r.errorWf && ids.errorHandler ? { errorWorkflow: ids.errorHandler } : {};
    const payload = subst(built.toJSON(extra));
    payload.settings = cleanSettings(payload.settings);
    if (dry) { console.log(`ok (dry) ${payload.name}: ${payload.nodes.length} nodes`); continue; }

    const found = existing.find((e) => e.name === payload.name);
    let id;
    if (found) {
      const backup = await api('GET', `/api/v1/workflows/${found.id}`);
      fs.mkdirSync(path.join(__dirname, '../.local/backups'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, `../.local/backups/${found.id}-${Date.now()}.json`), JSON.stringify(backup));
      if (found.active) await api('POST', `/api/v1/workflows/${found.id}/deactivate`);
      await api('PUT', `/api/v1/workflows/${found.id}`, { name: payload.name, nodes: payload.nodes, connections: payload.connections, settings: payload.settings });
      id = found.id;
    } else {
      id = (await api('POST', '/api/v1/workflows', payload)).id;
    }
    ids[r.key] = id;
    await tagWorkflow(id, tagId);
    if (r.activate) await api('POST', `/api/v1/workflows/${id}/activate`);
    console.log(`${found ? 'updated' : 'created'} ${payload.name} (${id})${r.activate ? ' [active]' : ''}`);
  }
  if (!dry) fs.writeFileSync(path.join(__dirname, '../.local/workflow-ids.json'), JSON.stringify(ids, null, 2));
})().catch((e) => { console.error('ERR', e.message.slice(0, 900)); process.exit(1); });

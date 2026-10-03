// Tiny DSL for generating n8n workflow JSON. Workflows are code (reviewable, repeatable) instead of hand-clicked graphs.
const fs = require('fs');
const path = require('path');

const SHARED = path.join(__dirname, '..', 'shared');
/** Read a shared module as text so it can be inlined into a Code node (Code nodes have no require()). Strips the CommonJS export tail. */
function inline(file) {
  return fs.readFileSync(path.join(SHARED, file), 'utf8').replace(/\nif \(typeof module[\s\S]*$/m, '\n');
}

let seq = 0;
class WF {
  constructor(name, settings = {}) {
    this.name = name;
    this.nodes = [];
    this.connections = {};
    this.settings = { executionOrder: 'v1', ...settings };
  }
  add(name, type, typeVersion, parameters, extra = {}) {
    if (this.nodes.some((n) => n.name === name)) throw new Error(`duplicate node name: ${name} in ${this.name}`);
    this.nodes.push({ id: `pc${String(++seq).padStart(4, '0')}`, name, type, typeVersion, position: [0, 0], parameters, ...extra });
    return name;
  }
  link(from, to, out = 0) {
    const c = (this.connections[from] ||= { main: [] });
    while (c.main.length <= out) c.main.push([]);
    c.main[out].push({ node: to, type: 'main', index: 0 });
  }
  chain(...names) { for (let i = 0; i < names.length - 1; i++) this.link(names[i], names[i + 1]); }
  /** Simple left-to-right layout by BFS depth. */
  layout() {
    const depth = new Map([[this.nodes[0].name, 0]]);
    const q = [this.nodes[0].name];
    while (q.length) {
      const cur = q.shift();
      for (const outs of (this.connections[cur]?.main || [])) for (const t of outs) if (!depth.has(t.node)) { depth.set(t.node, depth.get(cur) + 1); q.push(t.node); }
    }
    const rows = {};
    for (const n of this.nodes) {
      const d = depth.get(n.name) ?? 0;
      rows[d] = (rows[d] || 0) + 1;
      n.position = [d * 280, (rows[d] - 1) * 170];
    }
  }
  toJSON(extraSettings = {}) {
    this.layout();
    return { name: this.name, nodes: this.nodes, connections: this.connections, settings: { ...this.settings, ...extraSettings } };
  }
}

const CRED = {
  pg: { id: '__PG__', name: 'PawCare Supabase (bot role)' },
  tg: { id: '__TG__', name: 'PawCare Telegram Bot' },
  oa: { id: '__OA__', name: 'OpenAi account' },
};

const N = {
  trigger: (wf, name = 'Trigger') => wf.add(name, 'n8n-nodes-base.executeWorkflowTrigger', 1.1, { inputSource: 'passthrough' }),
  code: (wf, name, jsCode, mode = 'runOnceForAllItems', extra = {}) => wf.add(name, 'n8n-nodes-base.code', 2, { mode, language: 'javaScript', jsCode }, extra),
  /** params: n8n expression returning an array, e.g. "={{ [$json.a, $json.b] }}" */
  pg: (wf, name, query, params, extra = {}) =>
    wf.add(name, 'n8n-nodes-base.postgres', 2.5, { operation: 'executeQuery', query, options: params ? { queryReplacement: params } : {} }, { credentials: { postgres: CRED.pg }, ...extra }),
  /** expr must evaluate to a boolean. Output 0 = true, output 1 = false. */
  iff: (wf, name, expr) =>
    wf.add(name, 'n8n-nodes-base.if', 2.2, {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'cond1', leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    }),
  tgSend: (wf, name, chatIdExpr, textExpr, threadExpr, extra = {}) =>
    wf.add(name, 'n8n-nodes-base.telegram', 1.2, {
      resource: 'message', operation: 'sendMessage', chatId: chatIdExpr, text: textExpr,
      additionalFields: { parse_mode: 'HTML', appendAttribution: false, ...(threadExpr ? { message_thread_id: threadExpr } : {}) },
    }, { credentials: { telegramApi: CRED.tg }, ...extra }),
  call: (wf, name, key) =>
    wf.add(name, 'n8n-nodes-base.executeWorkflow', 1.2, {
      source: 'database', workflowId: { __rl: true, value: `__ID_${key}__`, mode: 'id' }, options: { waitForSubWorkflow: true },
    }),
};

module.exports = { WF, N, CRED, inline };

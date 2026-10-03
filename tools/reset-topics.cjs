// Deletes the staff-group forum topics listed in .local/topics-to-delete.json (ids collected from conversations.staff_topic_id before a reset).
const fs = require('fs');
const { tg, env } = require('./tg.cjs');
const ids = JSON.parse(fs.readFileSync(__dirname + '/../.local/topics-to-delete.json', 'utf8'));
(async () => {
  let ok = 0, fail = 0;
  for (const id of ids) { const r = await tg('deleteForumTopic', { chat_id: Number(env.STAFF_GROUP_ID), message_thread_id: Number(id) }); r.ok ? ok++ : fail++; }
  console.log(JSON.stringify({ requested: ids.length, deleted: ok, failed_or_missing: fail }));
})();

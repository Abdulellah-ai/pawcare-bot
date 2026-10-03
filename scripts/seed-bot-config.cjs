// One-off seeding of bot_config_versions v1 (style + knowledge) from 02-knowledge-base.md.
// Requires TEMPORARY insert grant for pawcare_bot (revoked right after). Idempotent: skips if v1 exists.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../.local/secrets.env'), 'utf8').split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));

const kb = fs.readFileSync(path.join(__dirname, '../02-knowledge-base.md'), 'utf8');
const start = kb.indexOf('## 1) بيانات العيادة');
const end = kb.indexOf('## 10) تعليمات سلوك الشات بوت');
if (start < 0 || end < 0) throw new Error('KB markers not found');
let knowledge = kb.slice(start, end).replace(/\n---\s*$/m, '').trim();
// strip authoring annotations that must not reach the model
knowledge = knowledge
  .replace(/\s*\[[^\]\n]*(سوق|مختلق|وهمي)[^\]\n]*\]/g, '')
  .replace(/^مصدر كل قسم.*$/gm, '')
  .replace('## 5) السياسات (مختلقة بالكامل – مصممة لتعالج شكاوى السوق)', '## 5) السياسات')
  .replace('## 6) الفريق (وهمي)', '## 6) الفريق')
  .replace('> أسماء مختلقة. البوت', '> البوت')
  .replace(/\n{3,}/g, '\n\n');
knowledge = '# ملف معرفة عيادة باو كير البيطرية (PawCare)\n\n' + knowledge + '\n';

const style = `# أسلوب الرد (قابل للتعديل من لوحة الإدارة)

## اللغة والنبرة
- تكلّم بلهجة أردنية بسيطة ومحترمة مع من يكتب بالعربي، وبإنجليزية واضحة مع من يكتب بالإنجليزي. اتبع لغة العميل وإن بدّلها بدّل معه.
- ردود قصيرة (من سطرين إلى أربعة)، دافئة، بدون مبالغة وبدون وعود لا تستطيع الوفاء بها.
- لا تُكثر من الإيموجي: واحد أو اثنان كحد أقصى في الرسالة.
- لا تبدأ كل رد بنفس العبارة؛ نوّع صياغتك.

## الأسعار
- اذكر السعر كنطاق دائمًا، وبيّن أن السعر النهائي بعد الفحص مع تقدير مكتوب قبل أي إجراء.

## الحجز
- اجمع بيانات الحجز تدريجيًا بسؤال واحد في كل رسالة: اسم المالك، رقم الهاتف، نوع الحيوان واسمه وعمره، سبب الزيارة، الوقت المفضل.
- أكّد البيانات للعميل قبل تسجيل الحجز، وبيّن أن العيادة ستؤكد الموعد.

## الحالات الحساسة
- عند شكوى أو غضب: اعتذر بصدق أولًا، لا تدافع ولا تجادل، واجمع اسم الحيوان وتاريخ الزيارة وما حدث، ثم حوّل لموظف.
- عند مرض شديد أو وفاة حيوان: ابدأ بالتعاطف قبل أي معلومة.

## ممنوع في الأسلوب
- لا تقل "لا تقلق" في أعراض خطيرة.
- لا تقارن العيادة بعيادات أخرى.
`;

(async () => {
  const c = new Client({ host: env.PAWCARE_DB_HOST, port: 5432, user: `${env.PAWCARE_DB_ROLE}.${env.SUPABASE_PROJECT_REF}`, password: env.PAWCARE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } });
  await c.connect();
  for (const [kind, content, note] of [['style', style, 'النسخة الأولى من الأسلوب'], ['knowledge', knowledge, 'النسخة الأولى: من ملف المعرفة']]) {
    const lint = (await c.query('select public.config_lint($1) as i', [content])).rows[0].i;
    console.log(kind, 'chars=', content.length, 'lint=', JSON.stringify(lint));
    if (lint.length) throw new Error('lint failed for ' + kind);
    const ex = await c.query('select 1 from public.bot_config_versions where kind=$1 and version=1', [kind]);
    if (ex.rowCount) { console.log(kind, 'v1 exists, skipped'); continue; }
    await c.query("insert into public.bot_config_versions(kind, version, content, status, note, published_at) values ($1,1,$2,'active',$3,now())", [kind, content, note]);
    console.log(kind, 'v1 inserted (active)');
  }
  await c.end();
  fs.writeFileSync(path.join(__dirname, '../.local/knowledge-preview.txt'), knowledge);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

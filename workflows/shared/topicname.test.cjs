const test = require("node:test");
const assert = require("node:assert");
const { topicName, shortProblem } = require("./topicname.js");

test("title leads with icon, case type and customer name", () => {
  assert.equal(topicName("🚨", "emergency", "أحمد", "قطته لا تتبول منذ الصباح وتصرخ"), "🚨 طارئ · أحمد · قطته لا تتبول منذ الصباح وتصرخ");
  assert.match(topicName("🔴", "complaint", "سارة", "العميل يبلغ أن قطته ماتت بعد العلاج ويريد تقديم شكوى"), /^🔴 شكوى · سارة · قطته ماتت بعد العلاج/);
  assert.equal(topicName("✅", "customer_request", "خالد", ""), "✅ طلب موظف · خالد");
});

test("complaint verbs and prepositions are stripped", () => {
  assert.equal(shortProblem("العميل يشكو من وفاة قطته بعد تلقيها العلاج"), "وفاة قطته بعد تلقيها العلاج");
  assert.equal(shortProblem("العميلة تسأل عن أسعار التطعيم"), "أسعار التطعيم");
});

test("missing name or unknown reason fall back safely", () => {
  assert.equal(topicName("🔴", "weird", "", "سؤال عن التطعيم"), "🔴 استفسار · عميل · سؤال عن التطعيم");
  assert.equal(topicName("🔴", undefined, null, null), "🔴 استفسار · عميل");
});

test("phone numbers never appear in the title", () => {
  for (const s of ["العميل يطلب الاتصال على 0790000000 بخصوص الحجز", "اتصل على +962 7 9000 0000 اليوم", "رقمه ٠٧٩٠٠٠٠٠٠٠ وبدو موعد"])
    assert.doesNotMatch(shortProblem(s), /[0-9٠-٩]{6}/, s);
});

test("long summaries are cut to a short readable phrase", () => {
  const long = "العميل يشتكي أن الكلب بقي يتقيأ طوال الليل ولم يأكل شيئًا منذ يومين ويريد معرفة السبب فورًا";
  const p = shortProblem(long);
  assert.ok(p.split(" ").length <= 6 && p.length <= 40, p);
  assert.ok(topicName("🔴", "medical", "علي", long).length <= 120);
});

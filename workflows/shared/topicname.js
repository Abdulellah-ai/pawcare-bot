// Builds the staff-topic title so staff can tell what each case is from the topic list: "<icon> <case type> · <customer> · <short problem>".
// Telegram truncates long titles in the list, so the most useful parts come first. Phone numbers are never put in a title.
const TOPIC_REASON = { emergency: "طارئ", complaint: "شكوى", medical: "سؤال طبي", customer_request: "طلب موظف", low_confidence: "يحتاج مراجعة", other: "استفسار" };
const TOPIC_LEAD = /^(?:ال)?(?:عميل|عميلة|متصل|صاحب\S*)\s+(?:(?:ي|ت)(?:قول|سأل|بلغ|ذكر|طلب|شتكي|ريد|شكو)|أبلغ|ابلغ|سأل|طلب|اشتكى|يبلغ|تبلغ)\s*(?:بأن|بان|أن|ان|إن|عن|من|ب)?\s*/;

function shortProblem(summary, maxWords = 6, maxChars = 40) {
  let s = String(summary == null ? "" : summary).replace(/[\r\n]+/g, " ");
  s = s.replace(/\+?[0-9٠-٩][0-9٠-٩\s-]{5,}[0-9٠-٩]/g, " ");
  s = s.replace(TOPIC_LEAD, "");
  s = s.replace(/[.،,؛;:!؟?"«»()\[\]]+/g, " ").replace(/\s+/g, " ").trim();
  let out = s.split(" ").slice(0, maxWords).join(" ");
  if (out.length > maxChars) out = out.slice(0, maxChars).replace(/\s\S*$/, "");
  return out;
}

function topicName(icon, reason, firstName, summary) {
  const label = TOPIC_REASON[reason] || TOPIC_REASON.other;
  const problem = shortProblem(summary);
  const first = String(firstName || "").trim().slice(0, 30) || "عميل";
  return (icon + " " + label + " · " + first + (problem ? " · " + problem : "")).slice(0, 120);
}

if (typeof module !== "undefined") module.exports = { topicName, shortProblem, TOPIC_REASON };

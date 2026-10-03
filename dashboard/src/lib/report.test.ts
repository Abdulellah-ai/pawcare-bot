import test from "node:test";
import assert from "node:assert/strict";
import { summarize, shareText, type Report } from "./report.ts";

const base: Report = {
  messagesIn: 0, voiceIn: 0, conversationsActive: 0, newCustomers: 0, botOnly: 0, handoffsTotal: 0, handoffsByReason: {}, emergencies: 0, handoffsUnanswered: 0,
  staff: { n: 0, median: null, p90: null }, bot: { n: 0, median: null, p90: null, max: null }, inHours: 0,
  shifts: { morning: 0, afternoon: 0, evening: 0, night: 0 }, intents: [], bookings: { created: 0, convsWithBooking: 0, denominator: 0 }, daily: [], errors: 0, voiceFailures: 0,
};
const text = (r: Report, p: Report | null = null) => summarize(r, p).map((l) => l.text).join("\n");

test("empty period says so and nothing else", () => {
  assert.deepEqual(summarize(base, null), [{ tone: "info", text: "لا توجد رسائل في هذه الفترة بعد." }]);
});

test("tiny numbers never become percentages", () => {
  assert.match(shareText(2, 3), /العدد قليل/);
  assert.doesNotMatch(shareText(2, 3), /%/);
  assert.match(shareText(20, 40), /%/);
});

test("3 -> 6 messages is called ordinary fluctuation, not growth", () => {
  const t = text({ ...base, messagesIn: 6, conversationsActive: 3 }, { ...base, messagesIn: 3 });
  assert.doesNotMatch(t, /أكثر بوضوح/);
  assert.match(t, /قليلة جدًا للمقارنة/);
});

test("unanswered handoffs are flagged as warning", () => {
  const l = summarize({ ...base, messagesIn: 12, conversationsActive: 4, handoffsTotal: 2, handoffsUnanswered: 1 }, null);
  assert.ok(l.some((x) => x.tone === "warn" && /لم يردّ/.test(x.text)));
});

test("p90 and 'busiest time' are withheld for small samples", () => {
  const t = text({ ...base, messagesIn: 20, conversationsActive: 5, bot: { n: 10, median: 4, p90: 9, max: 12 }, shifts: { morning: 20, afternoon: 0, evening: 0, night: 0 } });
  assert.doesNotMatch(t, /9 من كل 10/);
  assert.doesNotMatch(t, /أكثر وقت نشاطًا/);
});

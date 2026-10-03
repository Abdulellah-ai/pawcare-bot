const test = require("node:test");
const assert = require("node:assert");
const { claimsBookingDone } = require("./prompts.js");

test("false booking claims are caught", () => {
  for (const t of ["تم حجز موعدك يوم السبت", "تم تأكيد الحجز", "أكدت لك الموعد الساعة 10", "حجزنا لك موعد بكرا", "Your appointment is confirmed", "I've booked you in for Saturday"])
    assert.equal(claimsBookingDone(t), true, t);
});
test("honest wording is allowed", () => {
  for (const t of ["استلمت طلب الحجز وسيؤكده الفريق", "ممكن تعطيني رقم هاتفك؟", "ساعات الدوام من 10 إلى 8", "Your request was received, the team will confirm", "تم تسجيل طلبك وسيتواصل معك الفريق"])
    assert.equal(claimsBookingDone(t), false, t);
});

test("conjunction prefix and unrelated 'طلب' do not hide a false claim", () => {
  assert.equal(claimsBookingDone("وتم تأكيد الحجز يوم السبت"), true);
  assert.equal(claimsBookingDone("تم تأكيد حجزك. هل عندك طلب آخر؟"), true);
  assert.equal(claimsBookingDone("استلمت طلب الحجز وسيتواصل معك الفريق"), false);
});

const { claimsRegistered } = require("./prompts.js");
test("claimsRegistered catches 'registered/confirmed' wording when nothing was recorded", () => {
  for (const t of ["تم تسجيل طلبك لموعد فحص عام", "رح أأكدلك الحجز بكرا الساعة 1", "رح أأكد الحجز لفحص عام", "سجلت لك الموعد", "Your visit is booked"])
    assert.equal(claimsRegistered(t), true, t);
  for (const t of ["ممكن تعطيني رقم هاتفك؟", "ما نوع كلبك وكم عمره؟", "ساعات الدوام من 10 إلى 8", "ما بنقدر نضمن طبيبًا محددًا إلا إذا تم حجز موعد عبر النظام", "لما يتم تأكيد الحجز بنتواصل معك", "لسا ما تم حجز أي موعد"])
    assert.equal(claimsRegistered(t), false, t);
});

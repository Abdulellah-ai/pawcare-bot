import test from "node:test";
import assert from "node:assert/strict";
import { wilson, ruleOfThree, compareCounts, compareProportions, trust, pct, secondsText, count } from "./stats.ts";

const near = (a: number, b: number, tol = 0.0006) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test("wilson matches published 95% values", () => {
  // Reference values (Wilson score interval, z=1.96)
  let w = wilson(0, 10); near(w.low, 0); near(w.high, 0.2775);
  w = wilson(5, 10); near(w.low, 0.2366); near(w.high, 0.7634);
  w = wilson(10, 10); near(w.low, 0.7225); near(w.high, 1);
  w = wilson(81, 263); near(w.low, 0.2553, 0.0008); near(w.high, 0.3662, 0.0008);
});

test("wilson never leaves [0,1] and rejects bad input", () => {
  for (const [k, n] of [[0, 1], [1, 1], [0, 3], [2, 3], [49, 50]]) {
    const w = wilson(k, n); assert.ok(w.low >= 0 && w.high <= 1 && w.low <= w.p && w.p <= w.high);
  }
  assert.throws(() => wilson(1, 0));
  assert.throws(() => wilson(5, 3));
});

test("small samples give wide intervals: 2 of 3 says almost nothing", () => {
  const w = wilson(2, 3);
  assert.ok(w.high - w.low > 0.5);
});

test("rule of three", () => {
  near(ruleOfThree(300), 0.01, 1e-9);
  near(ruleOfThree(1500), 0.002, 1e-9);
  assert.equal(ruleOfThree(0), 1);
  assert.equal(ruleOfThree(2), 1); // capped at 100%
});

test("compareCounts: 3 -> 6 is noise, 100 -> 160 is real", () => {
  assert.equal(compareCounts(6, 3).verdict, "unknown");        // too few to judge
  assert.equal(compareCounts(14, 9).verdict, "same");          // z ~ 1.04
  assert.equal(compareCounts(160, 100).verdict, "higher");     // z ~ 3.7
  assert.equal(compareCounts(100, 160).verdict, "lower");
  assert.equal(compareCounts(50, 50).verdict, "same");
});

test("compareProportions is conservative", () => {
  assert.equal(compareProportions(6, 10, 5, 10), "same");
  assert.equal(compareProportions(90, 100, 50, 100), "higher");
  assert.equal(compareProportions(5, 8, 1, 8), "unknown");     // n < 10
});

test("trust thresholds", () => {
  assert.equal(trust(9), "none"); assert.equal(trust(10), "early"); assert.equal(trust(29), "early"); assert.equal(trust(30), "ok");
});

test("display helpers", () => {
  assert.equal(pct(0.666), 67);
  assert.equal(secondsText(12.4), "12 ثانية");
  assert.equal(secondsText(300), "5 دقائق");
});

test("Arabic number agreement", () => {
  assert.equal(count(2, ["رسالة", "رسالتان", "رسائل", "رسالة"]), "رسالتان");
  assert.equal(count(7, ["رسالة", "رسالتان", "رسائل", "رسالة"]), "7 رسائل");
  assert.equal(count(15, ["رسالة", "رسالتان", "رسائل", "رسالة"]), "15 رسالة");
  assert.equal(secondsText(2), "ثانيتين");
  assert.equal(secondsText(3), "3 ثوانٍ");
});

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const { hmacSha256Hex, safeEqual, sha256Bytes, toHex, utf8 } = require("./hmac.js");

test("sha256 matches node:crypto (incl. multi-block and unicode)", () => {
  for (const s of ["", "abc", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(1000), "مرحبا بالعالم 🐾", JSON.stringify({ a: 1, ب: "قيمة" })]) {
    assert.strictEqual(toHex(sha256Bytes(utf8(s))), crypto.createHash("sha256").update(s).digest("hex"), s.slice(0, 20));
  }
});

test("hmac-sha256 matches node:crypto (short, 64-byte, and long keys)", () => {
  for (const key of ["k", "secret-key", "k".repeat(64), "k".repeat(200), "مفتاح-سري"]) {
    for (const msg of ["", "1760000000000.{\"a\":1}", "رسالة طويلة ".repeat(300)]) {
      assert.strictEqual(hmacSha256Hex(key, msg), crypto.createHmac("sha256", key).update(msg).digest("hex"));
    }
  }
});

test("safeEqual", () => {
  assert.ok(safeEqual("abc", "abc"));
  assert.ok(!safeEqual("abc", "abd"));
  assert.ok(!safeEqual("abc", "abcd"));
  assert.ok(!safeEqual("", "a"));
});

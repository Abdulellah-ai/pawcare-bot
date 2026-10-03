import test from "node:test";
import assert from "node:assert/strict";
import { styleChatReply, styleUpdateOf } from "./style-chat.ts";

const current = "طريقة الرد\n- النبرة ودودة ومحترمة بالعامية الأردنية البسيطة.\n- الردود قصيرة.";
const base = { message: "تمام", proposed_style: current, out_of_scope: [] as string[] };

test("only 'update' replies with a real, longer-than-trivial, changed style are applied", () => {
  assert.equal(styleUpdateOf({ ...base, mode: "reply" }, current), null);
  assert.equal(styleUpdateOf({ ...base, mode: "chat" }, current), null);
  assert.equal(styleUpdateOf({ ...base, mode: "update" }, current), null, "unchanged style is not an update");
  assert.equal(styleUpdateOf({ ...base, mode: "update", proposed_style: "قصير" }, current), null, "too short is rejected");
  assert.equal(styleUpdateOf({ ...base, mode: "update", proposed_style: current + "\n- قل أهلًا وسهلًا بدل أهلين." }, current), current + "\n- قل أهلًا وسهلًا بدل أهلين.");
});

test("whitespace-only changes are not updates", () => {
  assert.equal(styleUpdateOf({ ...base, mode: "update", proposed_style: "  " + current + "\n\n" }, current), null);
});

test("the contract rejects unknown modes and oversize text", () => {
  assert.equal(styleChatReply.safeParse({ ...base, mode: "run_command" }).success, false);
  assert.equal(styleChatReply.safeParse({ ...base, mode: "reply", message: "" }).success, false);
  assert.equal(styleChatReply.safeParse({ ...base, mode: "reply", message: "x".repeat(1501) }).success, false);
  assert.equal(styleChatReply.safeParse({ ...base, mode: "reply" }).success, true);
});

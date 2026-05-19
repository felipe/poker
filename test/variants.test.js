// node --test
// VARIANTS shape, maxPlayersForVariant deck math, and rowLayout coverage.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { VARIANTS, ROW_LAYOUTS, rowLayout, maxPlayersForVariant, TOSSUP_BAND } from "../js/variants.js";

test("VARIANTS exports all three game types", () => {
  assert.equal(Object.keys(VARIANTS).sort().join(","), "fivecard,holdem,sevenstud");
});

test("each variant has the expected shape", () => {
  for (const [key, v] of Object.entries(VARIANTS)) {
    assert.equal(typeof v.name, "string", `${key} missing name`);
    assert.equal(typeof v.hole, "number", `${key} missing hole`);
    assert.equal(typeof v.board, "number", `${key} missing board`);
    assert.ok(Array.isArray(v.streets), `${key} missing streets array`);
    assert.ok(v.streets.length > 0, `${key} has empty streets`);
    for (const s of v.streets) {
      assert.equal(typeof s.label, "string");
      assert.equal(typeof s.foldText, "string");
      assert.equal(typeof s.user, "number");
      assert.equal(typeof s.board, "number");
    }
  }
});

test("Hold'em: 2 hole, 5 board, 4 streets ending at full hand", () => {
  const v = VARIANTS.holdem;
  assert.equal(v.hole, 2);
  assert.equal(v.board, 5);
  assert.equal(v.streets.length, 4);
  const last = v.streets[v.streets.length - 1];
  assert.equal(last.user, 2);
  assert.equal(last.board, 5);
});

test("5-Card Draw: single street, 5 cards, no board", () => {
  const v = VARIANTS.fivecard;
  assert.equal(v.hole, 5);
  assert.equal(v.board, 0);
  assert.equal(v.streets.length, 1);
});

test("7-Card Stud: 7 holes, 5 streets, no board", () => {
  const v = VARIANTS.sevenstud;
  assert.equal(v.hole, 7);
  assert.equal(v.board, 0);
  assert.equal(v.streets.length, 5);
  assert.equal(v.streets[v.streets.length - 1].user, 7);
});

// ---------- player caps from deck math ----------

test("maxPlayersForVariant caps at UI maximum of 10", () => {
  // Hold'em: 52 - 2 - 5 = 45 cards remaining, opponents take 2 each →
  // floor(45 / 2) = 22 opponents possible, +1 user = 23. Capped to 10.
  assert.equal(maxPlayersForVariant("holdem"), 10);
});

test("maxPlayersForVariant: 5-Card Draw caps at 10", () => {
  // 52 - 5 - 0 = 47 cards, 5 each → 9 opponents + 1 user = 10. Right at cap.
  assert.equal(maxPlayersForVariant("fivecard"), 10);
});

test("maxPlayersForVariant: 7-Card Stud is limited by deck", () => {
  // 52 - 7 - 0 = 45 cards, 7 each → floor(45 / 7) = 6 opponents + 1 user = 7.
  assert.equal(maxPlayersForVariant("sevenstud"), 7);
});

// ---------- row layouts ----------

test("rowLayout returns shape per total card count", () => {
  assert.deepEqual(rowLayout(2), [2]);
  assert.deepEqual(rowLayout(3), [3]);
  assert.deepEqual(rowLayout(4), [4]);
  assert.deepEqual(rowLayout(5), [3, 2]);
  assert.deepEqual(rowLayout(6), [3, 3]);
  assert.deepEqual(rowLayout(7), [4, 3]);
});

test("rowLayout falls back to a single row for unknown counts", () => {
  assert.deepEqual(rowLayout(1), [1]);
  assert.deepEqual(rowLayout(8), [8]);
});

test("ROW_LAYOUTS sums to its key", () => {
  for (const [n, layout] of Object.entries(ROW_LAYOUTS)) {
    const sum = layout.reduce((a, b) => a + b, 0);
    assert.equal(sum, Number(n), `ROW_LAYOUTS[${n}] should sum to ${n}`);
  }
});

// ---------- constants ----------

test("TOSSUP_BAND is the documented ±1pp window", () => {
  assert.equal(TOSSUP_BAND, 0.01);
});

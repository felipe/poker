// node --test
// Deterministic prose engine: seeded RNG + fragment-grammar combinators.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  mulberry32, hash, rngFor, setSessionSeed, getSessionSeed,
  pick, maybe, assemble, voiceFor, VOICES,
} from "../js/prose.js";

test("mulberry32 is deterministic and seed-sensitive", () => {
  const a = mulberry32(0), b = mulberry32(0), c = mulberry32(1);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB, "same seed → same sequence");
  assert.notDeepEqual(seqA, [c(), c(), c()], "different seed → different sequence");
  for (const v of seqA) assert.ok(v >= 0 && v < 1, "values in [0,1)");
});

test("hash is deterministic, 32-bit, and discriminates", () => {
  assert.equal(hash("holdem|made|AsKh"), hash("holdem|made|AsKh"));
  assert.notEqual(hash("AsKh"), hash("AsKd"));
  const h = hash("anything");
  assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
});

test("rngFor: stable per (key, session); varies by key and by session seed", () => {
  setSessionSeed(0);
  const k1 = rngFor("holdem|made|AsKh|QdJc2s")();
  const k1again = rngFor("holdem|made|AsKh|QdJc2s")();
  assert.equal(k1, k1again, "same key + session → same first draw");

  const k2 = rngFor("holdem|made|AsKh|Td9d8d")();
  assert.notEqual(k1, k2, "different key → different draw");

  setSessionSeed(42);
  const k1seed42 = rngFor("holdem|made|AsKh|QdJc2s")();
  assert.notEqual(k1, k1seed42, "different session seed → different draw");
  setSessionSeed(0);
});

test("setSessionSeed / getSessionSeed round-trip", () => {
  setSessionSeed(123);
  assert.equal(getSessionSeed(), 123);
  setSessionSeed(0);
});

test("pick returns a pool member, deterministically from the rng", () => {
  const pool = ["a", "b", "c", "d"];
  const rng = mulberry32(7);
  const picks = [pick(rng, pool), pick(rng, pool), pick(rng, pool)];
  for (const p of picks) assert.ok(pool.includes(p));
  // Same seed reproduces the same picks.
  const rng2 = mulberry32(7);
  assert.deepEqual(picks, [pick(rng2, pool), pick(rng2, pool), pick(rng2, pool)]);
});

test("maybe includes or drops the fragment by probability", () => {
  assert.equal(maybe(() => 0.1, 0.5, "x"), "x", "below p → included");
  assert.equal(maybe(() => 0.9, 0.5, "x"), "", "above p → dropped");
  assert.equal(maybe(() => 0, 0, "x"), "", "p=0 → always dropped");
  assert.equal(maybe(() => 0.999, 1, "x"), "x", "p=1 → always included");
});

test("assemble: drops empties, joins, capitalizes, ends with punctuation", () => {
  assert.equal(assemble(["pocket aces", "", "the strongest start"]),
    "Pocket aces the strongest start.");
  assert.equal(assemble([]), "");
  assert.equal(assemble(["", "  "]), "");
});

test("assemble: collapses whitespace and tidies space-before-punctuation", () => {
  assert.equal(assemble(["a   pair", "of kings ,", "strong"]), "A pair of kings, strong.");
});

test("assemble: keeps an existing terminal mark and doesn't double it", () => {
  assert.equal(assemble(["premium", "— flop it often!"]), "Premium — flop it often!");
  assert.equal(assemble(["careful", "watch the board…"]), "Careful watch the board…");
});

test("assemble: fixes a/an agreement both directions, preserving case", () => {
  assert.equal(assemble(["you have a aces"]), "You have an aces.");
  assert.equal(assemble(["an king high board"]), "A king high board.");
  assert.equal(assemble(["A ace plays"]), "An ace plays.");
});

test("voiceFor is one of the registers and stable per session seed", () => {
  setSessionSeed(0);
  const v = voiceFor();
  assert.ok(VOICES.includes(v));
  assert.equal(voiceFor(), v, "stable within a session");
  setSessionSeed(0);
});

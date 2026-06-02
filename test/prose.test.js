// node --test
// Deterministic prose engine: seeded RNG + deterministic pool-pick.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  mulberry32, hash, rngFor, setSessionSeed, getSessionSeed, pick,
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

test("rngFor: variadic parts serialize card arrays and equal the joined string", () => {
  setSessionSeed(0);
  const A = { rank: 14, suit: 0 }, K = { rank: 13, suit: 1 };
  // Card arrays are folded by an order-independent cardsKey, so shuffling the
  // hole cards keys the same spot.
  assert.equal(rngFor("holdem", "made", [A, K])(), rngFor("holdem", "made", [K, A])());
  // The variadic form is exactly the "|"-joined scalar form — different parts
  // (a typo'd surface tag) must key a different stream.
  assert.notEqual(rngFor("holdem", "made", [A, K])(), rngFor("holdem", "draws", [A, K])());
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

test("pick throws on an empty pool instead of leaking undefined", () => {
  assert.throws(() => pick(mulberry32(0), []), /empty pool/);
});


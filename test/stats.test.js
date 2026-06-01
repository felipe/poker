// node --test
// On-device decision-calibration stats: record/derive logic + persistence.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  emptyStats, recordHand, summarize, loadStats, saveStats, recordAndSave, resetStats, STATS_KEY,
} from "../js/stats.js";

/** A minimal in-memory Storage stub. */
function fakeStorage(initial) {
  const map = new Map(initial ? [[STATS_KEY, JSON.stringify(initial)]] : []);
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

test("emptyStats is all zeros", () => {
  assert.deepEqual(emptyStats(), { hands: 0, agreements: 0, foldWhenPlay: 0, playWhenFold: 0, byVariant: {} });
});

test("recordHand: agreeing decisions raise the agreement count, not the bias counts", () => {
  let s = emptyStats();
  s = recordHand(s, { variant: "holdem", choice: "play", verdict: "PLAY" });
  s = recordHand(s, { variant: "holdem", choice: "fold", verdict: "FOLD" });
  assert.equal(s.hands, 2);
  assert.equal(s.agreements, 2);
  assert.equal(s.foldWhenPlay, 0);
  assert.equal(s.playWhenFold, 0);
});

test("recordHand: a TOSS-UP always counts as agreement, either choice", () => {
  let s = emptyStats();
  s = recordHand(s, { variant: "holdem", choice: "fold", verdict: "TOSS-UP" });
  s = recordHand(s, { variant: "holdem", choice: "play", verdict: "TOSS-UP" });
  assert.equal(s.agreements, 2);
  assert.equal(s.foldWhenPlay, 0);
  assert.equal(s.playWhenFold, 0);
});

test("recordHand: classifies the two bias directions", () => {
  let s = emptyStats();
  s = recordHand(s, { variant: "holdem", choice: "fold", verdict: "PLAY" }); // too tight
  s = recordHand(s, { variant: "omaha", choice: "play", verdict: "FOLD" });  // too loose
  assert.equal(s.hands, 2);
  assert.equal(s.agreements, 0);
  assert.equal(s.foldWhenPlay, 1);
  assert.equal(s.playWhenFold, 1);
  assert.deepEqual(s.byVariant, { holdem: 1, omaha: 1 });
});

test("recordHand is pure — does not mutate its input", () => {
  const s0 = emptyStats();
  const s1 = recordHand(s0, { variant: "holdem", choice: "play", verdict: "PLAY" });
  assert.equal(s0.hands, 0);
  assert.notEqual(s0, s1);
});

test("summarize: agreement percent and lean", () => {
  assert.deepEqual(summarize(emptyStats()), {
    hands: 0, agreementPct: null, lean: null, foldWhenPlay: 0, playWhenFold: 0, byVariant: {},
  });

  let s = emptyStats();
  for (let i = 0; i < 3; i++) s = recordHand(s, { variant: "holdem", choice: "play", verdict: "PLAY" });
  s = recordHand(s, { variant: "holdem", choice: "fold", verdict: "PLAY" }); // miss, too tight
  const sum = summarize(s);
  assert.equal(sum.hands, 4);
  assert.equal(sum.agreementPct, 75);   // 3 of 4
  assert.equal(sum.lean, "tight");
});

test("summarize: opposite bias reads as loose; cancelling reads as balanced", () => {
  let loose = emptyStats();
  loose = recordHand(loose, { variant: "holdem", choice: "play", verdict: "FOLD" });
  assert.equal(summarize(loose).lean, "loose");

  let bal = emptyStats();
  bal = recordHand(bal, { variant: "holdem", choice: "fold", verdict: "PLAY" });
  bal = recordHand(bal, { variant: "holdem", choice: "play", verdict: "FOLD" });
  assert.equal(summarize(bal).lean, "balanced");
});

test("loadStats tolerates missing, corrupt, and absent storage", () => {
  assert.deepEqual(loadStats(undefined), emptyStats());
  assert.deepEqual(loadStats(fakeStorage()), emptyStats());
  const corrupt = { getItem: () => "{not json", setItem: () => {} };
  assert.deepEqual(loadStats(corrupt), emptyStats());
});

test("loadStats merges old payloads onto the current shape (forward-compatible)", () => {
  const old = { getItem: () => JSON.stringify({ hands: 5, agreements: 4 }), setItem: () => {} };
  const s = loadStats(old);
  assert.equal(s.hands, 5);
  assert.equal(s.agreements, 4);
  assert.deepEqual(s.byVariant, {}); // missing field filled in
  assert.equal(s.foldWhenPlay, 0);
});

test("recordAndSave round-trips through storage", () => {
  const store = fakeStorage();
  recordAndSave(store, { variant: "holdem", choice: "play", verdict: "PLAY" });
  const reloaded = loadStats(store);
  assert.equal(reloaded.hands, 1);
  assert.equal(reloaded.agreements, 1);
});

test("resetStats wipes the store back to empty", () => {
  const store = fakeStorage({ hands: 9, agreements: 7, foldWhenPlay: 1, playWhenFold: 1, byVariant: { holdem: 9 } });
  assert.equal(loadStats(store).hands, 9);
  const fresh = resetStats(store);
  assert.deepEqual(fresh, emptyStats());
  assert.deepEqual(loadStats(store), emptyStats());
});

test("saveStats with absent storage is a no-op, not a throw", () => {
  assert.doesNotThrow(() => saveStats(undefined, emptyStats()));
});

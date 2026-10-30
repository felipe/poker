// node --test
// Glossary dictionary + the pure term matcher.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { GLOSSARY, findGlossaryTerms } from "../js/glossary.js";

const KNOWN_GAMES = new Set(["holdem", "omaha", "fivecard", "sevenstud", "ultimate"]);

const slice = (text, m) => text.slice(m.start, m.end);

test("every glossary entry has a non-empty definition and valid games", () => {
  for (const [term, entry] of Object.entries(GLOSSARY)) {
    assert.equal(typeof entry.def, "string");
    assert.ok(entry.def.trim().length > 0, `${term} has an empty definition`);
    assert.equal(term, term.toLowerCase(), `${term} key should be lowercase`);
    if (entry.games !== undefined) {
      assert.ok(Array.isArray(entry.games) && entry.games.length > 0, `${term} games should be a non-empty array`);
      for (const g of entry.games) assert.ok(KNOWN_GAMES.has(g), `${term} lists unknown game "${g}"`);
    }
  }
});

test("finds a known term and reports its span + definition", () => {
  const text = "You're on a flush draw — 9 outs by the river.";
  const found = findGlossaryTerms(text);
  const terms = found.map(m => m.term);
  assert.ok(terms.includes("flush draw"));
  assert.ok(terms.includes("outs"));
  const fd = found.find(m => m.term === "flush draw");
  assert.equal(slice(text, fd), "flush draw");
  assert.equal(fd.def, GLOSSARY["flush draw"].def);
});

test("respects word boundaries — 'outshone' is not 'outs'", () => {
  assert.deepEqual(findGlossaryTerms("the sun outshone the moon"), []);
  assert.equal(findGlossaryTerms("you have 4 outs").length, 1);
});

test("case-insensitive, preserves original casing in the slice", () => {
  const text = "Equity matters here.";
  const found = findGlossaryTerms(text);
  assert.equal(found.length, 1);
  assert.equal(found[0].term, "equity");
  assert.equal(slice(text, found[0]), "Equity");
});

test("first occurrence per term only", () => {
  const text = "kicker now, kicker later";
  const found = findGlossaryTerms(text).filter(m => m.term === "kicker");
  assert.equal(found.length, 1);
  assert.equal(found[0].start, 0);
});

test("a phrase wins over a shorter term it overlaps", () => {
  const text = "You've got an open-ended straight draw here.";
  const found = findGlossaryTerms(text);
  const terms = found.map(m => m.term);
  assert.ok(terms.includes("open-ended straight draw"));
  // matches never overlap
  for (let i = 1; i < found.length; i++) {
    assert.ok(found[i].start >= found[i - 1].end, "matches must not overlap");
  }
});

test("returns matches sorted by position", () => {
  const text = "An overpair with the nuts potential and good equity.";
  const found = findGlossaryTerms(text);
  for (let i = 1; i < found.length; i++) {
    assert.ok(found[i].start > found[i - 1].start, "must be sorted ascending by start");
  }
});

test("no matches → empty array", () => {
  assert.deepEqual(findGlossaryTerms("nothing technical to see in this sentence"), []);
});

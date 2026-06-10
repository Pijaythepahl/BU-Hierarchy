import assert from "node:assert/strict";
import {
  computeConsistency,
  computeRanking,
  generatePairs,
  getNextPair,
  getProgress,
  pairCount,
  setComparison
} from "../src/ahp.js";

const people = ["Müller", "Meier", "Schulz"].map((name, index) => ({
  id: `p${index + 1}`,
  name,
  createdAt: "2026-06-10T00:00:00.000Z"
}));

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("pairCount uses n * (n - 1) / 2", () => {
  assert.equal(pairCount(0), 0);
  assert.equal(pairCount(1), 0);
  assert.equal(pairCount(2), 1);
  assert.equal(pairCount(8), 28);
  assert.equal(pairCount(12), 66);
});

test("generatePairs creates unordered pairs once", () => {
  const pairs = generatePairs(people);
  assert.equal(pairs.length, 3);
  assert.deepEqual(
    pairs.map((pair) => [pair.a.name, pair.b.name]),
    [
      ["Müller", "Meier"],
      ["Müller", "Schulz"],
      ["Meier", "Schulz"]
    ]
  );
});

test("computeRanking handles a clear preference", () => {
  const [pair] = generatePairs(people.slice(0, 2));
  const comparisons = setComparison({
    pair,
    winnerId: people[0].id,
    strength: 7
  });
  const result = computeRanking(people.slice(0, 2), comparisons);
  assert.equal(result.ranked[0].person.name, "Müller");
  assert.equal(result.progress.open, 0);
  assert.equal(result.isComplete, true);
});

test("tie keeps scores equal", () => {
  const [pair] = generatePairs(people.slice(0, 2));
  const comparisons = setComparison({
    pair,
    winnerId: "tie",
    strength: 7
  });
  const result = computeRanking(people.slice(0, 2), comparisons);
  assert.equal(result.ranked[0].score, result.ranked[1].score);
});

test("incomplete comparisons produce partial progress", () => {
  const [pair] = generatePairs(people);
  const comparisons = setComparison({
    pair,
    winnerId: people[1].id,
    strength: 3
  });
  const progress = getProgress(people, comparisons);
  assert.equal(progress.total, 3);
  assert.equal(progress.completed, 1);
  assert.equal(progress.open, 2);
  assert.equal(progress.percent, 33);
});

test("getNextPair returns the requested open active pair", () => {
  const pairs = generatePairs(people);
  const comparisons = setComparison({
    pair: pairs[0],
    winnerId: people[0].id,
    strength: 3
  });
  const active = getNextPair(people, comparisons, pairs[1].key);
  assert.equal(active.key, pairs[1].key);
});

test("ranking ignores comparisons for removed people", () => {
  const [pair] = generatePairs(people);
  const comparisons = setComparison({
    pair,
    winnerId: people[0].id,
    strength: 5
  });
  const remaining = people.slice(1);
  const result = computeRanking(remaining, comparisons);
  assert.equal(result.progress.completed, 0);
  assert.equal(result.ranked.length, 2);
});

test("consistency is good for a perfectly consistent 3-person matrix", () => {
  const pairs = generatePairs(people);
  let comparisons = {};
  comparisons = setComparison({ pair: pairs[0], winnerId: people[0].id, strength: 3, existing: comparisons });
  comparisons = setComparison({ pair: pairs[1], winnerId: people[0].id, strength: 9, existing: comparisons });
  comparisons = setComparison({ pair: pairs[2], winnerId: people[1].id, strength: 3, existing: comparisons });
  const consistency = computeConsistency(people, comparisons);
  assert.equal(consistency.available, true);
  assert.equal(consistency.status, "good");
  assert.ok(consistency.consistencyRatio < 0.01);
});

test("consistency asks for review on contradictory comparisons", () => {
  const pairs = generatePairs(people);
  let comparisons = {};
  comparisons = setComparison({ pair: pairs[0], winnerId: people[0].id, strength: 7, existing: comparisons });
  comparisons = setComparison({ pair: pairs[1], winnerId: people[2].id, strength: 7, existing: comparisons });
  comparisons = setComparison({ pair: pairs[2], winnerId: people[1].id, strength: 7, existing: comparisons });
  const consistency = computeConsistency(people, comparisons);
  assert.equal(consistency.available, true);
  assert.equal(consistency.status, "review");
  assert.ok(consistency.consistencyRatio > 0.2);
});

test("consistency is unavailable until comparisons are complete", () => {
  const [pair] = generatePairs(people);
  const comparisons = setComparison({
    pair,
    winnerId: people[0].id,
    strength: 3
  });
  const consistency = computeConsistency(people, comparisons);
  assert.equal(consistency.available, false);
  assert.equal(consistency.status, "pending");
});

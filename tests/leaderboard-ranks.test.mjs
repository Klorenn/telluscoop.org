import { test } from "node:test";
import assert from "node:assert/strict";
import { GAMING_RANKS, rankForPoints, nextRankForPoints } from "../tierly/ranks.mjs";

test("0 points is bronze division 1", () => {
  const rank = rankForPoints(0);
  assert.equal(rank.tierId, "bronze");
  assert.equal(rank.division, 1);
});

test("division boundaries are inclusive at the minimum", () => {
  assert.deepEqual([rankForPoints(169).tierId, rankForPoints(169).division], ["bronze", 1]);
  assert.deepEqual([rankForPoints(170).tierId, rankForPoints(170).division], ["bronze", 2]);
  assert.deepEqual([rankForPoints(340).tierId, rankForPoints(340).division], ["bronze", 3]);
});

test("tier boundaries land on division 1 of the next tier", () => {
  assert.deepEqual([rankForPoints(500).tierId, rankForPoints(500).division], ["silver", 1]);
  assert.deepEqual([rankForPoints(1000).tierId, rankForPoints(1000).division], ["gold", 1]);
  assert.deepEqual([rankForPoints(1700).tierId, rankForPoints(1700).division], ["platinum", 1]);
  assert.deepEqual([rankForPoints(3000).tierId, rankForPoints(3000).division], ["diamond", 1]);
});

test("diamond 3 is the ceiling — no next rank beyond it", () => {
  assert.equal(nextRankForPoints(4000), null);
  assert.equal(nextRankForPoints(99999), null);
});

test("next rank reports the immediate division above", () => {
  const next = nextRankForPoints(0);
  assert.equal(next.tierId, "bronze");
  assert.equal(next.division, 2);
  const nextTier = nextRankForPoints(340);
  assert.equal(nextTier.tierId, "silver");
  assert.equal(nextTier.division, 1);
});

test("ranks strictly escalate in points", () => {
  const mins = GAMING_RANKS.map((r) => r.min);
  for (let i = 1; i < mins.length; i++) {
    assert.ok(mins[i] > mins[i - 1], "thresholds must strictly increase");
  }
});

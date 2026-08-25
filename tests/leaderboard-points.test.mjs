import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePoints } from "../leaderboard/points.mjs";

test("1st place scores 10 points", () => {
  assert.equal(calculatePoints(1), 10);
});

test("2nd place scores 6 points", () => {
  assert.equal(calculatePoints(2), 6);
});

test("3rd place scores 3 points", () => {
  assert.equal(calculatePoints(3), 3);
});

test("any other placement scores 1 participation point", () => {
  assert.equal(calculatePoints(4), 1);
  assert.equal(calculatePoints(8), 1);
});

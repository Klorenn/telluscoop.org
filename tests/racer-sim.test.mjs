import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_REPLAY,
  createInitialState,
  simulateRun,
} from "../tierly/racer-sim.mjs";

test("same seed and canonical replay produce the frozen racer result", () => {
  assert.deepEqual(simulateRun(0x5eed1234, CANONICAL_REPLAY), {
    completed: true,
    lapCount: 3,
    checkpointIndex: 0,
    elapsedTicks: 4380,
    finishPosition: 2,
    bots: [
      { id: "bot-1", finishTicks: 4272 },
      { id: "bot-2", finishTicks: 4464 },
      { id: "bot-3", finishTicks: 4656 },
    ],
  });
});

test("simulation ignores no frame clock and rejects malformed replay transitions", () => {
  assert.throws(() => simulateRun(1, [{ tick: 0, input: 16 }]), /input mask/);
  assert.throws(() => simulateRun(1, [{ tick: -1, input: 1 }]), /tick/);
  assert.equal(Object.hasOwn(createInitialState(1), "now"), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_REPLAY,
  createInitialState,
  INPUT_BITS,
  MAX_TICKS,
  step,
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
  assert.throws(() => simulateRun(1, [{ tick: MAX_TICKS, input: 1 }]), /tick/);
  assert.equal(Object.hasOwn(createInitialState(1), "now"), false);
});

test("step crosses checkpoints in order and wraps after a completed lap", () => {
  let state = createInitialState(9);
  let previous = state.checkpointIndex;
  for (let i = 0; i < 4380; i += 1) {
    state = step(state, INPUT_BITS.ACCELERATE);
    assert.ok(state.checkpointIndex === previous || state.checkpointIndex === (previous + 1) % 4);
    previous = state.checkpointIndex;
  }
  assert.equal(state.lapCount, 3);
  assert.equal(state.checkpointIndex, 0);
});

test("step advances one checkpoint at a time and wraps the lap at the finish line", () => {
  const nearCheckpoint = {
    ...createInitialState(7),
    progress: 249_500,
    velocity: 0,
  };
  const crossedCheckpoint = step(nearCheckpoint, INPUT_BITS.ACCELERATE);
  assert.equal(crossedCheckpoint.lapCount, 0);
  assert.equal(crossedCheckpoint.checkpointIndex, 1);

  const nearLapWrap = {
    ...crossedCheckpoint,
    progress: 999_500,
    checkpointIndex: 3,
    lapCount: 0,
    velocity: 0,
  };
  const wrappedLap = step(nearLapWrap, INPUT_BITS.ACCELERATE);
  assert.equal(wrappedLap.lapCount, 1);
  assert.equal(wrappedLap.checkpointIndex, 0);
});

test("seed-derived bots and replay-derived ranking are deterministic", () => {
  const first = simulateRun(1, CANONICAL_REPLAY);
  const second = simulateRun(1, CANONICAL_REPLAY);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.bots, simulateRun(2, CANONICAL_REPLAY).bots);
  assert.notEqual(first.finishPosition, simulateRun(1, [{ tick: 0, input: 0 }]).finishPosition);
});

test("simulation keeps bot progress running after the player finishes and rank follows replay pace", () => {
  const canonical = simulateRun(0x5eed1234, CANONICAL_REPLAY);
  const delayed = simulateRun(0x5eed1234, [
    { tick: 0, input: INPUT_BITS.ACCELERATE },
    { tick: 4000, input: 0 },
    { tick: 4400, input: INPUT_BITS.ACCELERATE },
  ]);

  assert.deepEqual(canonical.bots, [
    { id: "bot-1", finishTicks: 4272 },
    { id: "bot-2", finishTicks: 4464 },
    { id: "bot-3", finishTicks: 4656 },
  ]);
  assert.equal(canonical.finishPosition, 2);
  assert.equal(delayed.completed, true);
  assert.equal(delayed.finishPosition, 3);
  assert.equal(delayed.bots[1].finishTicks, 4464);
});

import * as browserSimulation from "../../../tierly/racer-sim.mjs";
import {
  INPUT_BITS,
  MAX_TICKS,
  SIMULATION_VERSION,
  TICK_MS,
  TRACK_ID,
  simulateRun,
} from "./simulation.ts";

Deno.test("server simulation matches browser simulation for representative replay vectors", () => {
  assertDeepEquals(SIMULATION_VERSION, browserSimulation.SIMULATION_VERSION);
  assertDeepEquals(TRACK_ID, browserSimulation.TRACK_ID);
  assertDeepEquals(TICK_MS, browserSimulation.TICK_MS);
  assertDeepEquals(MAX_TICKS, browserSimulation.MAX_TICKS);
  assertDeepEquals(INPUT_BITS, browserSimulation.INPUT_BITS);

  const vectors = [
    { seed: 0x5eed1234, replay: browserSimulation.CANONICAL_REPLAY },
    { seed: 73, replay: [{ tick: 0, input: INPUT_BITS.ACCELERATE }, { tick: 320, input: INPUT_BITS.BRAKE }] },
    { seed: 987654, replay: [{ tick: 0, input: INPUT_BITS.ACCELERATE | INPUT_BITS.LEFT }, { tick: 1200, input: INPUT_BITS.ACCELERATE | INPUT_BITS.RIGHT }] },
    { seed: 42, replay: [{ tick: 0, input: INPUT_BITS.ACCELERATE }, { tick: 900, input: INPUT_BITS.ACCELERATE | INPUT_BITS.RIGHT }, { tick: 1800, input: INPUT_BITS.ACCELERATE }, { tick: 3600, input: 0 }] },
  ];

  for (const { seed, replay } of vectors) {
    assertDeepEquals(simulateRun(seed, replay), browserSimulation.simulateRun(seed, replay));
  }
});

function assertDeepEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

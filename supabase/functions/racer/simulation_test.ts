import { CANONICAL_REPLAY, CANONICAL_RESULT, simulateRun } from "./simulation.ts";

Deno.test("canonical browser vector has the same server result", () => {
  if (JSON.stringify(simulateRun(0x5eed1234, CANONICAL_REPLAY)) !== JSON.stringify(CANONICAL_RESULT)) {
    throw new Error("server simulation result must match the canonical browser vector");
  }
});

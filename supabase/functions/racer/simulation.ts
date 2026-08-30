export const SIMULATION_VERSION = "racer-v1";
export const TRACK_ID = "coastal-loop-v1";
export const TICK_MS = 16;
export const MAX_TICKS = 5400;
export const INPUT_BITS = Object.freeze({
  ACCELERATE: 1,
  BRAKE: 2,
  LEFT: 4,
  RIGHT: 8,
});

type Bot = {
  id: string;
  lane: number;
  pace: number;
  progress: number;
  finishTicks: number | null;
};

type State = {
  seed: number;
  tick: number;
  x: number;
  y: number;
  velocity: number;
  heading: number;
  progress: number;
  lapCount: number;
  checkpointIndex: number;
  finished: boolean;
  finishPosition: number | null;
  playerFinishTick: number | null;
  bots: Bot[];
};

type ReplayTransition = {
  tick: number;
  input: number;
};

type SimulationResult = {
  completed: boolean;
  lapCount: number;
  checkpointIndex: number;
  elapsedTicks: number;
  finishPosition: number | null;
  bots: Array<{ id: string; finishTicks: number | null }>;
};

const SCALE = 1000;
const TRACK_LENGTH = 1_000 * SCALE;
const TOTAL_PROGRESS = 3 * TRACK_LENGTH;
const CHECKPOINTS = [250_000, 500_000, 750_000, TRACK_LENGTH];
const VALID_INPUT_MASK = Object.values(INPUT_BITS).reduce((mask, bit) => mask | bit, 0);
const REFERENCE_SEED = 0x5eed1234 >>> 0;
const BOT_SALTS = [0x1020304, 0x11223344, 0x55667788];
const BOT_BASE_TICK = 4_272;
const BOT_TICK_SPACING = 192;
const BOT_VARIANCE_STEP = 24;
const TURN_STEP = 1_500;
const MAX_HEADING = 45_000;

function nextRandom(value: number): number {
  let next = value >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPaceBucket(seed: number, index: number): number {
  return nextRandom((seed >>> 0) ^ BOT_SALTS[index]) % 5;
}

const REFERENCE_PACE_BUCKETS = BOT_SALTS.map((_, index) => getPaceBucket(REFERENCE_SEED, index));

function createBot(seed: number, index: number): Bot {
  const random = nextRandom((seed >>> 0) ^ BOT_SALTS[index]);
  const lane = (random % 3) - 1;
  const variance = (getPaceBucket(seed, index) - REFERENCE_PACE_BUCKETS[index]) * BOT_VARIANCE_STEP;
  const targetTicks = BOT_BASE_TICK + index * BOT_TICK_SPACING + variance;
  const pace = Math.ceil(TOTAL_PROGRESS / targetTicks);

  return {
    id: `bot-${index + 1}`,
    lane,
    pace,
    progress: TOTAL_PROGRESS - pace * targetTicks,
    finishTicks: null,
  };
}

function advanceBots(bots: Bot[], nextTick: number): Bot[] {
  return bots.map((bot) => {
    if (bot.finishTicks !== null) {
      return bot;
    }
    const progress = bot.progress + bot.pace;
    return {
      ...bot,
      progress,
      finishTicks: progress >= TOTAL_PROGRESS ? nextTick : null,
    };
  });
}

function advancePlayer(state: State, inputMask: number): State {
  if (state.finished) {
    return {
      ...state,
      x: state.progress % TRACK_LENGTH,
    };
  }

  const accelerating = (inputMask & INPUT_BITS.ACCELERATE) !== 0;
  const braking = (inputMask & INPUT_BITS.BRAKE) !== 0;
  const turn = ((inputMask & INPUT_BITS.RIGHT) !== 0 ? 1 : 0) - ((inputMask & INPUT_BITS.LEFT) !== 0 ? 1 : 0);
  const targetVelocity = accelerating ? 685 : 500;
  const velocity = braking ? Math.max(0, state.velocity - 80) : targetVelocity;
  // Heading is stored as signed millidegrees so lateral drift remains fixed-point and deterministic.
  const heading = clamp(state.heading + turn * TURN_STEP, -MAX_HEADING, MAX_HEADING);
  const progress = state.progress + velocity;
  const lateralVelocity = Math.trunc((heading * velocity) / 90_000);
  const next = {
    ...state,
    velocity,
    heading,
    x: progress % TRACK_LENGTH,
    y: state.y + lateralVelocity,
    progress,
  };

  while (
    next.checkpointIndex < CHECKPOINTS.length &&
    progress >= (next.lapCount * TRACK_LENGTH) + CHECKPOINTS[next.checkpointIndex]
  ) {
    next.checkpointIndex += 1;
    if (next.checkpointIndex === CHECKPOINTS.length) {
      next.lapCount += 1;
      next.checkpointIndex = 0;
    }
  }

  if (next.lapCount >= 3) {
    next.lapCount = 3;
    next.finished = true;
  }

  return next;
}

export function createInitialState(seed: number): State {
  if (!Number.isInteger(seed)) throw new TypeError("seed must be an integer");
  const bots = BOT_SALTS.map((_, index) => createBot(seed, index));
  return {
    seed: seed >>> 0,
    tick: 0,
    x: 0,
    y: 0,
    velocity: 0,
    heading: 0,
    progress: 0,
    lapCount: 0,
    checkpointIndex: 0,
    finished: false,
    finishPosition: null,
    playerFinishTick: null,
    bots,
  };
}

export function step(state: State, inputMask: number): State {
  if (!Number.isInteger(inputMask) || inputMask < 0 || (inputMask & ~VALID_INPUT_MASK) !== 0) {
    throw new TypeError("input mask must contain only known bits");
  }
  const nextTick = state.tick + 1;
  const player = advancePlayer(state, inputMask);
  const bots = advanceBots(player.bots, nextTick);
  const next = {
    ...player,
    tick: nextTick,
    bots,
  };

  if (next.playerFinishTick === null && next.finished) {
    next.playerFinishTick = nextTick;
    next.finishPosition = 1 + next.bots.filter((bot) => bot.finishTicks !== null && bot.finishTicks < nextTick).length;
  }
  return next;
}

function validateReplay(replay: readonly ReplayTransition[]): void {
  if (!Array.isArray(replay)) throw new TypeError("replay must be an array");
  let previousTick = -1;
  for (const transition of replay) {
    if (!transition || !Number.isInteger(transition.tick) || transition.tick < 0 || transition.tick >= MAX_TICKS || transition.tick <= previousTick) {
      throw new TypeError("replay transition tick must be strictly increasing, non-negative, and below MAX_TICKS");
    }
    if (!Number.isInteger(transition.input) || transition.input < 0 || (transition.input & ~VALID_INPUT_MASK) !== 0) {
      throw new TypeError("replay transition input mask is invalid");
    }
    previousTick = transition.tick;
  }
}

export function simulateRun(seed: number, replay: readonly ReplayTransition[]): SimulationResult {
  validateReplay(replay);
  let state = createInitialState(seed);
  let input = 0;
  let transitionIndex = 0;
  for (let tick = 0; tick < MAX_TICKS; tick += 1) {
    if (transitionIndex < replay.length && replay[transitionIndex].tick === tick) {
      input = replay[transitionIndex].input;
      transitionIndex += 1;
    }
    state = step(state, input);
  }
  const bots = state.bots.map(({ id, finishTicks }) => ({ id, finishTicks }));
  return {
    completed: state.playerFinishTick !== null,
    lapCount: state.lapCount,
    checkpointIndex: state.checkpointIndex,
    elapsedTicks: state.playerFinishTick ?? MAX_TICKS,
    finishPosition: state.playerFinishTick === null ? null : state.finishPosition,
    bots,
  };
}

export const CANONICAL_REPLAY: readonly ReplayTransition[] = Object.freeze([
  { tick: 0, input: INPUT_BITS.ACCELERATE },
]);

export const CANONICAL_RESULT: SimulationResult = Object.freeze({
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

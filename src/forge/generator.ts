/**
 * Level generator - the "ownership" piece.
 *
 * Given a difficulty (and optional structural overrides) it:
 *   1. Derives parameters from the difficulty curve.
 *   2. Builds customers across the variety set.
 *   3. Builds the exact plate pool (sum of demands).
 *   4. Arranges plates into lanes using weighted run-lengths, biased by the learned
 *      "brain" (run-length mixes that historically produced good solvable levels).
 *   5. Runs many Monte Carlo simulations + exact/policy solves over candidate
 *      arrangements, keeping only SOLVABLE ones and picking the best fit.
 *   6. Records the outcome back into the brain so the forge gets smarter each run.
 *
 * `generateLevelAsync` exposes live progress (simulation counts, phase text) and
 * yields to the UI between batches. `generateLevel` is the synchronous convenience.
 */

import {
  DishLetter,
  DISH_LETTERS,
  ForgeCustomer,
  ForgeLevel,
  ForgeParams,
  MovePlanStep,
  SimResult,
} from './types';
import {
  paramsForDifficulty,
  demandForDifficulty,
  computeDifficultyIndex,
  CALIBRATED_NAIVE_WIN_RATE,
} from './difficulty';
import { encodeLevel } from './codec';
import { solveLevel } from './solver';
import { LevelDef } from './simulator';
import { winRate, policySolve } from './policies';
import {
  ForgeBrain,
  loadBrain,
  applyBias,
  recordOutcome,
  runLengthHistogram,
  intelligenceLevel,
} from './learn';

/** Deterministic seeded RNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Base run-length weights shift toward singles/triples as difficulty rises. */
function runLengthWeights(difficulty: number): Record<number, number> {
  const t = (Math.max(1, Math.min(10, difficulty)) - 1) / 9;
  return {
    1: 0.05 + 0.25 * t,
    2: 0.75 - 0.4 * t,
    3: 0.12 + 0.05 * t,
    4: 0.06 + 0.07 * t,
    5: 0.02 + 0.03 * t,
  };
}

function sampleRunLength(weights: Record<number, number>, rng: () => number): number {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const sizeStr of Object.keys(weights)) {
    const size = Number(sizeStr);
    r -= weights[size];
    if (r <= 0) return size;
  }
  return 2;
}

function buildCustomers(params: ForgeParams, difficulty: number, rng: () => number): ForgeCustomer[] {
  const letters = DISH_LETTERS.slice(0, params.numVarieties);
  const baseDemand = demandForDifficulty(difficulty);
  const customers: ForgeCustomer[] = [];
  for (let i = 0; i < params.numCustomers; i++) {
    const dish = letters[i % letters.length] as DishLetter;
    const jitter = difficulty >= 5 ? Math.round((rng() - 0.5) * 2) : 0;
    const demand = Math.max(3, baseDemand + jitter);
    customers.push({ dish, demand });
  }
  return customers;
}

function buildPool(customers: ForgeCustomer[]): DishLetter[] {
  const pool: DishLetter[] = [];
  for (const c of customers) {
    for (let i = 0; i < c.demand; i++) pool.push(c.dish);
  }
  return pool;
}

/** Arrange a plate pool into lanes using (possibly learned) run-length weights. */
function arrangeQueues(
  pool: DishLetter[],
  numQueues: number,
  weights: Record<number, number>,
  rng: () => number,
): DishLetter[][] {
  const remaining = [...pool];
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  const blocks: DishLetter[][] = [];
  while (remaining.length > 0) {
    const dish = remaining.shift()!;
    const want = sampleRunLength(weights, rng);
    const block: DishLetter[] = [dish];
    for (let k = 1; k < want; k++) {
      const idx = remaining.findIndex((d) => d === dish);
      if (idx === -1) break;
      remaining.splice(idx, 1);
      block.push(dish);
    }
    blocks.push(block);
  }

  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }
  const queues: DishLetter[][] = Array.from({ length: numQueues }, () => []);
  blocks.forEach((block, idx) => {
    queues[idx % numQueues].push(...block);
  });
  return queues;
}

/** Guaranteed-solvable construction (insurance): plates grouped by customer arrival order. */
function constructiveQueues(customers: ForgeCustomer[], numQueues: number): DishLetter[][] {
  const queues: DishLetter[][] = Array.from({ length: numQueues }, () => []);
  customers.forEach((c, i) => {
    const block = Array.from({ length: c.demand }, () => c.dish);
    queues[i % numQueues].push(...block);
  });
  return queues;
}

/** Build an approximate SimResult from a winning policy playout (capped exact search). */
function approxSimFromPlayout(
  moves: MovePlanStep[],
  bufferPeak: number,
  naive: number,
): SimResult {
  const renum = moves.map((m, i) => ({ ...m, index: i + 1 }));
  const lastTick = renum.length ? renum[renum.length - 1].tick : 0;
  return {
    solvable: true,
    movePlan: renum,
    totalMoves: renum.length,
    mcr: 0.22,
    failChance: 1 - naive,
    criticalMoves: 0,
    bufferPeak,
    completionTicks: lastTick,
    difficultyIndex: 0,
    naiveWinRate: naive,
    approxSolve: true,
  };
}

let levelCounter = 0;

export interface GenerateOptions {
  seed?: number;
  candidates?: number;
  overrides?: Partial<ForgeParams>;
  /** Total Monte Carlo playout budget (for the async generator). */
  simBudget?: number;
}

export interface GenProgress {
  phase: 'init' | 'searching' | 'validating' | 'optimizing' | 'finalizing' | 'done';
  message: string;
  simsDone: number;
  simBudget: number;
  candidate: number;
  candidates: number;
  solvableFound: number;
  bestGap: number | null;
  intelligence: number;
}

const delay = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

interface CandidateResult {
  queues: DishLetter[][];
  sim: SimResult;
  gap: number;
}

/**
 * Async, observable generator. Runs up to a simulation budget of Monte Carlo playouts
 * across candidate arrangements, keeps only solvable candidates, learns from the result,
 * and always returns a solvable level.
 */
export async function generateLevelAsync(
  difficulty: number,
  opts: GenerateOptions = {},
  onProgress?: (p: GenProgress) => void,
): Promise<ForgeLevel> {
  const seed = opts.seed ?? (Date.now() ^ (levelCounter++ << 16)) >>> 0;
  const rng = mulberry32(seed);
  const params = paramsForDifficulty(difficulty, opts.overrides);
  const customers = buildCustomers(params, difficulty, rng);
  const pool = buildPool(customers);

  const brain = loadBrain();
  const intelligence = intelligenceLevel(brain);
  const baseWeights = runLengthWeights(difficulty);
  const learnedWeights = applyBias(baseWeights, brain, difficulty);
  const targetNaive = CALIBRATED_NAIVE_WIN_RATE[Math.max(1, Math.min(10, Math.round(difficulty))) - 1];

  const simBudget = opts.simBudget ?? 1000;
  const maxCandidates = opts.candidates ?? 120;
  const naiveRunsPerCandidate = 10;

  let simsDone = 0;
  let solvableFound = 0;
  let best: CandidateResult | null = null;

  const report = (phase: GenProgress['phase'], message: string, candidate: number) =>
    onProgress?.({
      phase,
      message,
      simsDone,
      simBudget,
      candidate,
      candidates: maxCandidates,
      solvableFound,
      bestGap: best ? best.gap : null,
      intelligence,
    });

  report('init', `Booting forge brain (intelligence Lv.${intelligence}) · target MCR ${params.targetMCR.toFixed(2)}`, 0);
  await delay(20);

  for (let c = 0; c < maxCandidates && simsDone < simBudget; c++) {
    // Slight exploration jitter so we don't collapse onto one strategy.
    const jittered: Record<number, number> = {};
    for (const k of Object.keys(learnedWeights)) {
      const n = Number(k);
      jittered[n] = Math.max(0.001, learnedWeights[n] * (0.8 + rng() * 0.4));
    }
    const queues = arrangeQueues(pool, params.numQueues, jittered, rng);
    const level: LevelDef = { queues, customers, numSeats: params.numSeats };

    report('searching', `Simulation ${c + 1}/${maxCandidates} · arranging & solving queue structure`, c + 1);

    let sim = solveLevel(level, { maxStates: 45_000 });
    let solvable = sim.solvable;

    // Capped exact search that couldn't prove a win: try strong policies before discarding.
    if (!solvable && sim.approxSolve) {
      report('validating', `Simulation ${c + 1}/${maxCandidates} · deep search capped, validating with lookahead AI`, c + 1);
      const ps = policySolve(level, rng);
      simsDone += 2;
      if (ps.solvable) {
        const wr = winRate(level, 'random', naiveRunsPerCandidate, rng);
        simsDone += wr.runs;
        sim = approxSimFromPlayout(ps.moves, ps.bufferPeak, wr.rate);
        solvable = true;
      }
    } else if (solvable) {
      const wr = winRate(level, 'random', naiveRunsPerCandidate, rng);
      simsDone += wr.runs;
      sim.naiveWinRate = wr.rate;
    }

    if (!solvable) {
      await delay(0);
      continue;
    }

    solvableFound++;
    // Selection: exact levels by MCR gap; approx levels by empirical naive-win-rate gap.
    const gap = sim.approxSolve
      ? Math.abs((sim.naiveWinRate ?? 0) - targetNaive) + 0.06
      : Math.abs(sim.mcr - params.targetMCR);

    if (best === null || gap < best.gap) {
      best = { queues, sim, gap };
      report('optimizing', `Found solvable level · ${solvableFound} so far · best gap ${gap.toFixed(3)}`, c + 1);
    }

    if (best.gap < 0.04 && solvableFound >= 3) break; // good enough
    await delay(0);
  }

  // Insurance: nothing solvable sampled -> constructive guaranteed-solvable arrangement.
  if (best === null) {
    report('validating', 'No solvable sample found — constructing a guaranteed-solvable layout', maxCandidates);
    const queues = constructiveQueues(customers, params.numQueues);
    const level: LevelDef = { queues, customers, numSeats: params.numSeats };
    let sim = solveLevel(level, { maxStates: 200_000 });
    if (!sim.solvable) {
      const ps = policySolve(level, rng);
      simsDone += 2;
      const wr = winRate(level, 'random', naiveRunsPerCandidate, rng);
      simsDone += wr.runs;
      sim = approxSimFromPlayout(ps.moves, ps.bufferPeak, wr.rate);
    }
    best = { queues, sim, gap: 0 };
    solvableFound++;
  }

  report('finalizing', 'Locking optimal move plan & rating', maxCandidates);
  await delay(10);

  const sim = best.sim;
  sim.simRuns = simsDone;
  sim.difficultyIndex = computeDifficultyIndex(sim, params);

  // Train: reinforce the brain toward this solvable arrangement.
  const updated = recordOutcome(brain, {
    difficulty,
    solvable: true,
    mcrGap: best.gap,
    histogram: runLengthHistogram(best.queues),
    simRuns: simsDone,
  });

  const finalLevel = finalize(best.queues, customers, params, difficulty, seed, sim);
  report('done', `Done · ${simsDone} simulations · ${solvableFound} solvable · brain now Lv.${intelligenceLevel(updated)}`, maxCandidates);
  return finalLevel;
}

/** Synchronous convenience (no progress UI); uses a smaller budget. */
export function generateLevel(difficulty: number, opts: GenerateOptions = {}): ForgeLevel {
  const seed = opts.seed ?? (Date.now() ^ (levelCounter++ << 16)) >>> 0;
  const rng = mulberry32(seed);
  const params = paramsForDifficulty(difficulty, opts.overrides);
  const customers = buildCustomers(params, difficulty, rng);
  const pool = buildPool(customers);
  const weights = runLengthWeights(difficulty);
  const candidates = opts.candidates ?? 26;

  let best: CandidateResult | null = null;
  for (let c = 0; c < candidates; c++) {
    const queues = arrangeQueues(pool, params.numQueues, weights, rng);
    const level: LevelDef = { queues, customers, numSeats: params.numSeats };
    let sim = solveLevel(level, { maxStates: 90_000 });
    if (!sim.solvable && sim.approxSolve) {
      const ps = policySolve(level, rng);
      if (ps.solvable) sim = approxSimFromPlayout(ps.moves, ps.bufferPeak, 0.1);
    }
    if (!sim.solvable) continue;
    const gap = Math.abs(sim.mcr - params.targetMCR);
    if (best === null || gap < best.gap) best = { queues, sim, gap };
    if (gap < 0.04) break;
  }

  if (best === null) {
    const queues = constructiveQueues(customers, params.numQueues);
    const level: LevelDef = { queues, customers, numSeats: params.numSeats };
    let sim = solveLevel(level, { maxStates: 200_000 });
    if (!sim.solvable) {
      const ps = policySolve(level, rng);
      sim = approxSimFromPlayout(ps.moves, ps.bufferPeak, 0.1);
    }
    best = { queues, sim, gap: 0 };
  }

  const sim = best.sim;
  sim.difficultyIndex = computeDifficultyIndex(sim, params);
  return finalize(best.queues, customers, params, difficulty, seed, sim);
}

function finalize(
  queues: DishLetter[][],
  customers: ForgeCustomer[],
  params: ForgeParams,
  difficulty: number,
  seed: number,
  sim: SimResult,
): ForgeLevel {
  const now = new Date().toISOString();
  return {
    id: `kzl-${seed.toString(36)}-${Date.now().toString(36)}`,
    name: defaultName(difficulty, seed),
    createdAt: now,
    updatedAt: now,
    difficulty: params.difficulty,
    params,
    customers,
    queues,
    encoding: encodeLevel(queues, customers, params.numSeats),
    sim,
  };
}

/** Re-simulate + re-rate a level after manual edits. Returns a new level object. */
export function regenerateSim(level: ForgeLevel): ForgeLevel {
  const def: LevelDef = {
    queues: level.queues,
    customers: level.customers,
    numSeats: level.params.numSeats,
  };
  let sim = solveLevel(def, { maxStates: 140_000 });
  if (!sim.solvable && sim.approxSolve) {
    const ps = policySolve(def, mulberry32(1));
    if (ps.solvable) sim = approxSimFromPlayout(ps.moves, ps.bufferPeak, 0.1);
  }
  sim.difficultyIndex = computeDifficultyIndex(sim, level.params);
  return {
    ...level,
    sim,
    encoding: encodeLevel(level.queues, level.customers, level.params.numSeats),
    updatedAt: new Date().toISOString(),
  };
}

export function currentIntelligence(): number {
  return intelligenceLevel(loadBrain());
}

export function getBrain(): ForgeBrain {
  return loadBrain();
}

const NAME_ADJ = [
  'Crimson', 'Amber', 'Jade', 'Golden', 'Azure', 'Violet', 'Coral', 'Onyx', 'Pearl', 'Ember',
];
const NAME_NOUN = [
  'Cascade', 'Rush', 'Drift', 'Tempest', 'Current', 'Spiral', 'Gauntlet', 'Run', 'Tide', 'Storm',
];

function defaultName(difficulty: number, seed: number): string {
  // Use unsigned shifts so indices are always valid (fixes "undefined" names).
  const a = NAME_ADJ[(seed >>> 0) % NAME_ADJ.length];
  const n = NAME_NOUN[(seed >>> 4) % NAME_NOUN.length];
  return `${a} ${n} (D${Math.round(difficulty)})`;
}

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
 * `runGeneration` is the synchronous core (run inside a Web Worker via forgeClient).
 * It scouts ~1000 cheap Monte Carlo playouts across candidates, shortlists the best
 * solvable ones, exact-verifies the shortlist, and returns the single best level plus
 * the reinforced brain. It accepts a `shouldStop` hook for time budget / cancellation.
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

function buildCustomers(
  params: ForgeParams,
  difficulty: number,
  rng: () => number,
  demandOverride?: number,
): ForgeCustomer[] {
  const letters = DISH_LETTERS.slice(0, params.numVarieties);
  const baseDemand = demandOverride ?? demandForDifficulty(difficulty);
  const customers: ForgeCustomer[] = [];
  for (let i = 0; i < params.numCustomers; i++) {
    const dish = letters[i % letters.length] as DishLetter;
    // Explicit demand (campaign) is fixed; auto demand jitters from D5 up.
    const jitter = demandOverride == null && difficulty >= 5 ? Math.round((rng() - 0.5) * 2) : 0;
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
  /** Fixed demand per customer (campaign use). When omitted, demand is derived from difficulty. */
  demand?: number;
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

interface ScoutCtx {
  params: ForgeParams;
  customers: ForgeCustomer[];
  pool: DishLetter[];
  learnedWeights: Record<number, number>;
  targetNaive: number;
}

interface ShortlistEntry {
  queues: DishLetter[][];
  naive: number;
  gap: number;
}

/** One cheap scout: arrange a candidate, prove solvable via strong policy, estimate felt difficulty. */
function scoutCandidate(
  ctx: ScoutCtx,
  rng: () => number,
): { queues: DishLetter[][]; solvable: boolean; naive: number; sims: number } {
  const jittered: Record<number, number> = {};
  for (const k of Object.keys(ctx.learnedWeights)) {
    const n = Number(k);
    jittered[n] = Math.max(0.001, ctx.learnedWeights[n] * (0.8 + rng() * 0.4));
  }
  const queues = arrangeQueues(ctx.pool, ctx.params.numQueues, jittered, rng);
  const level: LevelDef = { queues, customers: ctx.customers, numSeats: ctx.params.numSeats };

  const ps = policySolve(level, rng); // strong (lookahead/greedy) solvability check
  let sims = 3; // ~cost of the policy probe
  let naive = 0;
  if (ps.solvable) {
    const wr = winRate(level, 'random', 8, rng);
    sims += wr.runs;
    naive = wr.rate;
  }
  return { queues, solvable: ps.solvable, naive, sims };
}

/** Exact-verify a shortlisted candidate to get a real move plan + MCR (approx fallback if capped). */
function verifyCandidate(
  queues: DishLetter[][],
  ctx: ScoutCtx,
  naive: number,
  rng: () => number,
): SimResult {
  const level: LevelDef = { queues, customers: ctx.customers, numSeats: ctx.params.numSeats };
  let sim = solveLevel(level, { maxStates: 60_000 });
  if (!sim.solvable) {
    const ps = policySolve(level, rng);
    if (ps.solvable) sim = approxSimFromPlayout(ps.moves, ps.bufferPeak, naive);
  } else if (sim.naiveWinRate == null) {
    sim.naiveWinRate = naive;
  }
  return sim;
}

/**
 * The intelligent generation core (synchronous; runs in a Web Worker).
 *
 * Phase 1 — SCOUT: run ~`simBudget` cheap Monte Carlo playouts across many candidate
 *   arrangements, keeping a top-K shortlist of the solvable ones whose felt-difficulty
 *   (naive win-rate) best matches the target.
 * Phase 2 — VERIFY: exact-solve only the shortlist (a handful), producing real move
 *   plans + MCR, and pick the single best.
 * Phase 3 — INSURANCE: if nothing verified, construct a guaranteed-solvable layout.
 *
 * `shouldStop()` lets the caller enforce a wall-clock budget or cancellation. Always
 * returns a solvable level plus the reinforced brain (to be persisted by the caller).
 */
export function runGeneration(
  difficulty: number,
  opts: GenerateOptions,
  brain: ForgeBrain,
  onProgress?: (p: GenProgress) => void,
  shouldStop?: () => boolean,
): { level: ForgeLevel; brain: ForgeBrain } {
  const seed = opts.seed ?? (Date.now() ^ (levelCounter++ << 16)) >>> 0;
  const rng = mulberry32(seed);
  const params = paramsForDifficulty(difficulty, opts.overrides);
  const customers = buildCustomers(params, difficulty, rng, opts.demand);
  const pool = buildPool(customers);

  const intelligence = intelligenceLevel(brain);
  const learnedWeights = applyBias(runLengthWeights(difficulty), brain, difficulty);
  const targetNaive = CALIBRATED_NAIVE_WIN_RATE[Math.max(1, Math.min(10, Math.round(difficulty))) - 1];
  const ctx: ScoutCtx = { params, customers, pool, learnedWeights, targetNaive };

  const simBudget = opts.simBudget ?? 1000;
  const maxCandidates = opts.candidates ?? 240;
  const K = 6;

  let simsDone = 0;
  let solvableFound = 0;
  let candidate = 0;
  const shortlist: ShortlistEntry[] = [];

  const report = (phase: GenProgress['phase'], message: string) =>
    onProgress?.({
      phase,
      message,
      simsDone,
      simBudget,
      candidate,
      candidates: maxCandidates,
      solvableFound,
      bestGap: shortlist.length ? shortlist[0].gap : null,
      intelligence,
    });

  report('init', `Booting forge brain (Lv.${intelligence}) · target naive-win ${Math.round(targetNaive * 100)}% · ${simBudget}-sim search`);

  // Phase 1: scout.
  for (candidate = 1; candidate <= maxCandidates && simsDone < simBudget; candidate++) {
    if (shouldStop?.()) break;
    const sc = scoutCandidate(ctx, rng);
    simsDone += sc.sims;

    if (sc.solvable) {
      solvableFound++;
      const gap = Math.abs(sc.naive - targetNaive);
      shortlist.push({ queues: sc.queues, naive: sc.naive, gap });
      shortlist.sort((a, b) => a.gap - b.gap);
      if (shortlist.length > K) shortlist.length = K;
      report(
        'optimizing',
        `Simulation ${simsDone}/${simBudget} · solvable ✓ (naive ${Math.round(sc.naive * 100)}%) · ${solvableFound} found · best gap ${shortlist[0].gap.toFixed(3)}`,
      );
    } else {
      report('searching', `Simulation ${simsDone}/${simBudget} · candidate ${candidate} unsolvable ✗ · arranging next queue structure`);
    }
  }

  // Phase 2: verify the shortlist with the exact solver, pick the best.
  let best: { queues: DishLetter[][]; sim: SimResult; gap: number } | null = null;
  for (let i = 0; i < shortlist.length; i++) {
    if (shouldStop?.()) break;
    report('validating', `Verifying shortlisted level ${i + 1}/${shortlist.length} with exact solver`);
    const cand = shortlist[i];
    const sim = verifyCandidate(cand.queues, ctx, cand.naive, rng);
    if (!sim.solvable) continue;
    const naive = sim.naiveWinRate ?? cand.naive;
    const gap = Math.abs(naive - targetNaive) * 0.6 + Math.abs(sim.mcr - params.targetMCR) * 0.4;
    if (best === null || gap < best.gap) best = { queues: cand.queues, sim, gap };
  }

  // Phase 3: insurance — guaranteed-solvable construction.
  if (best === null) {
    report('validating', 'No verified candidate — constructing a guaranteed-solvable layout');
    const queues = constructiveQueues(customers, params.numQueues);
    const sim = verifyCandidate(queues, ctx, 0.05, rng);
    best = { queues, sim, gap: 0 };
    solvableFound++;
  }

  report('finalizing', 'Locking optimal move plan & difficulty rating');

  const sim = best.sim;
  sim.simRuns = simsDone;
  sim.difficultyIndex = computeDifficultyIndex(sim, params);

  // Reinforce the brain toward this winning arrangement.
  const updated = recordOutcome(brain, {
    difficulty,
    solvable: true,
    mcrGap: Math.abs(sim.mcr - params.targetMCR),
    histogram: runLengthHistogram(best.queues),
    simRuns: simsDone,
  });

  const level = finalize(best.queues, customers, params, difficulty, seed, sim);
  report('done', `Done · ${simsDone} simulations · ${solvableFound} solvable · brain now Lv.${intelligenceLevel(updated)}`);
  return { level, brain: updated };
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

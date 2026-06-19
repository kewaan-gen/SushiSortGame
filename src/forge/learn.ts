/**
 * Forge "training" memory.
 *
 * The generator samples queue arrangements using run-length weights. This module
 * remembers which run-length mixes historically produced *solvable* levels closest
 * to the difficulty's target MCR, and nudges future sampling toward them. Every
 * generation run updates the memory, so the forge gets measurably smarter (faster to
 * find good solvable levels) the more you use it.
 *
 * Persisted to localStorage so knowledge accumulates across sessions. It can also be
 * seeded from the offline Python trainer (calibrated_constants.json -> learnedWeights).
 */

const LS_KEY = 'kaizen_forge_brain_v1';
const RUN_LENGTHS = [1, 2, 3, 4, 5];
const LR = 0.18; // learning rate for the log-space weight bias

export interface DifficultyBrain {
  /** Log-space additive bias per run length (applied on top of the base curve). */
  bias: Record<number, number>;
  runs: number;
  solvableFound: number;
  bestMcrGap: number;
  /** Total Monte Carlo playouts attributed to this difficulty. */
  totalSims: number;
}

export interface ForgeBrain {
  version: number;
  totalRuns: number;
  totalSims: number;
  byDifficulty: Record<number, DifficultyBrain>;
}

function emptyDifficulty(): DifficultyBrain {
  return {
    bias: Object.fromEntries(RUN_LENGTHS.map((r) => [r, 0])),
    runs: 0,
    solvableFound: 0,
    bestMcrGap: 1,
    totalSims: 0,
  };
}

export function loadBrain(): ForgeBrain {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as ForgeBrain;
  } catch {
    /* ignore */
  }
  return { version: 1, totalRuns: 0, totalSims: 0, byDifficulty: {} };
}

function saveBrain(brain: ForgeBrain): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(brain));
  } catch {
    /* ignore quota */
  }
}

export function brainForDifficulty(brain: ForgeBrain, difficulty: number): DifficultyBrain {
  const D = Math.round(difficulty);
  if (!brain.byDifficulty[D]) brain.byDifficulty[D] = emptyDifficulty();
  return brain.byDifficulty[D];
}

/**
 * Intelligence level: a human-friendly 1..100 that grows (log) with total runs.
 * Pure cosmetic/feedback signal that the brain is learning.
 */
export function intelligenceLevel(brain: ForgeBrain): number {
  if (brain.totalRuns <= 0) return 1;
  return Math.min(100, Math.round(1 + 14 * Math.log2(1 + brain.totalRuns)));
}

/** Apply the learned bias to a base run-length weight set (multiplicative in log space). */
export function applyBias(
  base: Record<number, number>,
  brain: ForgeBrain,
  difficulty: number,
): Record<number, number> {
  const db = brainForDifficulty(brain, difficulty);
  const out: Record<number, number> = {};
  for (const r of RUN_LENGTHS) {
    const b = db.bias[r] ?? 0;
    out[r] = Math.max(0.001, (base[r] ?? 0) * Math.exp(b));
  }
  return out;
}

/** Normalised run-length histogram of an arrangement (fraction of runs of each length). */
export function runLengthHistogram(queues: string[][]): Record<number, number> {
  const counts: Record<number, number> = Object.fromEntries(RUN_LENGTHS.map((r) => [r, 0]));
  let total = 0;
  for (const lane of queues) {
    let i = 0;
    while (i < lane.length) {
      let j = i + 1;
      while (j < lane.length && lane[j] === lane[i]) j++;
      const len = Math.min(5, j - i);
      counts[len] = (counts[len] ?? 0) + 1;
      total++;
      i = j;
    }
  }
  if (total === 0) return counts;
  for (const r of RUN_LENGTHS) counts[r] /= total;
  return counts;
}

export interface OutcomeReport {
  difficulty: number;
  solvable: boolean;
  mcrGap: number;
  /** Run-length histogram of the winning arrangement (reinforce toward this). */
  histogram: Record<number, number>;
  simRuns: number;
}

/**
 * Reinforce: nudge the difficulty's bias toward the histogram of a good solvable level.
 * Better levels (smaller mcrGap) get a stronger pull. Returns the updated brain (saved).
 */
export function recordOutcome(brain: ForgeBrain, report: OutcomeReport): ForgeBrain {
  const db = brainForDifficulty(brain, report.difficulty);
  db.runs += 1;
  db.totalSims += report.simRuns;
  brain.totalRuns += 1;
  brain.totalSims += report.simRuns;

  if (report.solvable) {
    db.solvableFound += 1;
    db.bestMcrGap = Math.min(db.bestMcrGap, report.mcrGap);
    // Pull strength: stronger when the level closely hit the target MCR.
    const strength = LR * (1 - Math.min(1, report.mcrGap / 0.5));
    // Move bias toward log of the realised histogram (favoured run lengths gain weight).
    for (const r of RUN_LENGTHS) {
      const target = Math.log(Math.max(0.02, report.histogram[r] ?? 0));
      db.bias[r] = (db.bias[r] ?? 0) + strength * (target - (db.bias[r] ?? 0)) * 0.25;
      // Clamp to keep things stable.
      db.bias[r] = Math.max(-1.2, Math.min(1.2, db.bias[r]));
    }
  }

  saveBrain(brain);
  return brain;
}

/** Reset all learned knowledge (for debugging / fresh start). */
export function resetBrain(): ForgeBrain {
  const fresh: ForgeBrain = { version: 1, totalRuns: 0, totalSims: 0, byDifficulty: {} };
  saveBrain(fresh);
  return fresh;
}

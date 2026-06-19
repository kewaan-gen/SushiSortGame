/**
 * Difficulty curve + rating.
 *
 * Grounded in flow-channel theory (gentle early rise via sqrt, oscillation across a
 * campaign) and puzzle-difficulty literature (solver metrics: solution length,
 * winning-path rarity, forced moves, search effort). Constants here are the defaults;
 * the Python lab in tools/forge_lab can re-tune them and emit calibrated_constants.json.
 */

import { ForgeParams, SimResult, DifficultyRating } from './types';

/** Target move-constraint ratio per difficulty (lower = harder). Realistic for 3-5 lanes. */
export const TARGET_MCR: number[] = [
  1.0, 0.85, 0.7, 0.6, 0.5, 0.42, 0.36, 0.3, 0.26, 0.22,
];

/**
 * Calibrated reference: empirical win-rate of a naive (random) player per difficulty,
 * measured by tools/forge_lab Monte Carlo (40 runs x multiple levels). This is the
 * "felt difficulty" curve - it drops sharply and is near-zero from D6 up, while skilled
 * play stays winnable. Index 0 = difficulty 1.
 */
export const CALIBRATED_NAIVE_WIN_RATE: number[] = [
  1.0, 0.33, 0.28, 0.13, 0.013, 0.0, 0.006, 0.0, 0.0, 0.0,
];

/** Expected naive-player win chance (0..1) for a difficulty 1-10. */
export function naiveWinRate(difficulty: number): number {
  const D = clamp(Math.round(difficulty), 1, 10);
  return CALIBRATED_NAIVE_WIN_RATE[D - 1];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Derive the variable parameters for a difficulty 1-10. */
export function paramsForDifficulty(
  difficulty: number,
  overrides: Partial<ForgeParams> = {},
): ForgeParams {
  const D = clamp(Math.round(difficulty), 1, 10);
  const t = (D - 1) / 9; // 0..1

  const numVarieties = clamp(Math.round(4 + 4 * t), 4, 8);
  const numSeats = D <= 6 ? 4 : 5;
  const numCustomers = clamp(Math.round(4 + 5 * t), 4, 12);
  const numQueues = clamp(Math.round(3 + 2 * t), 3, 5);
  const targetMCR = TARGET_MCR[D - 1];

  return {
    difficulty: D,
    numVarieties,
    numSeats,
    numCustomers,
    numQueues,
    targetMCR,
    ...overrides,
  };
}

/** Average demand per customer for a difficulty (gentle sqrt rise, 3..7). */
export function demandForDifficulty(difficulty: number): number {
  const D = clamp(Math.round(difficulty), 1, 10);
  const t = (D - 1) / 9;
  return clamp(Math.round(3 + 4 * Math.sqrt(t)), 3, 8);
}

/**
 * Map solver metrics to a 1-10 difficulty index. Independent of the requested
 * difficulty so a hand-edited level gets re-rated honestly.
 */
export function computeDifficultyIndex(sim: SimResult, params: ForgeParams): number {
  if (!sim.solvable) return 10;

  // Constraint pressure: rarer safe moves => harder. mcr in (0,1].
  const constraint = (1 - Math.min(1, sim.mcr)) * 4.2; // 0..~4.2
  // Forced-move pressure.
  const forced = Math.min(2.5, sim.criticalMoves * 0.35);
  // Buffer danger: how close to the 5-slot ceiling the optimal line runs.
  const buffer = (sim.bufferPeak / 5) * 1.6;
  // Variety load: more colours to track.
  const variety = ((params.numVarieties - 4) / 4) * 1.2;
  // Length: very short puzzles feel easier.
  const length = Math.min(1.0, sim.totalMoves / 40);

  const raw = 1 + constraint + forced + buffer + variety + length;
  return Math.round(clamp(raw, 1, 10) * 10) / 10;
}

const BANDS: { max: number; label: string; badge: string }[] = [
  { max: 2, label: 'Novice', badge: 'NOVICE' },
  { max: 4, label: 'Apprentice', badge: 'APPRENTICE' },
  { max: 6, label: 'Challenger', badge: 'CHALLENGER' },
  { max: 8, label: 'Expert', badge: 'EXPERT' },
  { max: 10, label: 'Master', badge: 'MASTER' },
];

export function ratingForDifficulty(difficulty: number): DifficultyRating {
  const D = clamp(Math.round(difficulty), 1, 10);
  const band = BANDS.find((b) => D <= b.max) ?? BANDS[BANDS.length - 1];
  return {
    stars: clamp(Math.ceil(D / 2), 1, 5),
    label: band.label,
    badge: band.badge,
  };
}

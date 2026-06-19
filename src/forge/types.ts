/**
 * Kaizen Level Forge - core data model
 *
 * A "dish" in the Forge is identified by a single uppercase letter (A-H).
 * Letters map to the existing SushiVariety palette purely for rendering.
 */

import { SushiVariety } from '../types';

/** Dish letters used by the Forge, in canonical order. */
export const DISH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type DishLetter = (typeof DISH_LETTERS)[number];

/** Letter -> game variety (for plate colours when rendering). */
export const LETTER_TO_VARIETY: Record<DishLetter, SushiVariety> = {
  A: 'maguro', // red
  B: 'ebi', // blue
  C: 'kappa', // green
  D: 'tamago', // yellow
  E: 'california', // purple
  F: 'salmon', // orange
  G: 'unagi', // pink
  H: 'ikura', // teal
};

/** Hex colour per letter (mirrors sushiConfig colours for the chosen variety). */
export const LETTER_TO_HEX: Record<DishLetter, string> = {
  A: '#ef4444',
  B: '#3b82f6',
  C: '#10b981',
  D: '#eab308',
  E: '#a855f7',
  F: '#f97316',
  G: '#ec4899',
  H: '#14b8a6',
};

/** Fixed game constants (never change between Forge levels). */
export const FIXED = {
  beltSlots: 12,
  bufferSlots: 5,
  beltSpeedMs: 850,
  /** Belt ticks a seat stays empty after its customer is satisfied before the next arrives. */
  seatTurnoverTicks: 5,
} as const;

/**
 * Seat -> belt slot mapping, mirrors getSeatSlots() in App.tsx.
 * Forge supports 4 or 5 seats.
 */
export const SEAT_SLOTS: Record<number, number[]> = {
  2: [10, 4],
  3: [10, 7, 4],
  4: [10, 11, 5, 4],
  5: [10, 11, 8, 5, 4],
};

/** A customer's order. They are assigned to seats in array order, then refilled from the tail. */
export interface ForgeCustomer {
  /** Dish this customer wants. */
  dish: DishLetter;
  /** Total dishes they will eat. */
  demand: number;
}

/** The variable parameters that define a level's shape. */
export interface ForgeParams {
  difficulty: number; // 1..10
  numVarieties: number; // 4..8 (uses first N letters)
  numSeats: number; // 4 or 5
  numCustomers: number; // total customers across the level
  numQueues: number; // 3..5
  /** Target move-constraint ratio the generator aims for. */
  targetMCR: number;
}

/** A fully-specified, ready-to-play level. */
export interface ForgeLevel {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  difficulty: number;
  params: ForgeParams;
  /** Customers in arrival order (first numSeats are seated at start). */
  customers: ForgeCustomer[];
  /** Queues at the bottom; each lane is a list of dish letters, front = index 0. */
  queues: DishLetter[][];
  /** Compact, shareable encoding. */
  encoding: string;
  /** Last simulation result (cached). */
  sim?: SimResult;
}

/** One step in the optimal move plan produced by the solver. */
export interface MovePlanStep {
  /** Move ordinal (1-based). */
  index: number;
  /** Which queue lane to dispatch from (-1 when the move re-dispatches a dock plate). */
  lane: number;
  /** Source of the dispatched plate: a queue lane or the overflow dock. */
  source?: 'queue' | 'buffer';
  /** The dish dispatched. */
  dish: DishLetter;
  /** Belt tick at which this dispatch happens. */
  tick: number;
  /** How many lanes were dispatchable at this decision point. */
  availableChoices: number;
  /** How many of those choices keep the level winnable. */
  validChoices: number;
  /** 1 - validChoices/availableChoices: chance a blind pick is wrong here. */
  errorChance: number;
  /** True when only one lane keeps the level winnable (forced move). */
  critical: boolean;
}

/** Result of simulating + solving a level. */
export interface SimResult {
  solvable: boolean;
  /** Optimal (fewest-risk, then fewest-tick) move plan. */
  movePlan: MovePlanStep[];
  /** Total dispatch moves required to win. */
  totalMoves: number;
  /** Average move-constraint ratio across decision points (lower = harder). */
  mcr: number;
  /** Aggregate chance a naive player fails somewhere (1 - product of per-step safe odds). */
  failChance: number;
  /** Count of forced (single valid choice) moves. */
  criticalMoves: number;
  /** Highest buffer occupancy reached along the optimal line. */
  bufferPeak: number;
  /** Total belt ticks to clear the level optimally. */
  completionTicks: number;
  /** 1..10 computed difficulty index (may differ from requested difficulty). */
  difficultyIndex: number;
  /** Empirical win-rate of a naive (random) player, from Monte Carlo playouts (0..1). */
  naiveWinRate?: number;
  /** True when solvability/metrics came from policy playouts (exact search was capped). */
  approxSolve?: boolean;
  /** How many playout simulations were run while generating/validating this level. */
  simRuns?: number;
}

/** Outcome label bands. */
export interface DifficultyRating {
  stars: number; // 1..5
  label: string;
  badge: string;
}

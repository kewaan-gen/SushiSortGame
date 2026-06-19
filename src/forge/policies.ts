/**
 * Player policies + Monte Carlo playouts (in-browser).
 *
 * These let the generator:
 *   - estimate a level's *felt* difficulty by simulating many naive players,
 *   - validate solvability when the exact solver caps out (large/hard levels),
 *   - extract a concrete "follow this order" move sequence from a winning policy.
 *
 * A "simulation run" = one full playout from the initial state to win/lose.
 */

import {
  GameState,
  LevelDef,
  Action as DispatchAction,
  createInitialState,
  applyAction,
  tick,
  isVictory,
  dispatchActions,
} from './simulator';
import { DishLetter, MovePlanStep } from './types';

export type PolicyName = 'random' | 'greedy' | 'lookahead';

const STEP_GUARD = 6000;

function canAdvance(s: GameState): boolean {
  return (
    s.belt.length > 0 ||
    s.seats.some((seat) => seat.turnover > 0) ||
    s.queues.some((lane) => lane.length > 0)
  );
}

/** Dishes currently wanted by a seated, eating customer. */
function wantedSet(s: GameState): Set<DishLetter> {
  const set = new Set<DishLetter>();
  for (const seat of s.seats) {
    if (seat.customerIdx >= 0 && seat.turnover === 0 && seat.dish) set.add(seat.dish);
  }
  return set;
}

type Action = { type: 'act'; action: DispatchAction } | { type: 'tick' } | null;

function dishOf(s: GameState, a: DispatchAction): DishLetter {
  return a.kind === 'lane' ? (s.queues[a.lane][0] as DishLetter) : a.dish;
}

function greedyAction(s: GameState): Action {
  const acts = dispatchActions(s);
  const wanted = wantedSet(s);
  // Prefer delivering a wanted dock plate (frees the dock), then a wanted lane.
  const wantedDock = acts.find((a) => a.kind === 'buffer' && wanted.has(a.dish));
  if (wantedDock) return { type: 'act', action: wantedDock };
  const goodLane = acts.find((a) => a.kind === 'lane' && wanted.has(dishOf(s, a)));
  if (goodLane) return { type: 'act', action: goodLane };
  if (s.belt.length > 0 || s.seats.some((seat) => seat.turnover > 0)) return { type: 'tick' };
  const laneActs = acts.filter((a) => a.kind === 'lane');
  if (laneActs.length > 0) return { type: 'act', action: laneActs[0] }; // park to progress
  if (canAdvance(s)) return { type: 'tick' };
  return null;
}

function randomAction(s: GameState, rng: () => number): Action {
  const acts = dispatchActions(s);
  const advance = canAdvance(s);
  if (acts.length === 0) return advance ? { type: 'tick' } : null;
  if (advance && rng() < 0.45) return { type: 'tick' };
  return { type: 'act', action: acts[Math.floor(rng() * acts.length)] };
}

/** Score a state for lookahead: progress made (fewer plates left) minus buffer pressure. */
function scoreState(s: GameState): number {
  const platesLeft =
    s.queues.reduce((a, l) => a + l.length, 0) +
    s.belt.length +
    s.seats.reduce((a, seat) => a + Math.max(0, seat.remaining), 0);
  return -platesLeft - s.buffer.length * 3 - (s.failed ? 1000 : 0);
}

/** Roll forward greedily for a short horizon and return the resulting score. */
function greedyRollout(start: GameState, level: LevelDef, horizon: number): number {
  let s = start;
  for (let i = 0; i < horizon; i++) {
    if (s.failed || isVictory(s, level)) break;
    const a = greedyAction(s);
    if (!a) break;
    s = a.type === 'tick' ? tick(s, level) : applyAction(s, level, a.action);
  }
  return scoreState(s) + (isVictory(s, level) ? 500 : 0);
}

function lookaheadAction(s: GameState, level: LevelDef): Action {
  const candidates: Action[] = dispatchActions(s).map((action) => ({ type: 'act' as const, action }));
  if (canAdvance(s)) candidates.push({ type: 'tick' });
  if (candidates.length === 0) return null;

  let best: Action = candidates[0];
  let bestScore = -Infinity;
  for (const a of candidates) {
    if (!a) continue;
    const next = a.type === 'tick' ? tick(s, level) : applyAction(s, level, a.action);
    if (next.failed) continue;
    const score = greedyRollout(next, level, 14);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

function actionFor(s: GameState, level: LevelDef, policy: PolicyName, rng: () => number): Action {
  switch (policy) {
    case 'random':
      return randomAction(s, rng);
    case 'greedy':
      return greedyAction(s);
    case 'lookahead':
      return lookaheadAction(s, level);
  }
}

export interface PlayoutResult {
  won: boolean;
  bufferPeak: number;
  moves: MovePlanStep[];
}

/** Play one full game with the given policy. Records the dispatch sequence. */
export function playout(level: LevelDef, policy: PolicyName, rng: () => number): PlayoutResult {
  let s = createInitialState(level);
  let bufferPeak = s.buffer.length;
  const moves: MovePlanStep[] = [];
  let guard = 0;

  while (!isVictory(s, level) && !s.failed && guard++ < STEP_GUARD) {
    bufferPeak = Math.max(bufferPeak, s.buffer.length);
    const a = actionFor(s, level, policy, rng);
    if (!a) break;
    if (a.type === 'tick') {
      s = tick(s, level);
    } else {
      const available = dispatchActions(s).length;
      moves.push({
        index: moves.length + 1,
        lane: a.action.kind === 'lane' ? a.action.lane : -1,
        source: a.action.kind === 'lane' ? 'queue' : 'buffer',
        dish: dishOf(s, a.action),
        tick: s.tick,
        availableChoices: available,
        validChoices: 1,
        errorChance: 0,
        critical: false,
      });
      s = applyAction(s, level, a.action);
    }
  }
  bufferPeak = Math.max(bufferPeak, s.buffer.length);
  return { won: isVictory(s, level), bufferPeak, moves };
}

/** Empirical win-rate over `runs` playouts of a policy. */
export function winRate(
  level: LevelDef,
  policy: PolicyName,
  runs: number,
  rng: () => number,
): { rate: number; runs: number } {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    if (playout(level, policy, rng).won) wins++;
  }
  return { rate: runs ? wins / runs : 0, runs };
}

/**
 * Validate solvability via strong policies (used when exact search caps).
 * Returns a winning move sequence if found.
 */
export function policySolve(
  level: LevelDef,
  rng: () => number,
): { solvable: boolean; moves: MovePlanStep[]; bufferPeak: number } {
  for (const policy of ['lookahead', 'greedy'] as PolicyName[]) {
    const res = playout(level, policy, rng);
    if (res.won) return { solvable: true, moves: res.moves, bufferPeak: res.bufferPeak };
  }
  return { solvable: false, moves: [], bufferPeak: 0 };
}

/**
 * Forge solver.
 *
 * The game is deterministic, so we don't need random runs to FIND a solution -
 * we search the reachable state space for a winning line.
 *
 * Action model (1 tap = 1 move):
 *   - dispatch(lane): fire the front plate of a free lane (no belt tick).
 *   - advance:        let the belt tick once.
 * The player may fire several lanes before letting the belt tick, which matches
 * real play (belt moves every 850ms, taps are faster).
 *
 * We compute, via memoized winnability search:
 *   - solvable?            (does a winning line exist)
 *   - a canonical move plan (the taps required to win)
 *   - MCR                   (avg fraction of taps that keep the level winnable)
 *   - per-step error chance (1 - validTaps/availableTaps)
 *   - critical moves        (exactly one safe tap among several)
 *   - failChance            (chance a uniform-random tapper ever leaves the winning line)
 *   - bufferPeak, completionTicks
 *
 * For very large state spaces (high difficulty / many plates) the exact search is
 * capped; we then fall back to a strong greedy policy and flag the result approximate.
 */

import {
  GameState,
  LevelDef,
  Action,
  createInitialState,
  tick,
  isVictory,
  dispatchActions,
  applyAction,
  dispatchableLanes,
  dispatchableBufferDishes,
  hashState,
} from './simulator';
import { DishLetter, MovePlanStep, SimResult, FIXED } from './types';

class CapExceeded extends Error {}

interface SolveOptions {
  maxStates?: number;
}

export function solveLevel(level: LevelDef, opts: SolveOptions = {}): SimResult {
  const maxStates = opts.maxStates ?? 160_000;
  const memo = new Map<string, boolean>();
  let visited = 0;
  let capped = false;

  const canAdvance = (s: GameState): boolean =>
    s.belt.length > 0 ||
    s.seats.some((seat) => seat.turnover > 0) ||
    s.queues.some((lane) => lane.length > 0);

  const canWin = (s: GameState): boolean => {
    if (s.failed) return false;
    if (isVictory(s, level)) return true;

    const h = hashState(s);
    const cached = memo.get(h);
    if (cached !== undefined) return cached;

    visited++;
    if (visited > maxStates) throw new CapExceeded();

    // Cycle guard: assume not-winnable while exploring this state.
    memo.set(h, false);

    for (const action of dispatchActions(s)) {
      if (canWin(applyAction(s, level, action))) {
        memo.set(h, true);
        return true;
      }
    }
    if (canAdvance(s) && canWin(tick(s, level))) {
      memo.set(h, true);
      return true;
    }
    return false;
  };

  const initial = createInitialState(level);

  let solvable: boolean;
  try {
    solvable = canWin(initial);
  } catch (e) {
    if (e instanceof CapExceeded) {
      capped = true;
      return greedyFallback(level, initial);
    }
    throw e;
  }

  if (!solvable) {
    return {
      solvable: false,
      movePlan: [],
      totalMoves: 0,
      mcr: 0,
      failChance: 1,
      criticalMoves: 0,
      bufferPeak: 0,
      completionTicks: 0,
      difficultyIndex: 0,
      approxSolve: false,
    };
  }

  // Reconstruct a canonical winning line using the populated memo.
  // Reset the visited counter: the winning line is mostly memoized and cheap to walk,
  // but the global cap would otherwise spuriously fire mid-reconstruction.
  visited = 0;
  const movePlan: MovePlanStep[] = [];
  const ratios: number[] = [];
  let safeProduct = 1;
  let critical = 0;
  let bufferPeak = initial.buffer.length;
  let state = initial;
  let guard = 0;
  const guardMax = 100_000;

  const dishOf = (s: GameState, a: Action): DishLetter =>
    a.kind === 'lane' ? (s.queues[a.lane][0] as DishLetter) : a.dish;

  try {
    while (!isVictory(state, level) && guard++ < guardMax) {
      bufferPeak = Math.max(bufferPeak, state.buffer.length);
      const actions = dispatchActions(state);

      // Evaluate which dispatch actions keep the level winnable.
      const validActions = actions.filter((a) => canWin(applyAction(state, level, a)));

      if (actions.length > 0) {
        // This is a decision point (player could tap now).
        const available = actions.length;
        const valid = validActions.length;
        ratios.push(valid / available);
        safeProduct *= valid / available;

        if (valid > 0) {
          const isCritical = valid === 1 && available > 1;
          if (isCritical) critical++;

          const chosen = validActions[0];
          movePlan.push({
            index: movePlan.length + 1,
            lane: chosen.kind === 'lane' ? chosen.lane : -1,
            source: chosen.kind === 'lane' ? 'queue' : 'buffer',
            dish: dishOf(state, chosen),
            tick: state.tick,
            availableChoices: available,
            validChoices: valid,
            errorChance: 1 - valid / available,
            critical: isCritical,
          });
          state = applyAction(state, level, chosen);
          continue;
        }
      }

      // No safe (or no available) dispatch right now: advance the belt.
      if (canAdvance(state)) {
        state = tick(state, level);
      } else {
        break; // stuck (should not happen on a solvable line)
      }
    }
  } catch (e) {
    if (e instanceof CapExceeded) {
      // Reconstruction got too expensive; fall back to a policy-style plan.
      capped = true;
      return greedyFallback(level, initial);
    }
    throw e;
  }

  bufferPeak = Math.max(bufferPeak, state.buffer.length);
  const mcr = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
  const failChance = 1 - safeProduct;

  const result: SimResult = {
    solvable: true,
    movePlan,
    totalMoves: movePlan.length,
    mcr,
    failChance,
    criticalMoves: critical,
    bufferPeak,
    completionTicks: state.tick,
    difficultyIndex: 0, // filled by difficulty.ts
    approxSolve: false,
  };
  void capped;
  return result;
}

/**
 * Greedy fallback for state spaces too large to search exactly.
 * Policy: fire any free lane whose front dish is wanted by a seated customer it can
 * still reach; otherwise wait. Approximate metrics only.
 */
function greedyFallback(level: LevelDef, initial: GameState): SimResult {
  const movePlan: MovePlanStep[] = [];
  let state = initial;
  let bufferPeak = state.buffer.length;
  let guard = 0;
  const guardMax = 20_000;

  const wantedDishes = (s: GameState): Set<DishLetter> => {
    const set = new Set<DishLetter>();
    for (const seat of s.seats) {
      if (seat.customerIdx >= 0 && seat.turnover === 0 && seat.dish) set.add(seat.dish);
    }
    return set;
  };

  const pushMove = (s: GameState, action: Action, errorChance: number, isCritical: boolean) => {
    movePlan.push({
      index: movePlan.length + 1,
      lane: action.kind === 'lane' ? action.lane : -1,
      source: action.kind === 'lane' ? 'queue' : 'buffer',
      dish: action.kind === 'lane' ? (s.queues[action.lane][0] as DishLetter) : action.dish,
      tick: s.tick,
      availableChoices: dispatchActions(s).length,
      validChoices: 1,
      errorChance,
      critical: isCritical,
    });
  };

  while (!isVictory(state, level) && !state.failed && guard++ < guardMax) {
    bufferPeak = Math.max(bufferPeak, state.buffer.length);
    const lanes = dispatchableLanes(state);
    const wanted = wantedDishes(state);

    // Prefer delivering a wanted dock plate (frees a dock slot), then a wanted lane.
    const wantedDock = dispatchableBufferDishes(state).find((d) => wanted.has(d));
    const goodLane = lanes.find((lane) => wanted.has(state.queues[lane][0] as DishLetter));

    if (wantedDock !== undefined) {
      pushMove(state, { kind: 'buffer', dish: wantedDock }, 0, false);
      state = applyAction(state, level, { kind: 'buffer', dish: wantedDock });
      continue;
    }
    if (goodLane !== undefined) {
      pushMove(state, { kind: 'lane', lane: goodLane }, 0, false);
      state = applyAction(state, level, { kind: 'lane', lane: goodLane });
      continue;
    }

    if (state.belt.length > 0 || state.seats.some((s) => s.turnover > 0)) {
      state = tick(state, level);
    } else if (lanes.length > 0) {
      // Nothing wanted but queues remain and belt empty: park one plate to make progress.
      pushMove(state, { kind: 'lane', lane: lanes[0] }, 1 - 1 / Math.max(1, lanes.length), lanes.length > 1);
      state = applyAction(state, level, { kind: 'lane', lane: lanes[0] });
    } else {
      state = tick(state, level);
    }
  }

  bufferPeak = Math.max(bufferPeak, state.buffer.length);
  const solvable = isVictory(state, level);
  const critical = movePlan.filter((m) => m.critical).length;

  return {
    solvable,
    movePlan,
    totalMoves: movePlan.length,
    mcr: 0.2, // approximate: large levels are constrained
    failChance: solvable ? 0.85 : 1,
    criticalMoves: critical,
    bufferPeak,
    completionTicks: state.tick,
    difficultyIndex: 0,
    approxSolve: true,
  };
}

/** Convenience: total plates implied by customer demands. */
export function totalPlatesIn(level: LevelDef): number {
  return level.queues.reduce((sum, lane) => sum + lane.length, 0);
}

void FIXED;

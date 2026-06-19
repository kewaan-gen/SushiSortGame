/**
 * Deterministic game simulator for the Forge.
 *
 * Mirrors the real belt loop in App.tsx (tickConveyorBelt / handleDispatchQueue /
 * feedCustomerAtSeat):
 *  - 12 belt slots, plates move counter-clockwise: slot -> (slot + 1) % 12 each tick.
 *  - A plate dispatched from lane i enters the belt at slot i.
 *  - A plate that completes a full rotation (12 steps) without being eaten drops into
 *    the overflow DOCK, keeping its dish letter.
 *  - The dock holds up to bufferSlots dishes. A drop with no free dock slot => failure.
 *  - Dock plates are tappable: re-dispatching one back onto the belt is a MOVE (it
 *    re-enters at BUFFER_ENTRY_SLOT). This lets the player park plates they don't need
 *    yet, serve other customers, then send the parked plate back for delivery.
 *  - When a plate sits on a seat's slot and that seat's waiting customer wants that
 *    dish, the plate is intercepted and one dish is eaten.
 *  - Eating is modelled as instant (real eat delay 50ms << belt 850ms), so a customer
 *    can eat one plate per tick. A satisfied seat stays empty for seatTurnoverTicks,
 *    then the next unseated customer arrives.
 *
 * The state is immutable; every transition returns a new GameState so the solver can
 * branch over it safely.
 */

import { DishLetter, ForgeCustomer, FIXED, SEAT_SLOTS } from './types';

export interface SeatState {
  /** Index into the level customer list, or -1 if empty. */
  customerIdx: number;
  dish: DishLetter | null;
  remaining: number;
  /** Ticks until the next customer arrives (turnover countdown), 0 if seated/closed. */
  turnover: number;
}

export interface BeltPlate {
  dish: DishLetter;
  slot: number;
  steps: number;
}

export interface GameState {
  /** Front of each lane is index 0. */
  queues: DishLetter[][];
  belt: BeltPlate[];
  /** Overflow dock: dishes that completed a rotation, awaiting re-dispatch. */
  buffer: DishLetter[];
  seats: SeatState[];
  /** Next customer in the arrival list not yet seated. */
  nextCustomerIdx: number;
  tick: number;
  failed: boolean;
}

export interface LevelDef {
  queues: DishLetter[][];
  customers: ForgeCustomer[];
  numSeats: number;
}

/** Belt slot where a re-dispatched dock plate re-enters (free of seats/lanes). */
export const BUFFER_ENTRY_SLOT = 6;

/** A single tap/move: dispatch a lane front, or re-dispatch a dock dish. */
export type Action = { kind: 'lane'; lane: number } | { kind: 'buffer'; dish: DishLetter };

export function createInitialState(level: LevelDef): GameState {
  const seatSlots = SEAT_SLOTS[level.numSeats] ?? SEAT_SLOTS[4];
  const seats: SeatState[] = [];
  let next = 0;
  for (let s = 0; s < seatSlots.length; s++) {
    if (next < level.customers.length) {
      const c = level.customers[next];
      seats.push({ customerIdx: next, dish: c.dish, remaining: c.demand, turnover: 0 });
      next++;
    } else {
      seats.push({ customerIdx: -1, dish: null, remaining: 0, turnover: 0 });
    }
  }

  return {
    queues: level.queues.map((lane) => [...lane]),
    belt: [],
    buffer: [],
    seats,
    nextCustomerIdx: next,
    tick: 0,
    failed: false,
  };
}

export function seatSlotsFor(numSeats: number): number[] {
  return SEAT_SLOTS[numSeats] ?? SEAT_SLOTS[4];
}

/** Total dishes still owed across seated + unseated customers. */
export function remainingDemand(state: GameState, level: LevelDef): number {
  let sum = 0;
  for (const seat of state.seats) {
    if (seat.customerIdx >= 0) sum += seat.remaining;
  }
  for (let i = state.nextCustomerIdx; i < level.customers.length; i++) {
    sum += level.customers[i].demand;
  }
  return sum;
}

export function isVictory(state: GameState, level: LevelDef): boolean {
  return !state.failed && remainingDemand(state, level) === 0;
}

/** First free belt slot scanning forward from `start` (wraps); -1 if the belt is full. */
export function firstFreeSlotFrom(state: GameState, start: number): number {
  for (let k = 0; k < FIXED.beltSlots; k++) {
    const s = (start + k) % FIXED.beltSlots;
    if (!state.belt.some((p) => p.slot === s)) return s;
  }
  return -1;
}

/**
 * Is a lane currently dispatchable? A lane can be tapped at ANY time as long as it has
 * a plate and the belt has at least one free slot (no entry-slot "wait"). If the lane's
 * own slot is busy, the plate enters at the nearest free slot ahead.
 */
export function laneDispatchable(state: GameState, lane: number): boolean {
  if (lane >= state.queues.length) return false;
  if (state.queues[lane].length === 0) return false;
  return state.belt.length < FIXED.beltSlots;
}

export function dispatchableLanes(state: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.queues.length; i++) {
    if (laneDispatchable(state, i)) out.push(i);
  }
  return out;
}

/** Can a dock plate be re-dispatched right now (i.e. the belt has room)? */
export function bufferEntryFree(state: GameState): boolean {
  return state.belt.length < FIXED.beltSlots;
}

/** Distinct dock dishes that can be re-dispatched right now. */
export function dispatchableBufferDishes(state: GameState): DishLetter[] {
  if (state.buffer.length === 0 || !bufferEntryFree(state)) return [];
  return Array.from(new Set(state.buffer));
}

/** All dispatch actions available at this decision point (lanes + dock dishes). */
export function dispatchActions(state: GameState): Action[] {
  const actions: Action[] = dispatchableLanes(state).map((lane) => ({ kind: 'lane', lane }));
  for (const dish of dispatchableBufferDishes(state)) actions.push({ kind: 'buffer', dish });
  return actions;
}

export function applyAction(prev: GameState, level: LevelDef, action: Action): GameState {
  return action.kind === 'lane'
    ? dispatch(prev, level, action.lane)
    : dispatchBuffer(prev, level, action.dish);
}

/** Try to seat the next waiting customer at a freshly opened seat. */
function refillSeat(seat: SeatState, state: GameState, level: LevelDef): void {
  if (state.nextCustomerIdx < level.customers.length) {
    const c = level.customers[state.nextCustomerIdx];
    seat.customerIdx = state.nextCustomerIdx;
    seat.dish = c.dish;
    seat.remaining = c.demand;
    seat.turnover = 0;
    state.nextCustomerIdx++;
  } else {
    seat.customerIdx = -1;
    seat.dish = null;
    seat.remaining = 0;
    seat.turnover = 0;
  }
}

/** Feed one dish to the seat at seatIdx if it wants `dish`. Returns true if eaten. */
function tryFeed(state: GameState, level: LevelDef, seatIdx: number, dish: DishLetter): boolean {
  const seat = state.seats[seatIdx];
  if (seat.customerIdx < 0 || seat.turnover > 0) return false;
  if (seat.dish !== dish || seat.remaining <= 0) return false;

  seat.remaining -= 1;
  if (seat.remaining === 0) {
    // Customer satisfied; begin turnover.
    seat.customerIdx = -1;
    seat.dish = null;
    seat.turnover = FIXED.seatTurnoverTicks;
  }
  return true;
}

/**
 * Dispatch the front plate of `lane`. Mutates a cloned state.
 * Honors the instant-interception check at the entry slot (mirrors finishDispatchToBelt).
 */
export function dispatch(prev: GameState, level: LevelDef, lane: number): GameState {
  const state = cloneState(prev);
  if (!laneDispatchable(state, lane)) return state; // no-op (caller should avoid)

  const entrySlot = firstFreeSlotFrom(state, lane);
  if (entrySlot < 0) return state; // belt full, no-op

  const dish = state.queues[lane].shift()!;
  const seatSlots = seatSlotsFor(level.numSeats);

  // Instant interception at the entry slot.
  let eaten = false;
  for (let s = 0; s < seatSlots.length; s++) {
    if (seatSlots[s] === entrySlot && tryFeed(state, level, s, dish)) {
      eaten = true;
      break;
    }
  }

  if (!eaten) {
    state.belt.push({ dish, slot: entrySlot, steps: 0 });
  }

  return state;
}

/**
 * Re-dispatch a dock plate of `dish` back onto the belt (a move).
 * It re-enters at BUFFER_ENTRY_SLOT and rides the belt to be intercepted.
 */
export function dispatchBuffer(prev: GameState, level: LevelDef, dish: DishLetter): GameState {
  const state = cloneState(prev);
  const idx = state.buffer.indexOf(dish);
  if (idx < 0) return state; // no-op
  const entrySlot = firstFreeSlotFrom(state, BUFFER_ENTRY_SLOT);
  if (entrySlot < 0) return state; // belt full

  state.buffer.splice(idx, 1);
  const seatSlots = seatSlotsFor(level.numSeats);

  // Instant interception if a seat sits exactly at the re-entry slot.
  let eaten = false;
  for (let s = 0; s < seatSlots.length; s++) {
    if (seatSlots[s] === entrySlot && tryFeed(state, level, s, dish)) {
      eaten = true;
      break;
    }
  }
  if (!eaten) {
    state.belt.push({ dish, slot: entrySlot, steps: 0 });
  }
  return state;
}

/**
 * Advance the belt by one tick: move plates, resolve overflow into buffer, resolve
 * interceptions, decrement seat turnovers. Mutates a cloned state.
 */
export function tick(prev: GameState, level: LevelDef): GameState {
  const state = cloneState(prev);
  if (state.failed) return state;

  const seatSlots = seatSlotsFor(level.numSeats);
  const survivors: BeltPlate[] = [];

  // 1. Move plates / detect overflow.
  for (const plate of state.belt) {
    const steps = plate.steps + 1;
    if (steps >= FIXED.beltSlots) {
      // Completed a rotation: drop into the dock (keeping the dish).
      if (state.buffer.length >= FIXED.bufferSlots) {
        state.failed = true;
        return state;
      }
      state.buffer.push(plate.dish);
    } else {
      survivors.push({ dish: plate.dish, slot: (plate.slot + 1) % FIXED.beltSlots, steps });
    }
  }

  // 2. Interceptions at new positions.
  const remaining: BeltPlate[] = [];
  for (const plate of survivors) {
    let intercepted = false;
    for (let s = 0; s < seatSlots.length; s++) {
      if (seatSlots[s] === plate.slot && tryFeed(state, level, s, plate.dish)) {
        intercepted = true;
        break;
      }
    }
    if (!intercepted) remaining.push(plate);
  }
  state.belt = remaining;

  // 3. Seat turnovers.
  for (const seat of state.seats) {
    if (seat.turnover > 0) {
      seat.turnover -= 1;
      if (seat.turnover === 0) refillSeat(seat, state, level);
    }
  }

  state.tick += 1;
  return state;
}

export function cloneState(s: GameState): GameState {
  return {
    queues: s.queues.map((lane) => [...lane]),
    belt: s.belt.map((p) => ({ ...p })),
    buffer: [...s.buffer],
    seats: s.seats.map((seat) => ({ ...seat })),
    nextCustomerIdx: s.nextCustomerIdx,
    tick: s.tick,
    failed: s.failed,
  };
}

/** Stable hash of a state for visited-set dedup in the solver. */
export function hashState(s: GameState): string {
  const q = s.queues.map((lane) => lane.join('')).join('|');
  const b = s.belt
    .map((p) => `${p.dish}${p.slot}.${p.steps}`)
    .sort()
    .join(',');
  const seats = s.seats
    .map((seat) => `${seat.dish ?? '_'}:${seat.remaining}:${seat.turnover}`)
    .join(';');
  const dock = [...s.buffer].sort().join('');
  return `${q}#${b}#${seats}#${dock}#${s.nextCustomerIdx}`;
}

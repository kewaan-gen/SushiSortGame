"""
Kaizen Forge - offline simulation core (Python port of src/forge/*.ts).

This is the design/calibration lab. It is a faithful port of the TypeScript
simulator, solver and generator so that Monte Carlo results computed here transfer
directly to the shipping engine. It does NOT run in the browser.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field, replace
from typing import Optional

DISH_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]

FIXED = {
    "beltSlots": 12,
    "bufferSlots": 5,
    "beltSpeedMs": 850,
    "seatTurnoverTicks": 5,
}

SEAT_SLOTS = {
    2: [10, 4],
    3: [10, 7, 4],
    4: [10, 11, 5, 4],
    5: [10, 11, 8, 5, 4],
}

TARGET_MCR = [1.0, 0.85, 0.70, 0.60, 0.50, 0.42, 0.36, 0.30, 0.26, 0.22]


# --------------------------------------------------------------------------- #
# State
# --------------------------------------------------------------------------- #
@dataclass
class Seat:
    customer_idx: int
    dish: Optional[str]
    remaining: int
    turnover: int


@dataclass
class Plate:
    dish: str
    slot: int
    steps: int


@dataclass
class State:
    queues: list[list[str]]
    belt: list[Plate]
    buffer: list[str]  # overflow dock: dishes awaiting re-dispatch
    seats: list[Seat]
    next_customer_idx: int
    tick: int
    failed: bool


# Belt slot where a re-dispatched dock plate re-enters (free of seats/lanes).
BUFFER_ENTRY_SLOT = 6


@dataclass
class Level:
    queues: list[list[str]]
    customers: list[tuple[str, int]]  # (dish, demand)
    num_seats: int


def seat_slots_for(num_seats: int) -> list[int]:
    return SEAT_SLOTS.get(num_seats, SEAT_SLOTS[4])


def initial_state(level: Level) -> State:
    slots = seat_slots_for(level.num_seats)
    seats: list[Seat] = []
    nxt = 0
    for _ in range(len(slots)):
        if nxt < len(level.customers):
            dish, demand = level.customers[nxt]
            seats.append(Seat(nxt, dish, demand, 0))
            nxt += 1
        else:
            seats.append(Seat(-1, None, 0, 0))
    return State(
        queues=[list(lane) for lane in level.queues],
        belt=[],
        buffer=[],
        seats=seats,
        next_customer_idx=nxt,
        tick=0,
        failed=False,
    )


def clone(s: State) -> State:
    return State(
        queues=[list(lane) for lane in s.queues],
        belt=[Plate(p.dish, p.slot, p.steps) for p in s.belt],
        buffer=list(s.buffer),
        seats=[replace(seat) for seat in s.seats],
        next_customer_idx=s.next_customer_idx,
        tick=s.tick,
        failed=s.failed,
    )


def remaining_demand(s: State, level: Level) -> int:
    total = 0
    for seat in s.seats:
        if seat.customer_idx >= 0:
            total += seat.remaining
    for i in range(s.next_customer_idx, len(level.customers)):
        total += level.customers[i][1]
    return total


def is_victory(s: State, level: Level) -> bool:
    return (not s.failed) and remaining_demand(s, level) == 0


def first_free_slot_from(s: State, start: int) -> int:
    """First free belt slot scanning forward from `start` (wraps); -1 if belt is full."""
    occupied = {p.slot for p in s.belt}
    for k in range(FIXED["beltSlots"]):
        slot = (start + k) % FIXED["beltSlots"]
        if slot not in occupied:
            return slot
    return -1


def lane_dispatchable(s: State, lane: int) -> bool:
    # No entry-slot wait: a lane is tappable any time it has a plate and the belt has room.
    if lane >= len(s.queues) or not s.queues[lane]:
        return False
    return len(s.belt) < FIXED["beltSlots"]


def dispatchable_lanes(s: State) -> list[int]:
    return [i for i in range(len(s.queues)) if lane_dispatchable(s, i)]


def buffer_entry_free(s: State) -> bool:
    return len(s.belt) < FIXED["beltSlots"]


def dispatchable_buffer_dishes(s: State) -> list[str]:
    if not s.buffer or not buffer_entry_free(s):
        return []
    seen = []
    for d in s.buffer:
        if d not in seen:
            seen.append(d)
    return seen


def dispatch_actions(s: State) -> list[tuple]:
    """Unified actions: ('lane', i) or ('buffer', dish)."""
    acts = [("lane", i) for i in dispatchable_lanes(s)]
    acts += [("buffer", d) for d in dispatchable_buffer_dishes(s)]
    return acts


def apply_action(prev: State, level: Level, action: tuple) -> State:
    kind, val = action
    return dispatch(prev, level, val) if kind == "lane" else dispatch_buffer(prev, level, val)


def _refill_seat(seat: Seat, s: State, level: Level) -> None:
    if s.next_customer_idx < len(level.customers):
        dish, demand = level.customers[s.next_customer_idx]
        seat.customer_idx = s.next_customer_idx
        seat.dish = dish
        seat.remaining = demand
        seat.turnover = 0
        s.next_customer_idx += 1
    else:
        seat.customer_idx = -1
        seat.dish = None
        seat.remaining = 0
        seat.turnover = 0


def _try_feed(s: State, level: Level, seat_idx: int, dish: str) -> bool:
    seat = s.seats[seat_idx]
    if seat.customer_idx < 0 or seat.turnover > 0:
        return False
    if seat.dish != dish or seat.remaining <= 0:
        return False
    seat.remaining -= 1
    if seat.remaining == 0:
        seat.customer_idx = -1
        seat.dish = None
        seat.turnover = FIXED["seatTurnoverTicks"]
    return True


def dispatch(prev: State, level: Level, lane: int) -> State:
    s = clone(prev)
    if not lane_dispatchable(s, lane):
        return s
    entry = first_free_slot_from(s, lane)
    if entry < 0:
        return s
    dish = s.queues[lane].pop(0)
    slots = seat_slots_for(level.num_seats)
    eaten = False
    for si in range(len(slots)):
        if slots[si] == entry and _try_feed(s, level, si, dish):
            eaten = True
            break
    if not eaten:
        s.belt.append(Plate(dish, entry, 0))
    return s


def dispatch_buffer(prev: State, level: Level, dish: str) -> State:
    s = clone(prev)
    if dish not in s.buffer:
        return s
    entry = first_free_slot_from(s, BUFFER_ENTRY_SLOT)
    if entry < 0:
        return s
    s.buffer.remove(dish)
    slots = seat_slots_for(level.num_seats)
    eaten = False
    for si in range(len(slots)):
        if slots[si] == entry and _try_feed(s, level, si, dish):
            eaten = True
            break
    if not eaten:
        s.belt.append(Plate(dish, entry, 0))
    return s


def tick(prev: State, level: Level) -> State:
    s = clone(prev)
    if s.failed:
        return s
    slots = seat_slots_for(level.num_seats)
    survivors: list[Plate] = []
    for p in s.belt:
        steps = p.steps + 1
        if steps >= FIXED["beltSlots"]:
            if len(s.buffer) >= FIXED["bufferSlots"]:
                s.failed = True
                return s
            s.buffer.append(p.dish)
        else:
            survivors.append(Plate(p.dish, (p.slot + 1) % FIXED["beltSlots"], steps))
    remaining: list[Plate] = []
    for p in survivors:
        intercepted = False
        for si in range(len(slots)):
            if slots[si] == p.slot and _try_feed(s, level, si, p.dish):
                intercepted = True
                break
        if not intercepted:
            remaining.append(p)
    s.belt = remaining
    for seat in s.seats:
        if seat.turnover > 0:
            seat.turnover -= 1
            if seat.turnover == 0:
                _refill_seat(seat, s, level)
    s.tick += 1
    return s


def hash_state(s: State) -> str:
    q = "|".join("".join(lane) for lane in s.queues)
    b = ",".join(sorted(f"{p.dish}{p.slot}.{p.steps}" for p in s.belt))
    seats = ";".join(f"{seat.dish or '_'}:{seat.remaining}:{seat.turnover}" for seat in s.seats)
    dock = "".join(sorted(s.buffer))
    return f"{q}#{b}#{seats}#{dock}#{s.next_customer_idx}"


# --------------------------------------------------------------------------- #
# Solver (memoized winnability)
# --------------------------------------------------------------------------- #
class CapExceeded(Exception):
    pass


def can_advance(s: State) -> bool:
    return (
        len(s.belt) > 0
        or any(seat.turnover > 0 for seat in s.seats)
        or any(len(lane) > 0 for lane in s.queues)
    )


def solve(level: Level, max_states: int = 400_000):
    """Returns dict with solvable, move_plan, mcr, fail_chance, critical, buffer_peak, ticks."""
    import sys

    sys.setrecursionlimit(1_000_000)
    memo: dict[str, bool] = {}
    visited = [0]

    def can_win(s: State) -> bool:
        if s.failed:
            return False
        if is_victory(s, level):
            return True
        h = hash_state(s)
        if h in memo:
            return memo[h]
        visited[0] += 1
        if visited[0] > max_states:
            raise CapExceeded()
        memo[h] = False  # cycle guard
        for action in dispatch_actions(s):
            if can_win(apply_action(s, level, action)):
                memo[h] = True
                return True
        if can_advance(s) and can_win(tick(s, level)):
            memo[h] = True
            return True
        return False

    init = initial_state(level)
    try:
        solvable = can_win(init)
    except CapExceeded:
        return {"solvable": None, "capped": True, "mcr": None, "fail_chance": None,
                "total_moves": None, "critical": None, "buffer_peak": None, "ticks": None,
                "visited": visited[0]}

    if not solvable:
        return {"solvable": False, "capped": False, "mcr": 0.0, "fail_chance": 1.0,
                "total_moves": 0, "critical": 0, "buffer_peak": 0, "ticks": 0,
                "visited": visited[0]}

    def dish_of(s: State, action: tuple) -> str:
        kind, val = action
        return s.queues[val][0] if kind == "lane" else val

    # Reset the visited counter for the (cheap, mostly-memoized) reconstruction walk
    # so the global cap doesn't spuriously fire mid-reconstruction.
    visited[0] = 0
    ratios: list[float] = []
    safe_product = 1.0
    critical = 0
    buffer_peak = len(init.buffer)
    total_moves = 0
    move_plan: list[dict] = []
    state = init
    guard = 0
    try:
        while not is_victory(state, level) and guard < 100_000:
            guard += 1
            buffer_peak = max(buffer_peak, len(state.buffer))
            actions = dispatch_actions(state)
            valid = [a for a in actions if can_win(apply_action(state, level, a))]
            if actions:
                ratios.append(len(valid) / len(actions))
                safe_product *= len(valid) / len(actions)
                if valid:
                    is_critical = len(valid) == 1 and len(actions) > 1
                    if is_critical:
                        critical += 1
                    chosen = valid[0]
                    move_plan.append({
                        "index": len(move_plan) + 1,
                        "lane": chosen[1] if chosen[0] == "lane" else -1,
                        "source": "queue" if chosen[0] == "lane" else "buffer",
                        "dish": dish_of(state, chosen),
                        "tick": state.tick,
                        "available_choices": len(actions),
                        "valid_choices": len(valid),
                        "error_chance": 1 - len(valid) / len(actions),
                        "critical": is_critical,
                    })
                    state = apply_action(state, level, chosen)
                    total_moves += 1
                    continue
            if can_advance(state):
                state = tick(state, level)
            else:
                break
    except CapExceeded:
        # Reconstruction too expensive; report as capped (caller validates via policy).
        return {"solvable": None, "capped": True, "mcr": None, "fail_chance": None,
                "total_moves": None, "critical": None, "buffer_peak": None, "ticks": None,
                "visited": visited[0]}

    buffer_peak = max(buffer_peak, len(state.buffer))
    mcr = sum(ratios) / len(ratios) if ratios else 1.0
    return {
        "solvable": True,
        "capped": False,
        "mcr": mcr,
        "fail_chance": 1 - safe_product,
        "total_moves": total_moves,
        "move_plan": move_plan,
        "critical": critical,
        "buffer_peak": buffer_peak,
        "ticks": state.tick,
        "visited": visited[0],
    }

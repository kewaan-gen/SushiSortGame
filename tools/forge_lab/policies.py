"""
Imperfect player policies for Monte Carlo difficulty estimation.

Each policy plays a level to win/fail. Running many policies many times gives the
empirical win-rate that defines how hard a level actually FEELS - distinct from the
solver, which only proves a winning line exists.

Actions are unified: ("lane", i) dispatches a queue front; ("buffer", dish)
re-dispatches a dock plate (a move). Policies can park plates in the dock and send
them back later, matching the shipping engine.
"""

from __future__ import annotations

import random

from forge_sim import (
    Level,
    State,
    can_advance,
    dispatch_actions,
    apply_action,
    initial_state,
    is_victory,
    tick,
)


def _wanted_dishes(s: State) -> set[str]:
    return {seat.dish for seat in s.seats if seat.customer_idx >= 0 and seat.turnover == 0 and seat.dish}


def _dish_of(s: State, action: tuple) -> str:
    kind, val = action
    return s.queues[val][0] if kind == "lane" else val


def _choose(s: State, level: Level, policy: str, rng: random.Random):
    """Return a chosen action tuple, or None (meaning: tick / wait)."""
    acts = dispatch_actions(s)
    if not acts:
        return None
    wanted = _wanted_dishes(s)

    if policy == "random":
        if rng.random() < 0.7:
            return rng.choice(acts)
        return None

    if policy == "greedy":
        # Prefer delivering a wanted dock plate (frees the dock), then a wanted lane.
        dock = [a for a in acts if a[0] == "buffer" and a[1] in wanted]
        if dock:
            return rng.choice(dock)
        good = [a for a in acts if a[0] == "lane" and _dish_of(s, a) in wanted]
        if good:
            return rng.choice(good)
        return None

    if policy in ("lookahead1", "lookahead2"):
        good = [a for a in acts if (_dish_of(s, a) in wanted)]
        if good:
            def score(a: tuple) -> int:
                nxt = tick(apply_action(s, level, a), level)
                return (1000 if nxt.failed else 0) + len(nxt.buffer)
            return min(good, key=score)
        return None

    return None


def play(level: Level, policy: str, rng: random.Random, max_ticks: int = 4000) -> bool:
    """Play one game with the given policy. Returns True on victory."""
    s = initial_state(level)
    ticks = 0
    while not is_victory(level=level, s=s) and not s.failed and ticks < max_ticks:
        action = _choose(s, level, policy, rng)
        # When nothing useful and belt is idle, park a plate to make progress.
        if action is None and not can_advance(s):
            acts = dispatch_actions(s)
            if acts:
                action = acts[0]
        if action is not None:
            s = apply_action(s, level, action)
            continue
        if can_advance(s):
            s = tick(s, level)
            ticks += 1
        else:
            break
    return is_victory(s=s, level=level)


def play_trace(level: Level, policy: str, rng: random.Random, max_ticks: int = 4000):
    """Like play(), but returns (won, moves) where moves is the dispatch order."""
    s = initial_state(level)
    ticks = 0
    moves: list[dict] = []
    while not is_victory(level=level, s=s) and not s.failed and ticks < max_ticks:
        action = _choose(s, level, policy, rng)
        if action is None and not can_advance(s):
            acts = dispatch_actions(s)
            if acts:
                action = acts[0]
        if action is not None:
            moves.append({
                "index": len(moves) + 1,
                "lane": action[1] if action[0] == "lane" else -1,
                "source": "queue" if action[0] == "lane" else "buffer",
                "dish": _dish_of(s, action),
                "tick": s.tick,
            })
            s = apply_action(s, level, action)
            continue
        if can_advance(s):
            s = tick(s, level)
            ticks += 1
        else:
            break
    return is_victory(s=s, level=level), moves


def win_rate(level: Level, policy: str, runs: int, rng: random.Random) -> float:
    wins = sum(1 for _ in range(runs) if play(level, policy, rng))
    return wins / runs

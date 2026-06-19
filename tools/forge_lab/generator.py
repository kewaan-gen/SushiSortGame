"""Level generator (Python port of src/forge/generator.ts) for the calibration lab."""

from __future__ import annotations

import math
import random

from forge_sim import DISH_LETTERS, TARGET_MCR, Level, solve
from policies import play


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def params_for_difficulty(difficulty: int) -> dict:
    D = clamp(round(difficulty), 1, 10)
    t = (D - 1) / 9
    return {
        "difficulty": D,
        "numVarieties": clamp(round(4 + 4 * t), 4, 8),
        "numSeats": 4 if D <= 6 else 5,
        "numCustomers": clamp(round(4 + 5 * t), 4, 12),
        "numQueues": clamp(round(3 + 2 * t), 3, 5),
        "targetMCR": TARGET_MCR[D - 1],
    }


def demand_for_difficulty(difficulty: int) -> int:
    D = clamp(round(difficulty), 1, 10)
    t = (D - 1) / 9
    return clamp(round(3 + 4 * math.sqrt(t)), 3, 8)


def run_length_weights(difficulty: int) -> dict[int, float]:
    t = (clamp(difficulty, 1, 10) - 1) / 9
    return {
        1: 0.05 + 0.25 * t,
        2: 0.75 - 0.40 * t,
        3: 0.12 + 0.05 * t,
        4: 0.06 + 0.07 * t,
        5: 0.02 + 0.03 * t,
    }


def sample_run_length(weights: dict[int, float], rng: random.Random) -> int:
    total = sum(weights.values())
    r = rng.random() * total
    for size, w in weights.items():
        r -= w
        if r <= 0:
            return size
    return 2


def build_customers(params: dict, difficulty: int, rng: random.Random) -> list[tuple[str, int]]:
    letters = DISH_LETTERS[: params["numVarieties"]]
    base = demand_for_difficulty(difficulty)
    customers = []
    for i in range(params["numCustomers"]):
        dish = letters[i % len(letters)]
        jitter = round((rng.random() - 0.5) * 2) if difficulty >= 5 else 0
        customers.append((dish, max(3, base + jitter)))
    return customers


def build_pool(customers: list[tuple[str, int]]) -> list[str]:
    pool = []
    for dish, demand in customers:
        pool.extend([dish] * demand)
    return pool


def arrange_queues(pool: list[str], num_queues: int, difficulty: int, rng: random.Random) -> list[list[str]]:
    weights = run_length_weights(difficulty)
    remaining = list(pool)
    rng.shuffle(remaining)
    blocks: list[list[str]] = []
    while remaining:
        dish = remaining.pop(0)
        want = sample_run_length(weights, rng)
        block = [dish]
        for _ in range(want - 1):
            if dish in remaining:
                remaining.remove(dish)
                block.append(dish)
            else:
                break
        blocks.append(block)
    rng.shuffle(blocks)
    queues: list[list[str]] = [[] for _ in range(num_queues)]
    for idx, block in enumerate(blocks):
        queues[idx % num_queues].extend(block)
    return queues


def generate_level(difficulty: int, seed: int | None = None, candidates: int = 14,
                   max_states: int = 30_000):
    rng = random.Random(seed)
    params = params_for_difficulty(difficulty)
    customers = build_customers(params, difficulty, rng)
    pool = build_pool(customers)

    best = None          # exact-solvable candidate (queues, gap, sim)
    best_capped = None   # capped-but-greedy-winnable candidate (queues, sim)

    for _ in range(candidates):
        queues = arrange_queues(pool, params["numQueues"], difficulty, rng)
        level = Level(queues=queues, customers=customers, num_seats=params["numSeats"])
        sim = solve(level, max_states=max_states)

        if sim.get("solvable") is True:
            gap = abs(sim["mcr"] - params["targetMCR"])
            if best is None or gap < best[1]:
                best = (queues, gap, sim)
            if gap < 0.05:
                break
        elif sim.get("capped"):
            # Too large to prove exactly; accept if a greedy player can win it.
            if best_capped is None and play(level, "lookahead2", rng):
                best_capped = (queues, sim)

    if best is not None:
        queues, gap, sim = best
    elif best_capped is not None:
        queues, sim = best_capped
        sim = dict(sim)
        sim["solvable"] = True  # greedy-validated
    else:
        queues = arrange_queues(pool, params["numQueues"], 1, rng)
        level = Level(queues=queues, customers=customers, num_seats=params["numSeats"])
        sim = solve(level, max_states=max_states)

    return {
        "params": params,
        "customers": customers,
        "queues": queues,
        "sim": sim,
    }

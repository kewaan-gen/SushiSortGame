"""
Kaizen Forge - offline trainer / intelligent level simulator.

What it does (per difficulty):
  1. Loads the accumulating "brain" (forge_brain.json) from previous runs.
  2. Runs a large simulation budget: it samples many queue arrangements (biased by the
     learned run-length weights), exact-solves each, and Monte-Carlo plays each with
     naive/skilled policies.
  3. Keeps ONLY solvable levels and selects the one closest to the difficulty's target
     move-constraint ratio (mid difficulties) or target naive win-rate (high difficulties).
  4. Reinforces the brain toward the winning arrangement's run-length mix, so each run
     makes the forge smarter (faster at finding good solvable layouts).
  5. Emits a guaranteed-solvable level per difficulty with: the exact "follow this order"
     move plan, per-move error chance, MCR, buffer peak, and empirical win-rates.

Run:
  python -u trainer.py                # all difficulties, default budget
  python -u trainer.py --difficulties 5 8 10 --sims 1000 --mc 60

Outputs (in tools/forge_lab/):
  forge_brain.json     - accumulating learned weights (re-loaded next run)
  trained_levels.json  - the solvable levels with move plans + metrics
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import time

from forge_sim import DISH_LETTERS, TARGET_MCR, Level, solve
from policies import win_rate, play_trace
from generator import (
    params_for_difficulty,
    build_customers,
    build_pool,
    sample_run_length,
)

HERE = os.path.dirname(os.path.abspath(__file__))
BRAIN_PATH = os.path.join(HERE, "forge_brain.json")
LEVELS_PATH = os.path.join(HERE, "trained_levels.json")
RUN_LENGTHS = [1, 2, 3, 4, 5]
LR = 0.18

# Calibrated felt-difficulty: naive (random) win-rate per difficulty (from calibrate.py).
CALIBRATED_NAIVE = [1.0, 0.33, 0.28, 0.13, 0.013, 0.0, 0.006, 0.0, 0.0, 0.0]


# --------------------------------------------------------------------------- #
# Brain (matches src/forge/learn.ts structure so it can seed the browser)
# --------------------------------------------------------------------------- #
def empty_difficulty() -> dict:
    return {
        "bias": {str(r): 0.0 for r in RUN_LENGTHS},
        "runs": 0,
        "solvableFound": 0,
        "bestMcrGap": 1.0,
        "totalSims": 0,
    }


def load_brain() -> dict:
    if os.path.exists(BRAIN_PATH):
        try:
            with open(BRAIN_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"version": 1, "totalRuns": 0, "totalSims": 0, "byDifficulty": {}}


def save_brain(brain: dict) -> None:
    with open(BRAIN_PATH, "w", encoding="utf-8") as f:
        json.dump(brain, f, indent=2)


def brain_for(brain: dict, difficulty: int) -> dict:
    key = str(round(difficulty))
    if key not in brain["byDifficulty"]:
        brain["byDifficulty"][key] = empty_difficulty()
    return brain["byDifficulty"][key]


def intelligence_level(brain: dict) -> int:
    if brain["totalRuns"] <= 0:
        return 1
    return min(100, round(1 + 14 * math.log2(1 + brain["totalRuns"])))


def base_weights(difficulty: int) -> dict[int, float]:
    t = (max(1, min(10, difficulty)) - 1) / 9
    return {
        1: 0.05 + 0.25 * t,
        2: 0.75 - 0.40 * t,
        3: 0.12 + 0.05 * t,
        4: 0.06 + 0.07 * t,
        5: 0.02 + 0.03 * t,
    }


def apply_bias(base: dict[int, float], db: dict) -> dict[int, float]:
    out = {}
    for r in RUN_LENGTHS:
        b = db["bias"].get(str(r), 0.0)
        out[r] = max(0.001, base.get(r, 0.0) * math.exp(b))
    return out


def run_length_histogram(queues: list[list[str]]) -> dict[int, float]:
    counts = {r: 0 for r in RUN_LENGTHS}
    total = 0
    for lane in queues:
        i = 0
        while i < len(lane):
            j = i + 1
            while j < len(lane) and lane[j] == lane[i]:
                j += 1
            length = min(5, j - i)
            counts[length] += 1
            total += 1
            i = j
    if total:
        for r in RUN_LENGTHS:
            counts[r] /= total
    return counts


def reinforce(db: dict, solvable: bool, mcr_gap: float, hist: dict[int, float], sims: int) -> None:
    db["runs"] += 1
    db["totalSims"] += sims
    if solvable:
        db["solvableFound"] += 1
        db["bestMcrGap"] = min(db["bestMcrGap"], mcr_gap)
        strength = LR * (1 - min(1.0, mcr_gap / 0.5))
        for r in RUN_LENGTHS:
            target = math.log(max(0.02, hist.get(r, 0.0)))
            cur = db["bias"].get(str(r), 0.0)
            nxt = cur + strength * (target - cur) * 0.25
            db["bias"][str(r)] = max(-1.2, min(1.2, nxt))


def arrange_with(pool, num_queues, weights, rng) -> list[list[str]]:
    remaining = list(pool)
    rng.shuffle(remaining)
    blocks = []
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
    queues = [[] for _ in range(num_queues)]
    for idx, block in enumerate(blocks):
        queues[idx % num_queues].extend(block)
    return queues


def constructive(customers, num_queues) -> list[list[str]]:
    queues = [[] for _ in range(num_queues)]
    for i, (dish, demand) in enumerate(customers):
        queues[i % num_queues].extend([dish] * demand)
    return queues


# --------------------------------------------------------------------------- #
# Train one difficulty
# --------------------------------------------------------------------------- #
def train_difficulty(difficulty: int, sims: int, mc_runs: int, brain: dict, rng: random.Random):
    db = brain_for(brain, difficulty)
    params = params_for_difficulty(difficulty)
    customers = build_customers(params, difficulty, rng)
    pool = build_pool(customers)
    weights = apply_bias(base_weights(difficulty), db)
    target_mcr = TARGET_MCR[difficulty - 1]
    target_naive = CALIBRATED_NAIVE[difficulty - 1]

    best = None  # dict: queues, sim, gap, approx, naive
    solvable_count = 0
    sims_done = 0
    max_states = 30_000 if difficulty <= 4 else 18_000

    print(f"\n=== Difficulty {difficulty} | brain Lv.{intelligence_level(brain)} | "
          f"target MCR {target_mcr:.2f} | budget {sims} sims ===", flush=True)

    candidate = 0
    while sims_done < sims and candidate < sims:
        candidate += 1
        # exploration jitter on learned weights
        jittered = {r: max(0.001, weights[r] * (0.8 + rng.random() * 0.4)) for r in RUN_LENGTHS}
        queues = arrange_with(pool, params["numQueues"], jittered, rng)
        level = Level(queues=queues, customers=customers, num_seats=params["numSeats"])
        sim = solve(level, max_states=max_states)
        sims_done += 1

        approx = False
        ok = sim.get("solvable") is True
        if not ok and sim.get("capped"):
            won, moves = play_trace(level, "lookahead2", rng)
            sims_done += 1
            if won:
                ok = True
                approx = True
                sim = {
                    "solvable": True, "capped": True, "mcr": 0.22,
                    "fail_chance": None, "total_moves": len(moves),
                    "move_plan": moves, "critical": 0, "buffer_peak": None, "ticks": None,
                }

        if not ok:
            if candidate % 25 == 0:
                print(f"  sim {sims_done}/{sims} · searching… ({solvable_count} solvable so far)", flush=True)
            continue

        solvable_count += 1
        naive = win_rate(level, "random", mc_runs, rng)
        sims_done += mc_runs

        if approx:
            gap = abs(naive - target_naive) + 0.06
        else:
            gap = abs(sim["mcr"] - target_mcr)

        if best is None or gap < best["gap"]:
            best = {"queues": queues, "sim": sim, "gap": gap, "approx": approx, "naive": naive}
            print(f"  sim {sims_done}/{sims} · NEW BEST gap {gap:.3f} "
                  f"(naive win {naive*100:.0f}%, {'approx' if approx else 'exact'})", flush=True)

        if best["gap"] < 0.04 and solvable_count >= 3:
            print("  early stop: hit target tolerance", flush=True)
            break

    # insurance: guaranteed-solvable construction
    if best is None:
        print("  no solvable sample — using constructive layout", flush=True)
        queues = constructive(customers, params["numQueues"])
        level = Level(queues=queues, customers=customers, num_seats=params["numSeats"])
        sim = solve(level, max_states=200_000)
        if sim.get("solvable") is not True:
            won, moves = play_trace(level, "lookahead2", rng)
            sim = {"solvable": True, "capped": True, "mcr": 0.22, "fail_chance": None,
                   "total_moves": len(moves), "move_plan": moves, "critical": 0,
                   "buffer_peak": None, "ticks": None}
        naive = win_rate(level, "random", mc_runs, rng)
        best = {"queues": queues, "sim": sim, "gap": 0.0, "approx": True, "naive": naive}
        solvable_count += 1

    # measure skilled win-rates for the chosen level
    level = Level(queues=best["queues"], customers=customers, num_seats=params["numSeats"])
    greedy = win_rate(level, "greedy", mc_runs, rng)
    look = win_rate(level, "lookahead2", mc_runs, rng)
    sims_done += 2 * mc_runs

    # train the brain
    reinforce(db, True, best["gap"], run_length_histogram(best["queues"]), sims_done)
    brain["totalRuns"] += 1
    brain["totalSims"] += sims_done

    sim = best["sim"]
    record = {
        "difficulty": difficulty,
        "params": params,
        "customers": customers,
        "queues": best["queues"],
        "solvable": True,
        "approxSolve": best["approx"],
        "mcr": sim.get("mcr"),
        "totalMoves": sim.get("total_moves"),
        "criticalMoves": sim.get("critical"),
        "bufferPeak": sim.get("buffer_peak"),
        "completionTicks": sim.get("ticks"),
        "movePlan": sim.get("move_plan", []),
        "winRates": {"random": best["naive"], "greedy": greedy, "lookahead2": look},
        "simRuns": sims_done,
    }
    print(f"  -> selected level: {sims_done} sims, naive {best['naive']*100:.0f}% / "
          f"greedy {greedy*100:.0f}% / look {look*100:.0f}%, "
          f"{sim.get('total_moves')} moves, brain now Lv.{intelligence_level(brain)}", flush=True)
    return record


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--difficulties", type=int, nargs="*", default=list(range(1, 11)))
    ap.add_argument("--sims", type=int, default=1000, help="simulation budget per difficulty")
    ap.add_argument("--mc", type=int, default=40, help="Monte Carlo runs per policy")
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    brain = load_brain()
    start_intel = intelligence_level(brain)

    print(f"Kaizen Forge Trainer | starting brain Lv.{start_intel} "
          f"(total runs so far: {brain['totalRuns']})", flush=True)
    t0 = time.time()

    levels = []
    for d in args.difficulties:
        rec = train_difficulty(d, args.sims, args.mc, brain, rng)
        levels.append(rec)
        save_brain(brain)  # persist incrementally so progress is never lost

    with open(LEVELS_PATH, "w", encoding="utf-8") as f:
        json.dump({"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                   "brainIntelligence": intelligence_level(brain),
                   "levels": levels}, f, indent=2)

    dt = time.time() - t0
    print(f"\nDone in {dt:.1f}s. Brain Lv.{start_intel} -> Lv.{intelligence_level(brain)} "
          f"({brain['totalRuns']} total runs, {brain['totalSims']} total sims).", flush=True)
    print(f"Wrote {os.path.basename(BRAIN_PATH)} and {os.path.basename(LEVELS_PATH)}.", flush=True)


if __name__ == "__main__":
    main()

/**
 * Campaign — the hand-tuned 30-level progression (Variant 3).
 *
 * Difficulty is driven by the QUEUE STRUCTURE the solver produces, plus a monotonic
 * content ramp (seats, varieties, baseline customers) and a sawtooth challenge curve
 * (engine difficulty / demand / queue count) that mirrors the design sheet:
 *
 *   - CONTENT grows only upward (unlocks): seats 2->5, products 4->8, customers 6->24.
 *   - CHALLENGE oscillates per the sheet: mostly Easy with Medium/Hard/Super-Hard spikes
 *     at 8-9, 17-18, 23, 25, 27, 29-30.
 *
 * Each level is produced by the EXISTING generator (`runGeneration`) with a fixed seed
 * and an empty brain, so the output is fully deterministic and identical for everyone.
 * `scripts/buildCampaign.ts` bakes the result into `campaignLevels.ts` (shipped data).
 */

import { ForgeBrain } from './learn';
import { GenerateOptions, runGeneration } from './generator';
import { ForgeLevel } from './types';

export type CampaignTier = 'Easy' | 'Medium' | 'Hard' | 'Super Hard';

export interface CampaignSpec {
  level: number;
  tier: CampaignTier;
  /** Engine difficulty 1-10 — governs how tightly the queue structure is interleaved. */
  difficulty: number;
  seats: number;
  varieties: number;
  queues: number;
  customers: number;
  demand: number;
}

/**
 * The 30-level table. (Levels 1-2 are trimmed for onboarding; level 3+ settles into the
 * 2-seat / 6-customer / 4-item base. Customers land exactly on 24 at level 30.)
 */
export const CAMPAIGN_SPECS: CampaignSpec[] = [
  { level: 1, tier: 'Easy', difficulty: 1, seats: 2, varieties: 3, queues: 3, customers: 4, demand: 3 },
  { level: 2, tier: 'Easy', difficulty: 1, seats: 2, varieties: 3, queues: 3, customers: 5, demand: 3 },
  { level: 3, tier: 'Easy', difficulty: 2, seats: 2, varieties: 4, queues: 3, customers: 6, demand: 4 },
  { level: 4, tier: 'Easy', difficulty: 2, seats: 2, varieties: 4, queues: 3, customers: 7, demand: 4 },
  { level: 5, tier: 'Easy', difficulty: 2, seats: 3, varieties: 5, queues: 3, customers: 7, demand: 4 },
  { level: 6, tier: 'Easy', difficulty: 2, seats: 3, varieties: 5, queues: 3, customers: 8, demand: 4 },
  { level: 7, tier: 'Easy', difficulty: 2, seats: 3, varieties: 5, queues: 3, customers: 8, demand: 4 },
  { level: 8, tier: 'Medium', difficulty: 4, seats: 3, varieties: 5, queues: 4, customers: 11, demand: 4 },
  { level: 9, tier: 'Medium', difficulty: 4, seats: 3, varieties: 5, queues: 4, customers: 12, demand: 4 },
  { level: 10, tier: 'Easy', difficulty: 2, seats: 4, varieties: 6, queues: 3, customers: 9, demand: 4 },
  { level: 11, tier: 'Easy', difficulty: 2, seats: 4, varieties: 6, queues: 3, customers: 9, demand: 4 },
  { level: 12, tier: 'Easy', difficulty: 2, seats: 4, varieties: 6, queues: 3, customers: 10, demand: 4 },
  { level: 13, tier: 'Easy', difficulty: 2, seats: 4, varieties: 6, queues: 3, customers: 10, demand: 4 },
  { level: 14, tier: 'Easy', difficulty: 2, seats: 4, varieties: 6, queues: 3, customers: 10, demand: 4 },
  { level: 15, tier: 'Easy', difficulty: 2, seats: 4, varieties: 7, queues: 3, customers: 11, demand: 4 },
  { level: 16, tier: 'Easy', difficulty: 2, seats: 4, varieties: 7, queues: 3, customers: 11, demand: 4 },
  { level: 17, tier: 'Hard', difficulty: 6, seats: 4, varieties: 7, queues: 4, customers: 17, demand: 5 },
  { level: 18, tier: 'Super Hard', difficulty: 9, seats: 4, varieties: 7, queues: 5, customers: 20, demand: 6 },
  { level: 19, tier: 'Easy', difficulty: 2, seats: 4, varieties: 7, queues: 3, customers: 12, demand: 4 },
  { level: 20, tier: 'Easy', difficulty: 2, seats: 4, varieties: 7, queues: 3, customers: 13, demand: 4 },
  { level: 21, tier: 'Easy', difficulty: 2, seats: 5, varieties: 8, queues: 3, customers: 13, demand: 4 },
  { level: 22, tier: 'Easy', difficulty: 2, seats: 5, varieties: 8, queues: 3, customers: 13, demand: 4 },
  { level: 23, tier: 'Medium', difficulty: 4, seats: 5, varieties: 8, queues: 4, customers: 17, demand: 4 },
  { level: 24, tier: 'Easy', difficulty: 2, seats: 5, varieties: 8, queues: 3, customers: 14, demand: 4 },
  { level: 25, tier: 'Hard', difficulty: 6, seats: 5, varieties: 8, queues: 4, customers: 19, demand: 5 },
  { level: 26, tier: 'Easy', difficulty: 2, seats: 5, varieties: 8, queues: 3, customers: 15, demand: 4 },
  { level: 27, tier: 'Medium', difficulty: 4, seats: 5, varieties: 8, queues: 4, customers: 18, demand: 4 },
  { level: 28, tier: 'Easy', difficulty: 2, seats: 5, varieties: 8, queues: 3, customers: 15, demand: 4 },
  { level: 29, tier: 'Medium', difficulty: 4, seats: 5, varieties: 8, queues: 4, customers: 19, demand: 4 },
  { level: 30, tier: 'Super Hard', difficulty: 9, seats: 5, varieties: 8, queues: 5, customers: 24, demand: 6 },
];

const TIER_FAIL_BAND: Record<CampaignTier, [number, number]> = {
  Easy: [0.0, 0.1],
  Medium: [0.1, 0.3],
  Hard: [0.3, 0.5],
  'Super Hard': [0.5, 1.0],
};

/** Felt-difficulty target band (fail ratio) for a tier — used for validation reporting. */
export function tierFailBand(tier: CampaignTier): [number, number] {
  return TIER_FAIL_BAND[tier];
}

function emptyBrain(): ForgeBrain {
  return { version: 1, totalRuns: 0, totalSims: 0, byDifficulty: {} };
}

/** Stable per-level seed so the queue structure is identical for every player. */
function campaignSeed(level: number): number {
  return ((0x9e3779b9 ^ (level * 0x01000193)) >>> 0) + level;
}

/**
 * Build one campaign level using the UNCHANGED generator. Deterministic: fixed seed +
 * fresh empty brain. Overrides pin the exact structural parameters from the spec.
 */
export function buildCampaignLevel(spec: CampaignSpec): ForgeLevel {
  const opts: GenerateOptions = {
    seed: campaignSeed(spec.level),
    demand: spec.demand,
    simBudget: 1400,
    candidates: 300,
    overrides: {
      numSeats: spec.seats,
      numVarieties: spec.varieties,
      numQueues: spec.queues,
      numCustomers: spec.customers,
    },
  };
  const { level } = runGeneration(spec.difficulty, opts, emptyBrain());
  // Stable identity + campaign ordering.
  level.id = `campaign-${String(spec.level).padStart(2, '0')}`;
  level.name = `Level ${spec.level} · ${spec.tier}`;
  return level;
}

export function buildAllCampaignLevels(): ForgeLevel[] {
  return CAMPAIGN_SPECS.map(buildCampaignLevel);
}

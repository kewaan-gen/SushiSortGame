/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SushiVariety = 'maguro' | 'california' | 'kappa' | 'tamago' | 'ebi' | 'salmon' | 'unagi' | 'ikura' | 'saba';

export interface SushiVarietyConfig {
  id: SushiVariety;
  name: string;
  colorCode: string; // Hex or tailwind color class
  plateSilhouette: 'circle' | 'square' | 'dark-circle' | 'triangle' | 'blue-circle';
  plateColor: string; // background color of plate
  visualAnchor: string; // description of visual
  displayName: string;
}

export interface Plate {
  id: string;
  variety: SushiVariety;
  count: number; // 1 to 5 pieces
  injectedSlot: number; // local belt slot index where it entered
  currentSlot: number; // current belt slot index (0 to 11)
  stepsTaken: number; // tracking 360-degree rotation (0 to 12)
  spawnTime?: number; // timestamp when it was launched
}

export interface Customer {
  id: string;
  seatIndex: number; // 0, 1, 2, 3
  characterName: string;
  characterEmoji: string;
  orderedVariety: SushiVariety;
  orderedCount: number; // total items they want to eat
  satisfiedCount: number; // items eaten so far
  state: 'arriving' | 'waiting' | 'eating' | 'satisfied' | 'leaving';
  bowlCount: number; // visual stack of empty bowls
  chopstickTicks: number; // for strike animations
}

export interface CustomerOrderTemplate {
  characterName: string;
  characterEmoji: string;
  orderedVariety: SushiVariety;
  orderedCount: number;
}

export interface GameState {
  score: number;
  coins: number;
  level: number;
  beltPlates: Plate[]; // plates on the conveyor belt (slots 0 to 11)
  freeSlots: (Plate | null)[]; // size 4, or 5 if extended
  queues: Plate[][]; // 3 queues at the bottom, each is a list of Plates
  customers: (Customer | null)[]; // 4 seats
  isGameOver: boolean;
  isGameVictory?: boolean;
  hasUnlockedFifthSlot: boolean;
  customersServed: number;
  totalCustomersRequired: number;
  beltSpeed: number; // interval in ms (e.g., 2000ms, decreases as difficulty increases)
  levelCustomersTemplates: CustomerOrderTemplate[];
  nextCustomerIndex: number;
}

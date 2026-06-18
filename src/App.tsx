/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plate, Customer, SushiVariety, GameState, CustomerOrderTemplate } from './types';
import { SUSHI_VARIETIES, CHARACTER_EMOJIS, SUSHI_VARIETIES as configMap } from './sushiConfig';
import { CustomerSeat } from './components/CustomerSeat';
import { ConveyorBelt } from './components/ConveyorBelt';
import { FreeBuffer } from './components/FreeBuffer';
import { QueueDispenser } from './components/QueueDispenser';
import { PlateTransferOverlay, PlateTransferFlight } from './components/PlateTransferOverlay';
import { SushiPlate } from './components/SushiPlate';
import { MainMenu } from './components/MainMenu';
import { sfx } from './utils/audio';
import {
  getElementCenterInPlayfield,
  getBeltSlotCenterInPlayfield,
} from './utils/plateAnchors';
import { 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  RotateCcw, 
  Coins, 
  Trophy, 
  Sparkles, 
  Award,
  Play,
  Flame,
  CheckCircle,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ALL_VARIETIES: SushiVariety[] = [
  'maguro',      // Red
  'california',  // Purple
  'kappa',       // Green
  'tamago',      // Yellow
  'ebi',         // Blue
  'salmon',      // Orange
  'unagi',       // Pink
  'ikura',       // Teal
  'saba',        // Slate/Gray
];

const LEVEL_CONFIGS: {
  levelNumber: number;
  templates: CustomerOrderTemplate[];
}[] = [
  {
    levelNumber: 1,
    templates: [
      { characterEmoji: '🐱', characterName: 'Neko-san', orderedVariety: 'maguro', orderedCount: 4 },
      { characterEmoji: '🦊', characterName: 'Kitsune-sama', orderedVariety: 'kappa', orderedCount: 4 },
      { characterEmoji: '🐻', characterName: 'Kuma-chan', orderedVariety: 'tamago', orderedCount: 4 },
      { characterEmoji: '🐰', characterName: 'Usagi-chan', orderedVariety: 'maguro', orderedCount: 4 },
      { characterEmoji: '🐼', characterName: 'Panda-dono', orderedVariety: 'kappa', orderedCount: 4 },
      { characterEmoji: '🐸', characterName: 'Kaeru-sama', orderedVariety: 'tamago', orderedCount: 4 },
    ],
  },
  {
    levelNumber: 2,
    templates: [
      { characterEmoji: '🐱', characterName: 'Neko-san', orderedVariety: 'maguro', orderedCount: 4 },
      { characterEmoji: '🦊', characterName: 'Kitsune-sama', orderedVariety: 'california', orderedCount: 4 },
      { characterEmoji: '🐻', characterName: 'Kuma-chan', orderedVariety: 'tamago', orderedCount: 6 },
      { characterEmoji: '🐼', characterName: 'Panda-dono', orderedVariety: 'kappa', orderedCount: 4 },
      { characterEmoji: '🐰', characterName: 'Usagi-chan', orderedVariety: 'california', orderedCount: 4 },
      { characterEmoji: '🦁', characterName: 'Leo-sensei', orderedVariety: 'maguro', orderedCount: 6 },
      { characterEmoji: '🐵', characterName: 'Saru-kun', orderedVariety: 'tamago', orderedCount: 4 },
      { characterEmoji: '🐸', characterName: 'Kaeru-sama', orderedVariety: 'kappa', orderedCount: 4 },
    ],
  },
  {
    levelNumber: 3,
    templates: [
      { characterEmoji: '🐱', characterName: 'Neko-san', orderedVariety: 'maguro', orderedCount: 6 },
      { characterEmoji: '🦊', characterName: 'Kitsune-sama', orderedVariety: 'california', orderedCount: 4 },
      { characterEmoji: '🐻', characterName: 'Kuma-chan', orderedVariety: 'ebi', orderedCount: 6 },
      { characterEmoji: '🐼', characterName: 'Panda-dono', orderedVariety: 'tamago', orderedCount: 4 },
      { characterEmoji: '🐰', characterName: 'Usagi-chan', orderedVariety: 'kappa', orderedCount: 6 },
      { characterEmoji: '🦁', characterName: 'Leo-sensei', orderedVariety: 'maguro', orderedCount: 4 },
      { characterEmoji: '🐵', characterName: 'Saru-kun', orderedVariety: 'ebi', orderedCount: 4 },
      { characterEmoji: '🐸', characterName: 'Kaeru-sama', orderedVariety: 'california', orderedCount: 6 },
    ],
  },
  {
    levelNumber: 4,
    templates: [
      { characterEmoji: '🐱', characterName: 'Neko-san', orderedVariety: 'salmon', orderedCount: 6 },
      { characterEmoji: '🦊', characterName: 'Kitsune-sama', orderedVariety: 'california', orderedCount: 4 },
      { characterEmoji: '🐻', characterName: 'Kuma-chan', orderedVariety: 'tamago', orderedCount: 8 },
      { characterEmoji: '🐼', characterName: 'Panda-dono', orderedVariety: 'ebi', orderedCount: 4 },
      { characterEmoji: '🐰', characterName: 'Usagi-chan', orderedVariety: 'kappa', orderedCount: 6 },
      { characterEmoji: '🦁', characterName: 'Leo-sensei', orderedVariety: 'maguro', orderedCount: 6 },
      { characterEmoji: '🐵', characterName: 'Saru-kun', orderedVariety: 'salmon', orderedCount: 4 },
      { characterEmoji: '🐸', characterName: 'Kaeru-sama', orderedVariety: 'california', orderedCount: 6 },
      { characterEmoji: '🐱', characterName: 'Neko-san', orderedVariety: 'tamago', orderedCount: 4 },
      { characterEmoji: '🦊', characterName: 'Kitsune-sama', orderedVariety: 'ebi', orderedCount: 4 },
    ],
  },
  {
    levelNumber: 5,
    templates: [
      { characterEmoji: '🐱', characterName: 'Neko-san', orderedVariety: 'maguro', orderedCount: 6 },
      { characterEmoji: '🦊', characterName: 'Kitsune-sama', orderedVariety: 'unagi', orderedCount: 4 },
      { characterEmoji: '🐻', characterName: 'Kuma-chan', orderedVariety: 'ikura', orderedCount: 6 },
      { characterEmoji: '🐼', characterName: 'Panda-dono', orderedVariety: 'salmon', orderedCount: 6 },
      { characterEmoji: '🐰', characterName: 'Usagi-chan', orderedVariety: 'ebi', orderedCount: 4 },
      { characterEmoji: '🦁', characterName: 'Leo-sensei', orderedVariety: 'california', orderedCount: 6 },
      { characterEmoji: '🐵', characterName: 'Saru-kun', orderedVariety: 'kappa', orderedCount: 6 },
      { characterEmoji: '🐸', characterName: 'Kaeru-sama', orderedVariety: 'tamago', orderedCount: 6 },
      { characterEmoji: '🐱', characterName: 'Neko-san', orderedVariety: 'unagi', orderedCount: 4 },
      { characterEmoji: '🦊', characterName: 'Kitsune-sama', orderedVariety: 'ikura', orderedCount: 4 },
      { characterEmoji: '🐻', characterName: 'Kuma-chan', orderedVariety: 'salmon', orderedCount: 6 },
      { characterEmoji: '🐼', characterName: 'Panda-dono', orderedVariety: 'maguro', orderedCount: 4 },
    ],
  },
];

const shuffleArray = <T,>(arr: T[]): T[] => {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const createPlate = (variety: SushiVariety): Plate => ({
  id: `plate-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 5)}`,
  variety,
  count: 1,
  injectedSlot: -1,
  currentSlot: -1,
  stepsTaken: 0,
});

const getTotalDishesRequired = (templates: CustomerOrderTemplate[]): number =>
  templates.reduce((sum, t) => sum + t.orderedCount, 0);

const countPlatesInQueues = (queues: Plate[][]): number =>
  queues.reduce((sum, col) => sum + col.length, 0);

const countAllPlatesInPlay = (
  queues: Plate[][],
  beltPlates: Plate[],
  freeSlots: (Plate | null)[],
): number =>
  countPlatesInQueues(queues) + beltPlates.length + freeSlots.filter(Boolean).length;

/** Build pairs of 2 identical plates for even-count demand */
const buildPairBlocks = (variety: SushiVariety, count: number): Plate[][] => {
  const blocks: Plate[][] = [];
  for (let i = 0; i < count; i += 2) {
    blocks.push([createPlate(variety), createPlate(variety)]);
  }
  return blocks;
};

/** Exact supply in pairs of 2 — total plates = sum of all customer orderedCount */
const buildQueuesFromTemplates = (
  templates: CustomerOrderTemplate[],
  numQueues = 3,
): Plate[][] => {
  const blocks: Plate[][] = [];
  for (const template of templates) {
    blocks.push(...buildPairBlocks(template.orderedVariety, template.orderedCount));
  }
  const shuffledBlocks = shuffleArray(blocks);
  const queues = Array.from({ length: numQueues }, () => [] as Plate[]);
  shuffledBlocks.forEach((block, idx) => {
    queues[idx % numQueues].push(...block);
  });
  return queues;
};

const buildQueuesFromDemands = (
  demands: { dishId: number; quantity: number }[],
  numQueues: number,
): Plate[][] => {
  const blocks: Plate[][] = [];
  for (const demand of demands) {
    const variety = ALL_VARIETIES[demand.dishId % ALL_VARIETIES.length];
    const qty = Math.max(2, Math.round(demand.quantity / 2) * 2);
    blocks.push(...buildPairBlocks(variety, qty));
  }
  const shuffledBlocks = shuffleArray(blocks);
  const queues = Array.from({ length: numQueues }, () => [] as Plate[]);
  shuffledBlocks.forEach((block, idx) => {
    queues[idx % numQueues].push(...block);
  });
  return queues;
};

const getRemainingVarietyDemand = (
  customers: (Customer | null)[],
  templates: CustomerOrderTemplate[],
  nextCustomerIndex: number,
): Map<SushiVariety, number> => {
  const demand = new Map<SushiVariety, number>();
  const add = (variety: SushiVariety, count: number) => {
    if (count <= 0) return;
    demand.set(variety, (demand.get(variety) || 0) + count);
  };

  for (const c of customers) {
    if (!c || c.state === 'satisfied' || c.state === 'leaving') continue;
    add(c.orderedVariety, c.orderedCount - c.satisfiedCount);
  }
  for (let i = nextCustomerIndex; i < templates.length; i++) {
    add(templates[i].orderedVariety, templates[i].orderedCount);
  }
  return demand;
};

/** Remove plates whose variety no customer still needs — stops junk filling belt/buffer */
const purgeOrphanPlates = (state: GameState): GameState => {
  const demand = getRemainingVarietyDemand(
    state.customers,
    state.levelCustomersTemplates,
    state.nextCustomerIndex,
  );
  const isNeeded = (variety: SushiVariety) => (demand.get(variety) || 0) > 0;

  const queues = state.queues.map((col) => col.filter((p) => isNeeded(p.variety)));
  const beltPlates = state.beltPlates.filter((p) => isNeeded(p.variety));
  const freeSlots = state.freeSlots.map((slot) => (slot && isNeeded(slot.variety) ? slot : null));

  const platesBefore =
    countPlatesInQueues(state.queues) + state.beltPlates.length + state.freeSlots.filter(Boolean).length;
  const platesAfter =
    countPlatesInQueues(queues) + beltPlates.length + freeSlots.filter(Boolean).length;
  const purged = platesBefore - platesAfter;

  return {
    ...state,
    queues,
    beltPlates,
    freeSlots,
    totalDishesRequired: Math.max(state.dishesConsumed, state.totalDishesRequired - purged),
  };
};

const getTotalRemainingDemand = (
  customers: (Customer | null)[],
  templates: CustomerOrderTemplate[],
  nextCustomerIndex: number,
): number => {
  const demand = getRemainingVarietyDemand(customers, templates, nextCustomerIndex);
  let sum = 0;
  demand.forEach((count) => {
    sum += count;
  });
  return sum;
};

const getTotalDemandFromDemands = (demands: { quantity: number }[]): number =>
  demands.reduce((sum, d) => sum + d.quantity, 0);

const initializeLevelData = (level: number) => {
  // Grab configuration looping if exceeded (though we end game at lvl 5)
  const configIndex = (level - 1) % LEVEL_CONFIGS.length;
  const config = LEVEL_CONFIGS[configIndex];

  const totalCustomersRequired = config.templates.length;
  const levelCustomersTemplates = config.templates;
  const totalDishesRequired = getTotalDishesRequired(levelCustomersTemplates);
  const queues = buildQueuesFromTemplates(levelCustomersTemplates, 3);

  const initialCustomers: (Customer | null)[] = [null, null, null, null];
  for (let s = 0; s < 4; s++) {
    if (totalCustomersRequired > s && levelCustomersTemplates[s]) {
      const t = levelCustomersTemplates[s];
      initialCustomers[s] = {
        id: `cust-${s}-${Math.random().toString(36).substring(2, 7)}`,
        seatIndex: s,
        characterName: t.characterName,
        characterEmoji: t.characterEmoji,
        orderedVariety: t.orderedVariety,
        orderedCount: t.orderedCount,
        satisfiedCount: 0,
        state: 'arriving',
        bowlCount: 0,
        chopstickTicks: 0,
      };
    }
  }

  return {
    totalCustomersRequired,
    totalDishesRequired,
    levelCustomersTemplates,
    queues,
    customers: initialCustomers,
    nextCustomerIndex: totalCustomersRequired > 4 ? 4 : totalCustomersRequired,
  };
};

const INITIAL_LEVEL = 1;

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const lData = initializeLevelData(1);
    return {
      score: 0,
      coins: 100, // Starts with some spending coins
      level: 1,
      beltPlates: [],
      freeSlots: Array(5).fill(null), // Slot index 4 is the locked fifth slot
      hasUnlockedFifthSlot: false,
      queues: lData.queues,
      customers: lData.customers,
      isGameOver: false,
      customersServed: 0,
      totalCustomersRequired: lData.totalCustomersRequired,
      totalDishesRequired: lData.totalDishesRequired,
      dishesConsumed: 0,
      levelCustomersTemplates: lData.levelCustomersTemplates,
      nextCustomerIndex: lData.nextCustomerIndex,
      beltSpeed: 850,
    };
  });

  const [isMuted, setIsMuted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [hasFirstLaunch, setHasFirstLaunch] = useState(false);
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const [showAdSpinner, setShowAdSpinner] = useState(false);
  const beltSpeedRef = useRef(gameState.beltSpeed);
  beltSpeedRef.current = gameState.beltSpeed;

  const platePlayfieldRef = useRef<HTMLDivElement>(null);
  const transferHandlersRef = useRef<Map<string, () => void>>(new Map());
  const reservedDockSlotsRef = useRef<Set<number>>(new Set());
  const inflightBeltSlotsRef = useRef<Set<number>>(new Set());
  const [activeTransfers, setActiveTransfers] = useState<PlateTransferFlight[]>([]);
  
  const [gameMode, setGameMode] = useState<'menu' | 'zen' | 'tweak'>('menu');
  const [isSimPaused, setIsSimPaused] = useState(false);
  const [dockCrashThreshold, setDockCrashThreshold] = useState(5);
  const [total360Rotations, setTotal360Rotations] = useState(0);
  const [zenBaseBeltSpeed, setZenBaseBeltSpeed] = useState(850);
  const [zenTimeToEat, setZenTimeToEat] = useState(50);

  // NEW TWEAK / LEVEL BUILDER STATES
  const [tweakNumCustomers, setTweakNumCustomers] = useState<number>(8);
  const [tweakNumDishTypes, setTweakNumDishTypes] = useState<number>(3);
  const [tweakCustomerDemands, setTweakCustomerDemands] = useState<{dishId: number; quantity: number}[]>(() => {
    return Array.from({ length: 24 }).map((_, idx) => ({
      dishId: idx % 3,
      quantity: 4,
    }));
  });

  // Keep customer demands synchronized with changes in tweakNumCustomers
  useEffect(() => {
    setTweakCustomerDemands(prev => {
      const copy = [...prev];
      if (copy.length < tweakNumCustomers) {
        for (let i = copy.length; i < tweakNumCustomers; i++) {
          copy.push({ dishId: i % tweakNumDishTypes, quantity: 4 });
        }
      }
      return copy;
    });
  }, [tweakNumCustomers, tweakNumDishTypes]);

  const [tweakNumBeltSlots, setTweakNumBeltSlots] = useState<number>(12);
  const [tweakNumSeats, setTweakNumSeats] = useState<number>(4);
  const [tweakNumFreeDocks, setTweakNumFreeDocks] = useState<number>(5);

  const [tweakTimeToEat, setTweakTimeToEat] = useState<number>(50);
  const [tweakBeltSpeed, setTweakBeltSpeed] = useState<number>(1150);
  const [tweakTimeToLeave, setTweakTimeToLeave] = useState<number>(1500);
  const [tweakSpawnFrequency, setTweakSpawnFrequency] = useState<number>(1000);

  const [tweakNumQueues, setTweakNumQueues] = useState<number>(3);
  const [tweakGeneratedQueues, setTweakGeneratedQueues] = useState<any[][]>([]);

  // Pre-cached original varieties list for reference inside the sandbox environment
  const ALL_VARIETIES: any[] = ['maguro', 'california', 'kappa', 'tamago', 'ebi', 'salmon', 'unagi', 'ikura', 'saba'];

  const getSeatSlots = (seatsCount: number): number[] => {
    if (seatsCount === 2) return [10, 4];
    if (seatsCount === 3) return [10, 7, 4];
    if (seatsCount === 4) return [10, 11, 5, 4];
    if (seatsCount === 5) return [10, 11, 8, 5, 4];
    if (seatsCount === 6) return [10, 11, 8, 7, 5, 4];
    if (seatsCount === 7) return [10, 11, 9, 8, 6, 5, 4];
    return [10, 11, 9, 8, 7, 6, 5, 4]; // 8 seats
  };

  const [savedLevels, setSavedLevels] = useState<any[]>(() => {
    const defaultLevels = [
      {
        id: 'sample-lvl-1',
        name: '🍣 Sandbox Challenge 1',
        numCustomers: 6,
        numDishTypes: 3,
        customerDemands: [
          { dishId: 0, quantity: 4 },
          { dishId: 1, quantity: 4 },
          { dishId: 2, quantity: 4 },
          { dishId: 0, quantity: 4 },
          { dishId: 1, quantity: 4 },
          { dishId: 2, quantity: 4 },
        ],
        numBeltSlots: 12,
        numSeats: 4,
        numFreeDocks: 5,
        timeToEat: 2000,
        beltSpeed: 1150,
        timeToLeave: 1500,
        spawnFrequency: 1000,
        numQueues: 3,
      },
      {
        id: 'sample-lvl-2',
        name: '⚡ Speed Run Sprint',
        numCustomers: 8,
        numDishTypes: 4,
        customerDemands: [
          { dishId: 0, quantity: 4 }, { dishId: 1, quantity: 4 }, { dishId: 2, quantity: 4 }, { dishId: 3, quantity: 4 },
          { dishId: 0, quantity: 6 }, { dishId: 1, quantity: 6 }, { dishId: 2, quantity: 6 }, { dishId: 3, quantity: 6 },
        ],
        numBeltSlots: 12,
        numSeats: 4,
        numFreeDocks: 5,
        timeToEat: 1500,
        beltSpeed: 600,
        timeToLeave: 1000,
        spawnFrequency: 800,
        numQueues: 3,
      },
    ];

    try {
      const saved = localStorage.getItem('kaizen_saved_levels');
      if (saved) {
        const parsed = JSON.parse(saved) as any[];
        return parsed.map((level) => ({
          ...level,
          queues: buildQueuesFromDemands(
            (level.customerDemands || []).slice(0, level.numCustomers || 0),
            level.numQueues || 3,
          ),
        }));
      }
    } catch (e) {
      // ignore
    }

    return defaultLevels.map((level) => ({
      ...level,
      queues: buildQueuesFromDemands(level.customerDemands, level.numQueues),
    }));
  });

  const [activeCustomLevel, setActiveCustomLevel] = useState<any | null>(null);

  // TWEAK / SANDBOX SIMULATIVE HELPERS & ACTION HANDLERS
  const isBeltSlotOccupied = (slotIdx: number) =>
    gameState.beltPlates.some((p) => p.currentSlot === slotIdx) ||
    inflightBeltSlotsRef.current.has(slotIdx);

  // Dynamically computed total target dishes required in real-time
  const totalPerDish: Record<number, number> = {};
  for (let i = 0; i < tweakNumCustomers; i++) {
    const demand = tweakCustomerDemands[i] || { dishId: i % tweakNumDishTypes, quantity: 4 };
    totalPerDish[demand.dishId] = (totalPerDish[demand.dishId] || 0) + demand.quantity;
  }

  const handleCompileTweakQueues = () => {
    const demands = tweakCustomerDemands.slice(0, tweakNumCustomers);
    const qs = buildQueuesFromDemands(demands, tweakNumQueues);
    const totalItems = getTotalDemandFromDemands(demands);

    setTweakGeneratedQueues(qs);
    triggerNotification(`Lanes compiled! Total items: ${totalItems}`);
  };

  const handleGenerateTweakLevel = () => {
    const demands = tweakCustomerDemands.slice(0, tweakNumCustomers);
    const activeQueues = buildQueuesFromDemands(demands, tweakNumQueues);
    setTweakGeneratedQueues(activeQueues);

    const customLevelObj = {
      id: `custom-lvl-${Date.now()}`,
      name: `🛠️ CUSTOM LEVEL #${savedLevels.length + 1}`,
      numCustomers: tweakNumCustomers,
      numDishTypes: tweakNumDishTypes,
      customerDemands: tweakCustomerDemands.slice(0, tweakNumCustomers),
      numBeltSlots: tweakNumBeltSlots,
      numSeats: tweakNumSeats,
      numFreeDocks: tweakNumFreeDocks,
      timeToEat: tweakTimeToEat,
      beltSpeed: tweakBeltSpeed,
      timeToLeave: tweakTimeToLeave,
      spawnFrequency: tweakSpawnFrequency,
      numQueues: tweakNumQueues,
      queues: activeQueues,
    };

    const updatedList = [...savedLevels, customLevelObj];
    setSavedLevels(updatedList);
    try {
      localStorage.setItem('kaizen_saved_levels', JSON.stringify(updatedList));
    } catch (e) {
      // ignore
    }
    triggerNotification('New Custom Sandbox Level Saved!');
  };

  const handlePlaySavedLevel = (levelConf: any) => {
    sfx.playCoinDing();
    setIsSimPaused(false); // Unpause simulation to run tick state
    setActiveCustomLevel(levelConf);

    // Generate real level customers templates
    const levelCustomersTemplates: CustomerOrderTemplate[] = levelConf.customerDemands.slice(0, levelConf.numCustomers).map((item: any, idx: number) => {
      const variety = ALL_VARIETIES[item.dishId % ALL_VARIETIES.length];
      const emojiNameOption = CHARACTER_EMOJIS[idx % CHARACTER_EMOJIS.length];
      return {
        characterName: emojiNameOption.name,
        characterEmoji: emojiNameOption.emoji,
        orderedVariety: variety,
        orderedCount: item.quantity,
      };
    });

    const compiledQueues = buildQueuesFromDemands(
      levelConf.customerDemands.slice(0, levelConf.numCustomers),
      levelConf.numQueues,
    );

    // Populate actual active customer seats
    const initialCustomers: (Customer | null)[] = Array(levelConf.numSeats).fill(null);
    for (let s = 0; s < levelConf.numSeats; s++) {
      if (levelCustomersTemplates.length > s) {
        const t = levelCustomersTemplates[s];
        initialCustomers[s] = {
          id: `cust-${s}-${Math.random().toString(36).substring(2, 7)}`,
          seatIndex: s,
          characterName: t.characterName,
          characterEmoji: t.characterEmoji,
          orderedVariety: t.orderedVariety,
          orderedCount: t.orderedCount,
          satisfiedCount: 0,
          state: 'arriving', // Stream in!
          bowlCount: 0,
          chopstickTicks: 0,
        };
      }
    }

    setGameState({
      score: 0,
      coins: 100,
      level: 1, // level identifier
      beltPlates: [],
      freeSlots: Array(levelConf.numFreeDocks).fill(null),
      hasUnlockedFifthSlot: levelConf.numFreeDocks > 4,
      queues: compiledQueues,
      customers: initialCustomers,
      isGameOver: false,
      isGameVictory: false,
      customersServed: 0,
      totalCustomersRequired: levelCustomersTemplates.length,
      totalDishesRequired: getTotalDishesRequired(levelCustomersTemplates),
      dishesConsumed: 0,
      levelCustomersTemplates: levelCustomersTemplates,
      nextCustomerIndex: levelCustomersTemplates.length > levelConf.numSeats ? levelConf.numSeats : levelCustomersTemplates.length,
      beltSpeed: levelConf.beltSpeed,
    });

    // Save active level config values to state variables so user can tweak them
    setTweakNumCustomers(levelConf.numCustomers);
    setTweakNumDishTypes(levelConf.numDishTypes);
    setTweakNumSeats(levelConf.numSeats);
    setTweakNumFreeDocks(levelConf.numFreeDocks);
    setTweakTimeToEat(levelConf.timeToEat);
    setTweakBeltSpeed(levelConf.beltSpeed);
    setTweakTimeToLeave(levelConf.timeToLeave);
    setTweakSpawnFrequency(levelConf.spawnFrequency);
    setTweakNumQueues(levelConf.numQueues);
    setTweakGeneratedQueues(compiledQueues);

    triggerNotification(`Level "${levelConf.name}" Locked & Loaded!`);
  };

  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('kaizen_high_score') || '0', 10);
    } catch {
      return 0;
    }
  });

  // Keep track of high score
  useEffect(() => {
    if (gameState.score > highScore) {
      setHighScore(gameState.score);
      try {
        localStorage.setItem('kaizen_high_score', gameState.score.toString());
      } catch (e) {
        // ignore
      }
    }
  }, [gameState.score, highScore]);

  // Feedback highlights
  const [beltWarnings, setBeltWarnings] = useState<number[]>([]);
  const [scoreNotification, setScoreNotification] = useState<{ text: string; id: number } | null>(null);

  // References to handle accurate timing
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  // Sound toggle helper
  const handleToggleMute = () => {
    const muted = sfx.toggleMute();
    setIsMuted(muted);
  };

  // Trigger floating notifications
  const triggerNotification = (text: string) => {
    setScoreNotification({ text, id: Date.now() });
    setTimeout(() => {
      setScoreNotification(null);
    }, 1500);
  };

  // Initial setup: Spawn new customers
  useEffect(() => {
    // Level 1 data is preloaded during initial useState, so this remains idle.
  }, []);

  // Main conveyor belt loop tick — recursive timeout reads beltSpeedRef so speed
  // changes (zen decay / tap turbo) never cancel an in-flight tick window
  useEffect(() => {
    if (gameState.isGameOver || levelUpMessage || showTutorial || showAdSpinner || isSimPaused) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleTick = () => {
      timeoutId = setTimeout(() => {
        tickConveyorBelt();
        scheduleTick();
      }, beltSpeedRef.current);
    };
    scheduleTick();

    return () => clearTimeout(timeoutId);
  }, [
    gameState.isGameOver,
    levelUpMessage,
    showTutorial,
    showAdSpinner,
    isSimPaused,
  ]);

  // Zen Mode speed decay: smoothly recovers original baseline speed
  useEffect(() => {
    if (gameMode !== 'zen' || gameState.isGameOver || levelUpMessage || showTutorial || showAdSpinner || isSimPaused) return;

    const interval = setInterval(() => {
      setGameState((prev) => {
        const baseSpeed = zenBaseBeltSpeed;
        if (prev.beltSpeed >= baseSpeed) return prev;

        const nextSpeed = Math.round(Math.min(baseSpeed, prev.beltSpeed + (baseSpeed - prev.beltSpeed) * 0.12));
        return {
          ...prev,
          beltSpeed: nextSpeed,
        };
      });
    }, 150);

    return () => clearInterval(interval);
  }, [
    gameMode,
    zenBaseBeltSpeed,
    gameState.isGameOver,
    levelUpMessage,
    showTutorial,
    showAdSpinner,
    isSimPaused
  ]);

  // Reactive level-up trigger: all diners served AND no remaining customer demand
  useEffect(() => {
    if (gameState.isGameOver || levelUpMessage || showTutorial || showAdSpinner || gameMode === 'menu') return;

    const allDinersComplete =
      gameState.customersServed >= gameState.totalCustomersRequired &&
      gameState.nextCustomerIndex >= gameState.levelCustomersTemplates.length;
    const remainingDemand = getTotalRemainingDemand(
      gameState.customers,
      gameState.levelCustomersTemplates,
      gameState.nextCustomerIndex,
    );

    if (!allDinersComplete || remainingDemand > 0) return;

    const platesRemaining = countAllPlatesInPlay(
      gameState.queues,
      gameState.beltPlates,
      gameState.freeSlots,
    );

    // When every diner is satisfied, any leftover plates are surplus — clear them so the station can close
    if (platesRemaining > 0) {
      triggerNotification('Surplus dishes cleared — station closing!');
      setGameState((prev) => ({
        ...prev,
        beltPlates: [],
        queues: prev.queues.map(() => [] as Plate[]),
        freeSlots: prev.freeSlots.map(() => null),
      }));
      return;
    }

    const timer = setTimeout(() => {
      if (gameMode === 'tweak') {
        setIsSimPaused(true);
        setGameState((prev) => ({
          ...prev,
          isGameVictory: true,
        }));
      } else {
        triggerLevelUp(gameState.level + 1);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    gameState.customersServed,
    gameState.totalCustomersRequired,
    gameState.customers,
    gameState.nextCustomerIndex,
    gameState.levelCustomersTemplates,
    gameState.beltPlates,
    gameState.queues,
    gameState.freeSlots,
    gameState.isGameOver,
    levelUpMessage,
    showTutorial,
    showAdSpinner,
    gameMode,
    gameState.level,
  ]);

  // Automatically progress 'arriving' customers to 'waiting' in tweak mode
  useEffect(() => {
    if (gameMode !== 'tweak') return;
    const arrivingSeatIndexes = gameState.customers
      .map((c, idx) => (c && c.state === 'arriving' ? idx : -1))
      .filter((idx) => idx !== -1);

    if (arrivingSeatIndexes.length === 0) return;

    const timers = arrivingSeatIndexes.map((seatIndex) => {
      return setTimeout(() => {
        handleCustomerArrived(seatIndex);
      }, tweakSpawnFrequency);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [gameState.customers, gameMode]);

  // Spawn a new customer at a target seat
  const spawnCustomer = (seatIndex: number, currentLevel: number): Customer => {
    const varieties: SushiVariety[] = ['maguro', 'california', 'kappa', 'tamago', 'ebi', 'salmon'];
    const orderedVariety = varieties[Math.floor(Math.random() * varieties.length)];
    const orderedCount = 3; // 1 customer wants exactly 3 dishes, with 2s eating delay

    const charChoice = CHARACTER_EMOJIS[Math.floor(Math.random() * CHARACTER_EMOJIS.length)];

    return {
      id: `cust-${Math.random().toString(36).substring(2, 9)}`,
      seatIndex,
      characterName: charChoice.name,
      characterEmoji: charChoice.emoji,
      orderedVariety,
      orderedCount,
      satisfiedCount: 0,
      state: 'arriving', // Walks into the restaurant through sliding Shōji doors!
      bowlCount: 0,
      chopstickTicks: 0,
    };
  };

  // Main ticking logic: moves plates anti-clockwise and resolves overflows/matches
  const plateAnimVariant = (): 'classic' | 'zen' | 'tweak' =>
    gameMode === 'tweak' ? 'tweak' : gameMode === 'zen' ? 'zen' : 'classic';

  const plateAnimSize = (context: 'queue' | 'belt' | 'dock') => {
    const variant = plateAnimVariant();
    if (context === 'queue') return variant === 'zen' ? 48 : variant === 'tweak' ? 34 : 38;
    if (context === 'belt') return variant === 'zen' ? 40 : variant === 'tweak' ? 32 : 36;
    return variant === 'zen' ? 42 : variant === 'tweak' ? 34 : 38;
  };

  const runPlateTransfer = (flight: PlateTransferFlight, onComplete: () => void) => {
    transferHandlersRef.current.set(flight.key, onComplete);
    setActiveTransfers((prev) => [...prev, flight]);
  };

  const handleTransferComplete = (key: string) => {
    setActiveTransfers((prev) => prev.filter((t) => t.key !== key));
    const handler = transferHandlersRef.current.get(key);
    transferHandlersRef.current.delete(key);
    handler?.();
  };

  const startBeltToDockTransfer = (plate: Plate, dockIdx: number, fromSlot: number) => {
    const playfield = platePlayfieldRef.current;
    const beltFrame = document.getElementById('conveyor-belt-frame');
    const dockEl = playfield?.querySelector(`[data-buffer-slot="${dockIdx}"]`);

    const finishDock = () => {
      reservedDockSlotsRef.current.delete(dockIdx);
      setGameState((prev) => {
        const newFreeSlots = [...prev.freeSlots];
        newFreeSlots[dockIdx] = plate;
        return { ...prev, freeSlots: newFreeSlots };
      });
    };

    reservedDockSlotsRef.current.add(dockIdx);

    if (!playfield || !beltFrame || !dockEl) {
      finishDock();
      return;
    }

    runPlateTransfer(
      {
        key: `b2d-${plate.id}-${Date.now()}`,
        variety: plate.variety,
        count: plate.count,
        from: getBeltSlotCenterInPlayfield(playfield, beltFrame, fromSlot),
        to: getElementCenterInPlayfield(playfield, dockEl as HTMLElement),
        size: plateAnimSize('belt'),
        variant: plateAnimVariant(),
      },
      finishDock,
    );
  };

  const tickConveyorBelt = () => {
    let pendingDockTransfers: { plate: Plate; dockIdx: number; fromSlot: number }[] = [];

    setGameState((prev) => {
      if (prev.isGameOver) return prev;

      // 1. Move plates forward counter-clockwise
      const updatedPlates: Plate[] = [];
      const overflowedPlates: Plate[] = [];

      for (const plate of prev.beltPlates) {
        const nextSteps = plate.stepsTaken + 1;
        const nextSlot = (plate.currentSlot + 1) % 12;

        if (nextSteps >= 12) {
          // Plate completed full 360-degree rotation! Pushed off-belt
          overflowedPlates.push({
            ...plate,
            stepsTaken: nextSteps,
            currentSlot: -1,
          });
        } else {
          updatedPlates.push({
            ...plate,
            stepsTaken: nextSteps,
            currentSlot: nextSlot,
          });
        }
      }

      if (overflowedPlates.length > 0) {
        setTotal360Rotations(r => r + overflowedPlates.length);
      }

      // 2. Resolve overflows into the buffer slots
      let hasFailed = false;
      const newFreeSlots = [...prev.freeSlots];
      const maxSlots = prev.freeSlots.length;

      for (const p of overflowedPlates) {
        // Find left-most available slot inside active array bounds
        let foundIndex = -1;
        for (let i = 0; i < maxSlots; i++) {
          if (newFreeSlots[i] === null && !reservedDockSlotsRef.current.has(i)) {
            foundIndex = i;
            break;
          }
        }

        if (foundIndex !== -1) {
          pendingDockTransfers.push({
            plate: p,
            dockIdx: foundIndex,
            fromSlot: p.injectedSlot >= 0 ? p.injectedSlot : 0,
          });
          sfx.playError();
        } else {
          // No free slots! Instant fail state!
          hasFailed = true;
        }
      }

      if (hasFailed) {
        sfx.playGameOver();
        return {
          ...prev,
          beltPlates: [],
          freeSlots: newFreeSlots,
          isGameOver: true,
        };
      }

      // 3. Resolve customer interceptions in the new positions
      const newBeltPlates: Plate[] = [];
      const updatedCustomers = prev.customers.map((c) => {
        if (!c) return null;
        return { ...c };
      });

      // Align seat slots:
      // Seat 0 [left top] -> Slot 10
      // Seat 1 [left bottom] -> Slot 11
      // Seat 2 [right top] -> Slot 5
      // Seat 3 [right bottom] -> Slot 4
      const seatSlots = gameMode === 'tweak' ? getSeatSlots(tweakNumSeats) : [10, 11, 5, 4];

      for (const plate of updatedPlates) {
        let intercepted = false;

        for (let s = 0; s < seatSlots.length; s++) {
          const targetSlot = seatSlots[s];
          const customerAtSeat = updatedCustomers[s];

          if (
            plate.currentSlot === targetSlot &&
            customerAtSeat &&
            customerAtSeat.state === 'waiting' &&
            customerAtSeat.orderedVariety === plate.variety
          ) {
            // MATCH FOUND! Pull plate of the belt and feed customer
            intercepted = true;
            customerAtSeat.state = 'eating';
            customerAtSeat.chopstickTicks = plate.count;
            
            // Set async trigger to finish feeding after 2 seconds
            feedCustomerAtSeat(s, plate.count);
            break;
          }
        }

        if (!intercepted) {
          newBeltPlates.push(plate);
        }
      }

      return purgeOrphanPlates({
        ...prev,
        beltPlates: newBeltPlates,
        freeSlots: newFreeSlots,
        customers: updatedCustomers,
      });
    });

    if (pendingDockTransfers.length > 0) {
      queueMicrotask(() => {
        pendingDockTransfers.forEach(({ plate, dockIdx, fromSlot }) => {
          startBeltToDockTransfer(plate, dockIdx, fromSlot);
        });
      });
    }
  };

  // Handles customer arrival transition to waiting
  const handleCustomerArrived = (seatIndex: number) => {
    setGameState((prev) => {
      const updatedCustomers = prev.customers.map((c, idx) => {
        if (idx === seatIndex && c && c.state === 'arriving') {
          return { ...c, state: 'waiting' as const };
        }
        return c;
      });
      return { ...prev, customers: updatedCustomers };
    });
  };

  // Handles feeding tick transitions and customer satisfaction payouts
  const feedCustomerAtSeat = (seatIndex: number, plateCount: number) => {
    sfx.playIntercept();

    const eatDelay = Math.max(1, gameMode === 'tweak' ? tweakTimeToEat : zenTimeToEat);
    const leaveDelay = gameMode === 'tweak' ? tweakTimeToLeave : 1500;
    const satisfiedDelay = Math.max(1, gameMode === 'tweak' ? tweakTimeToEat : zenTimeToEat);

    setTimeout(() => {
      setGameState((prev) => {
        const updatedCustomers = prev.customers.map((c) => {
          if (!c) return null;
          return { ...c };
        });

        const customer = updatedCustomers[seatIndex];
        if (!customer || customer.chopstickTicks <= 0) return prev;
        if (customer.satisfiedCount >= customer.orderedCount) return prev;

        const piecesEaten = Math.max(1, plateCount);
        const nextSatisfied = customer.satisfiedCount + piecesEaten;

        customer.satisfiedCount = nextSatisfied;
        customer.bowlCount += 1; // Spawns an empty plate/bowl
        customer.chopstickTicks = 0;

        // If entire order is consumed, mark as satisfied and schedule replacement steps
        if (nextSatisfied >= customer.orderedCount) {
          customer.state = 'satisfied';
          sfx.playCustomerSatisfied();
          
          // Trigger rewards
          const earnedCoins = 30; // standard flat diner reward
          const earnedScore = 150;

          triggerNotification(`+🪙${earnedCoins} Dinner complete!`);
          
          // Step 1: Wait 2 seconds while customer is waves happily/jumps
          setTimeout(() => {
            setGameState((prev2) => {
              const leavingCustomers = prev2.customers.map((c2, cIdx) => {
                if (cIdx === seatIndex && c2) {
                  return { ...c2, state: 'leaving' as const };
                }
                return c2;
              });
              return { ...prev2, customers: leavingCustomers };
            });

            // Step 2: Let them walk outside through shoji door for 1.5 seconds, then vacate seat
            setTimeout(() => {
              setGameState((prev3) => {
                const emptiedCustomers = prev3.customers.map((c3, cIdx) => {
                  if (cIdx === seatIndex) return null; // seat is vacant, bowl stack vanishes, particle burst emits
                  return c3;
                });
                return { ...prev3, customers: emptiedCustomers };
              });

              // Step 3: Wait 1 second on empty/clean seat, then spawn a new customer outdoors
              setTimeout(() => {
                setGameState((prev4) => {
                  let nextCustIndex = prev4.nextCustomerIndex;
                  const spawnedCustomers = prev4.customers.map((c4, cIdx) => {
                    if (cIdx === seatIndex) {
                      if (nextCustIndex < prev4.levelCustomersTemplates.length) {
                        const template = prev4.levelCustomersTemplates[nextCustIndex];
                        nextCustIndex += 1;
                        return {
                          id: `cust-${seatIndex}-${Math.random().toString(36).substring(2, 7)}`,
                          seatIndex,
                          characterName: template.characterName,
                          characterEmoji: template.characterEmoji,
                          orderedVariety: template.orderedVariety,
                          orderedCount: template.orderedCount,
                          satisfiedCount: 0,
                          state: 'arriving' as const,
                          bowlCount: 0,
                          chopstickTicks: 0,
                        };
                      }
                      return null;
                    }
                    return c4;
                  });

                  const nextServed = Math.min(
                    prev4.totalCustomersRequired,
                    prev4.customersServed + 1,
                  );
                  
                  return purgeOrphanPlates({
                    ...prev4,
                    customersServed: nextServed,
                    customers: spawnedCustomers,
                    nextCustomerIndex: nextCustIndex,
                  });
                });

                // Level-up will be reactively triggered by useEffect once the board is fully empty and cleared

              }, gameMode === 'tweak' ? tweakSpawnFrequency : 1000);

            }, leaveDelay);

          }, satisfiedDelay);

          return purgeOrphanPlates({
            ...prev,
            coins: prev.coins + earnedCoins,
            score: prev.score + earnedScore,
            dishesConsumed: prev.dishesConsumed + piecesEaten,
            customers: updatedCustomers,
          });
        } else {
          // Go back to waiting for more plates!
          customer.state = 'waiting';
          return purgeOrphanPlates({
            ...prev,
            dishesConsumed: prev.dishesConsumed + piecesEaten,
            customers: updatedCustomers,
          });
        }
      });
    }, eatDelay);
  };

  // Handles level progression and resets stats
  const triggerLevelUp = (nextLevel: number) => {
    sfx.playCoinDing();
    if (nextLevel > 5) {
      setGameState((prev) => ({
        ...prev,
        isGameVictory: true,
      }));
      return;
    }
    const speed = Math.max(600, 1150 - nextLevel * 125); // Speeds up belt proportionally
    setLevelUpMessage(`LEVEL UP! Welcome to level ${nextLevel}`);

    const lData = initializeLevelData(nextLevel);

    setGameState((prev) => ({
      ...prev,
      level: nextLevel,
      customersServed: 0,
      totalCustomersRequired: lData.totalCustomersRequired,
      totalDishesRequired: lData.totalDishesRequired,
      dishesConsumed: 0,
      beltPlates: [], // clear belt plates for fresh start
      freeSlots: Array(5).fill(null), // clear tray buffer items on level up
      queues: lData.queues,
      customers: lData.customers,
      levelCustomersTemplates: lData.levelCustomersTemplates,
      nextCustomerIndex: lData.nextCustomerIndex,
      beltSpeed: speed,
      coins: prev.coins + 50, // level milestone bonus
    }));
  };

  const handleNextLevelStart = () => {
    setLevelUpMessage(null);
  };

  // Dispatch the frontline item from a dispenser queue
  const finishDispatchToBelt = (dispatchedPlate: Plate, targetSlotIdx: number) => {
    setGameState((prev) => {
      const seatSlots = gameMode === 'tweak' ? getSeatSlots(tweakNumSeats) : [10, 11, 5, 4];
      const updatedCustomers = prev.customers.map((c) => (c ? { ...c } : null));
      let isInstantEaten = false;

      for (let s = 0; s < seatSlots.length; s++) {
        const targetSlot = seatSlots[s];
        const customerAtSeat = updatedCustomers[s];

        if (
          targetSlotIdx === targetSlot &&
          customerAtSeat &&
          customerAtSeat.state === 'waiting' &&
          customerAtSeat.orderedVariety === dispatchedPlate.variety
        ) {
          isInstantEaten = true;
          customerAtSeat.state = 'eating';
          customerAtSeat.chopstickTicks = dispatchedPlate.count;
          feedCustomerAtSeat(s, dispatchedPlate.count);
          break;
        }
      }

      return {
        ...prev,
        beltPlates: isInstantEaten ? prev.beltPlates : [...prev.beltPlates, dispatchedPlate],
        customers: updatedCustomers,
      };
    });
  };

  const handleDispatchQueue = (queueIdx: number) => {
    const targetSlotIdx = queueIdx;

    const occupied = isBeltSlotOccupied(targetSlotIdx);
    if (occupied) {
      sfx.playError();
      setBeltWarnings([targetSlotIdx]);
      setTimeout(() => setBeltWarnings([]), 800);
      return;
    }

    const queueList = gameState.queues[queueIdx];
    if (!queueList || queueList.length === 0) return;

    const plate = queueList[0];
    const dispatchedPlate = {
      ...queueList[0],
      currentSlot: targetSlotIdx,
      injectedSlot: targetSlotIdx,
      stepsTaken: 0,
      spawnTime: Date.now(),
    };

    const updatedColList = queueList.slice(1);
    const queueOverride = gameState.queues.map((col, cIdx) => (cIdx === queueIdx ? updatedColList : col));

    sfx.playDispatch();

    const playfield = platePlayfieldRef.current;
    const beltFrame = document.getElementById('conveyor-belt-frame');
    const queueEl = playfield?.querySelector(`[data-queue-dispatch="${queueIdx}"]`);

    if (!playfield || !beltFrame || !queueEl) {
      inflightBeltSlotsRef.current.add(targetSlotIdx);
      setGameState((prev) => ({
        ...prev,
        queues: queueOverride,
        beltPlates: [...prev.beltPlates, dispatchedPlate],
      }));
      inflightBeltSlotsRef.current.delete(targetSlotIdx);
      return;
    }

    inflightBeltSlotsRef.current.add(targetSlotIdx);

    setGameState((prev) => ({
      ...prev,
      queues: queueOverride,
    }));

    runPlateTransfer(
      {
        key: `q2b-${plate.id}-${Date.now()}`,
        variety: plate.variety,
        count: plate.count,
        from: getElementCenterInPlayfield(playfield, queueEl as HTMLElement),
        to: getBeltSlotCenterInPlayfield(playfield, beltFrame, targetSlotIdx),
        size: plateAnimSize('queue'),
        variant: plateAnimVariant(),
      },
      () => {
        inflightBeltSlotsRef.current.delete(targetSlotIdx);
        finishDispatchToBelt(dispatchedPlate, targetSlotIdx);
      },
    );
  };

  // Reload an item from the free buffer tray back onto the conveyor belt
  const handleBufferPlateClick = (plate: Plate, slotIdx: number) => {
    const returnSlotIdx = 1;

    const occupied = isBeltSlotOccupied(returnSlotIdx);
    if (occupied) {
      sfx.playError();
      setBeltWarnings([returnSlotIdx]);
      setTimeout(() => setBeltWarnings([]), 800);
      triggerNotification('Return Slot 1 is occupied!');
      return;
    }

    sfx.playDispatch();

    const returnedPlate = {
      ...plate,
      currentSlot: returnSlotIdx,
      injectedSlot: returnSlotIdx,
      stepsTaken: 0,
      spawnTime: Date.now(),
    };

    const playfield = platePlayfieldRef.current;
    const beltFrame = document.getElementById('conveyor-belt-frame');
    const dockEl = playfield?.querySelector(`[data-buffer-slot="${slotIdx}"]`);

    if (!playfield || !beltFrame || !dockEl) {
      setGameState((prev) => {
        const newFreeSlots = [...prev.freeSlots];
        newFreeSlots[slotIdx] = null;
        return {
          ...prev,
          freeSlots: newFreeSlots,
          beltPlates: [...prev.beltPlates, returnedPlate],
        };
      });
      return;
    }

    inflightBeltSlotsRef.current.add(returnSlotIdx);

    setGameState((prev) => {
      const newFreeSlots = [...prev.freeSlots];
      newFreeSlots[slotIdx] = null;
      return { ...prev, freeSlots: newFreeSlots };
    });

    runPlateTransfer(
      {
        key: `d2b-${plate.id}-${Date.now()}`,
        variety: plate.variety,
        count: plate.count,
        from: getElementCenterInPlayfield(playfield, dockEl as HTMLElement),
        to: getBeltSlotCenterInPlayfield(playfield, beltFrame, returnSlotIdx),
        size: plateAnimSize('dock'),
        variant: plateAnimVariant(),
      },
      () => {
        inflightBeltSlotsRef.current.delete(returnSlotIdx);
        setGameState((prev) => ({
          ...prev,
          beltPlates: [...prev.beltPlates, returnedPlate],
        }));
      },
    );
  };

  // Buy extra fifth slot via coins
  const handleBuyFifthSlot = () => {
    const cost = 80;
    if (gameState.coins >= cost) {
      sfx.playCoinDing();
      setGameState((prev) => ({
        ...prev,
        coins: prev.coins - cost,
        hasUnlockedFifthSlot: true,
      }));
      triggerNotification('Buffer Slot 5 Unlocked!');
    } else {
      sfx.playError();
      triggerNotification('Not enough coins! (Need 80)');
    }
  };

  // Simulated ad unlock for fifth slot (watch 3s video ad)
  const handleAdvertiseUnlock = () => {
    sfx.playCoinDing();
    setShowAdSpinner(true);
    setTimeout(() => {
      setShowAdSpinner(false);
      setGameState((prev) => ({
        ...prev,
        hasUnlockedFifthSlot: true,
      }));
      sfx.playCoinDing();
      triggerNotification('Buffer Slot 5 Unlocked FREE!');
    }, 3000);
  };

  // Restart entire gameplay loop
  const handleRestartGame = () => {
    sfx.playCoinDing();
    if (gameMode === 'tweak') {
      if (activeCustomLevel) {
        handlePlaySavedLevel(activeCustomLevel);
        return;
      } else if (savedLevels.length > 0) {
        handlePlaySavedLevel(savedLevels[0]);
        return;
      }
    }
    const lData = initializeLevelData(1);
    transferHandlersRef.current.clear();
    reservedDockSlotsRef.current.clear();
    inflightBeltSlotsRef.current.clear();
    setActiveTransfers([]);
    setGameState({
      score: 0,
      coins: 100,
      level: 1,
      beltPlates: [],
      freeSlots: Array(5).fill(null),
      hasUnlockedFifthSlot: false,
      queues: lData.queues,
      customers: lData.customers,
      isGameOver: false,
      isGameVictory: false,
      customersServed: 0,
      totalCustomersRequired: lData.totalCustomersRequired,
      totalDishesRequired: lData.totalDishesRequired,
      dishesConsumed: 0,
      levelCustomersTemplates: lData.levelCustomersTemplates,
      nextCustomerIndex: lData.nextCustomerIndex,
      beltSpeed: zenBaseBeltSpeed,
    });
    setLevelUpMessage(null);
  };

  const handleStartGame = () => {
    sfx.playCoinDing();
    setShowTutorial(false);
    setHasFirstLaunch(true);
  };

  if (gameMode === 'menu') {
    return (
      <MainMenu
        onSelectMode={(mode) => {
          setGameMode(mode);
          if (mode === 'zen') {
            setZenBaseBeltSpeed(850);
          }
          handleRestartGame();
          if (mode === 'zen') {
            setGameState(prev => ({
              ...prev,
              beltSpeed: 850,
            }));
          }
        }}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onShowTutorial={() => setShowTutorial(true)}
        highScore={highScore}
      />
    );
  }

  const remainingDemandTotal = getTotalRemainingDemand(
    gameState.customers,
    gameState.levelCustomersTemplates,
    gameState.nextCustomerIndex,
  );
  const dishesProgressTarget = gameState.dishesConsumed + remainingDemandTotal;

  return (
    <div 
      className={`w-full h-screen max-h-screen flex items-stretch justify-center p-0 select-none relative font-sans antialiased overflow-hidden transition-all duration-500 ${
        gameMode === 'zen' ? 'bg-[#edd4b8] text-[#5c3a21]' : 'bg-[#030712] text-slate-100 tweak-mode'
      }`}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: 0,
        margin: 0,
        ...(gameMode === 'zen'
          ? {
              backgroundImage: `
                radial-gradient(rgba(139, 90, 43, 0.08) 1.5px, transparent 1.5px),
                linear-gradient(rgba(139, 90, 43, 0.04) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px, 100% 48px',
            }
          : {})
      }}
    >
      
      {/* Dynamic Floating Score Notifications */}
      <AnimatePresence>
        {scoreNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 bg-[#d94e33] text-[#fafaf9] px-4 py-1.5 rounded-full text-xs font-mono font-bold shadow-lg border border-red-400/20"
          >
            {scoreNotification.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container: Adapts as multi-column on desktop / splits completely for tweak-mode */}
      {gameMode === 'tweak' ? (
        <div className="w-full h-full flex flex-row overflow-hidden relative bg-[#030712] text-slate-100 font-mono">
          
          {/* LEFT COLUMN - SANDBOX DEVELOPER DASHBOARD */}
          <div className="w-[440px] h-full shrink-0 bg-[#050811] border-r border-[#152033] flex flex-col justify-between p-4 overflow-y-auto z-20 space-y-4">
            
            <div className="space-y-4">
              {/* Header block */}
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[13px] font-black tracking-widest text-[#60a5fa] uppercase flex items-center gap-2">
                    <span>🛠️</span> LEVEL DESIGN STUDIO
                  </h2>
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block mt-0.5">
                    Simulation Tweak Sandbox v3
                  </span>
                </div>
                <button
                  onClick={() => {
                    sfx.playCoinDing();
                    setGameMode('menu');
                  }}
                  className="px-2.5 py-1 text-[9px] bg-slate-900 hover:bg-slate-850 text-slate-300 font-extrabold rounded border border-slate-800 hover:border-slate-700 transition active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  ⛩️ ESCAPE
                </button>
              </div>

              {/* Heartbeat Controls & Active Stats */}
              <div className="bg-[#090f1d] border border-blue-950 p-2.5 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-indigo-400 font-black uppercase tracking-wider">Active HEARTBEAT loop</span>
                  <span className={`text-[8.5px] font-bold px-1.5 rounded-sm flex items-center gap-1 ${
                    isSimPaused ? 'bg-amber-950/80 text-amber-400 border border-amber-900/30' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/30 animate-pulse'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                    {isSimPaused ? 'PAUSED' : 'SIMULATIVE RUNNING'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      sfx.playDispatch();
                      setIsSimPaused(!isSimPaused);
                    }}
                    className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded border transition active:scale-95 cursor-pointer ${
                      isSimPaused
                        ? 'bg-emerald-900/80 hover:bg-emerald-850 text-emerald-100 border-emerald-700'
                        : 'bg-amber-900/80 hover:bg-amber-850 text-amber-100 border-amber-700'
                    }`}
                  >
                    {isSimPaused ? '▶️ Resume heartbeat' : '⏸️ Freeze Heartbeat'}
                  </button>
                  <button
                    onClick={() => {
                      sfx.playDispatch();
                      handleRestartGame();
                    }}
                    className="px-3 py-1.5 text-[9px] font-bold bg-slate-900 hover:bg-slate-850 text-slate-300 rounded border border-slate-800 transition active:scale-95 cursor-pointer uppercase"
                  >
                    🔄 Clear Machine
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[8px] text-slate-400 pt-1 border-t border-slate-900">
                  <div>Served: <span className="text-white font-bold">{gameState.customersServed}/{gameState.totalCustomersRequired}</span></div>
                  <div>Plates on conveyor: <span className="text-white font-bold">{gameState.beltPlates.length}</span></div>
                </div>
              </div>

              {/* -------------------- STEP 1: SETUP STATE INPUTS -------------------- */}
              <div className="space-y-2">
                <span className="text-[10px] text-sky-400 font-black tracking-widest uppercase block border-l-2 border-sky-500 pl-1.5">
                  Step 1: Setup State Parameters
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col text-[8.5px] text-slate-400 font-bold uppercase">
                    Customers count
                    <input 
                      type="number" 
                      min={1} 
                      max={24} 
                      value={tweakNumCustomers} 
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(24, parseInt(e.target.value) || 1));
                        setTweakNumCustomers(val);
                      }}
                      className="mt-1 bg-slate-950 border border-slate-800 focus:border-blue-500 hover:border-slate-700 rounded p-1.5 text-xs text-white outline-none"
                    />
                  </label>
                  <label className="flex flex-col text-[8.5px] text-slate-400 font-bold uppercase">
                    Dish Varieties (max 9)
                    <input 
                      type="number" 
                      min={1} 
                      max={9} 
                      value={tweakNumDishTypes} 
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(9, parseInt(e.target.value) || 1));
                        setTweakNumDishTypes(val);
                      }}
                      className="mt-1 bg-slate-950 border border-slate-800 focus:border-blue-500 hover:border-slate-700 rounded p-1.5 text-xs text-white outline-none"
                    />
                  </label>
                </div>

                {/* Customer Demand Custom Array row mappings */}
                <div className="border border-slate-900 bg-[#04060b]/80 p-2.5 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[8px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-900">
                    <span>🧑 Customer Slot Demand Map</span>
                    <span className="text-amber-400">Total Items Sum: {Object.values(totalPerDish).reduce((a, b) => a + b, 0)}</span>
                  </div>
                  
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border-b border-slate-900/50 pb-1">
                    {Array.from({ length: tweakNumCustomers }).map((_, i) => {
                      const demand = tweakCustomerDemands[i] || { dishId: 0, quantity: 4 };
                      const charEmoji = CHARACTER_EMOJIS[i % CHARACTER_EMOJIS.length].emoji;
                      return (
                        <div key={i} className="flex items-center justify-between bg-slate-950/60 p-1 rounded border border-slate-900/60 text-[9px]">
                          <span className="font-bold flex items-center gap-1">
                            <span>{charEmoji}</span> #{i + 1}:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Dish ID:</span>
                            <select 
                              value={demand.dishId} 
                              onChange={(e) => {
                                const newId = parseInt(e.target.value) || 0;
                                setTweakCustomerDemands(prev => {
                                  const copy = [...prev];
                                  if (!copy[i]) copy[i] = { dishId: 0, quantity: 4 };
                                  copy[i].dishId = newId;
                                  return copy;
                                });
                              }}
                              className="bg-slate-900 text-slate-200 border border-slate-800 text-[8px] py-0.5 px-1 rounded outline-none"
                            >
                              {Array.from({ length: tweakNumDishTypes }).map((_, dIdx) => (
                                <option key={dIdx} value={dIdx}>
                                  D0{dIdx} ({ALL_VARIETIES[dIdx % ALL_VARIETIES.length]})
                                </option>
                              ))}
                            </select>
                            <span className="text-slate-500">Qty:</span>
                            <input 
                              type="number"
                              min={2}
                              max={16}
                              step={2}
                              value={demand.quantity}
                              onChange={(e) => {
                                const raw = Math.max(2, Math.min(16, parseInt(e.target.value) || 2));
                                const newQty = Math.round(raw / 2) * 2;
                                setTweakCustomerDemands(prev => {
                                  const copy = [...prev];
                                  if (!copy[i]) copy[i] = { dishId: 0, quantity: 4 };
                                  copy[i].quantity = newQty;
                                  return copy;
                                });
                              }}
                              className="w-10 text-center bg-slate-900 text-white border border-slate-800 text-[8px] py-0.5 rounded outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col text-[8.5px] text-slate-400 font-bold uppercase">
                    Dining Seats Count (2-8)
                    <input 
                      type="number" 
                      min={2} 
                      max={8} 
                      value={tweakNumSeats} 
                      onChange={(e) => {
                        const val = Math.max(2, Math.min(8, parseInt(e.target.value) || 4));
                        setTweakNumSeats(val);
                      }}
                      className="mt-1 bg-slate-950 border border-slate-800 focus:border-blue-500 hover:border-slate-700 rounded p-1.5 text-xs text-white outline-none"
                    />
                  </label>
                  <label className="flex flex-col text-[8.5px] text-slate-400 font-bold uppercase">
                    Buffer Docks capacity (4-6)
                    <select 
                      value={tweakNumFreeDocks} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5;
                        setTweakNumFreeDocks(val);
                        setDockCrashThreshold(val);
                      }}
                      className="mt-1 bg-slate-950 border border-slate-800 focus:border-blue-500 hover:border-slate-700 rounded p-1.5 text-xs text-white outline-none"
                    >
                      <option value={4}>4 Slots</option>
                      <option value={5}>5 Slots</option>
                      <option value={6}>6 Slots</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* -------------------- STEP 2: TIMING & PACING SPEEDS -------------------- */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] text-amber-500 font-black tracking-widest uppercase block border-l-2 border-amber-500 pl-1.5">
                  Step 2: Timing & Pacing Speeds
                </span>

                <div className="grid grid-cols-2 gap-2 text-[8.5px] text-slate-400 font-bold uppercase">
                  <label className="flex flex-col">
                    Time to Eat (ms)
                    <input 
                      type="number" 
                      min={0} 
                      max={10000} 
                      step={10}
                      value={tweakTimeToEat}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(10000, parseInt(e.target.value) || 50));
                        setTweakTimeToEat(val);
                      }}
                      className="mt-1 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white outline-none font-mono"
                    />
                  </label>
                  <label className="flex flex-col">
                    Conveyor step (ms)
                    <input 
                      type="number" 
                      min={100} 
                      max={5000} 
                      step={50}
                      value={tweakBeltSpeed}
                      onChange={(e) => {
                        const val = Math.max(100, Math.min(5000, parseInt(e.target.value) || 1150));
                        setTweakBeltSpeed(val);
                        setGameState(p => ({ ...p, beltSpeed: val }));
                      }}
                      className="mt-1 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white outline-none font-mono"
                    />
                  </label>
                  <label className="flex flex-col mt-1">
                    Time to Leave (ms)
                    <input 
                      type="number" 
                      min={100} 
                      max={10000} 
                      step={100}
                      value={tweakTimeToLeave}
                      onChange={(e) => {
                        const val = Math.max(100, Math.min(10000, parseInt(e.target.value) || 1500));
                        setTweakTimeToLeave(val);
                      }}
                      className="mt-1 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white outline-none font-mono"
                    />
                  </label>
                  <label className="flex flex-col mt-1">
                    Spawn Frequency (ms)
                    <input 
                      type="number" 
                      min={100} 
                      max={10000} 
                      step={100}
                      value={tweakSpawnFrequency}
                      onChange={(e) => {
                        const val = Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000));
                        setTweakSpawnFrequency(val);
                      }}
                      className="mt-1 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white outline-none font-mono"
                    />
                  </label>
                </div>
              </div>

              {/* -------------------- PIPELINE GENERATION CONTROLS -------------------- */}
              <div className="space-y-2 pt-2 border-t border-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-black tracking-widest uppercase block">
                    Pipeline Compile Channels
                  </span>
                  <label className="text-[8px] flex items-center gap-1 text-slate-400">
                    Split Queues:
                    <select 
                      value={tweakNumQueues} 
                      onChange={(e) => setTweakNumQueues(Math.max(3, Math.min(6, parseInt(e.target.value) || 3)))}
                      className="bg-slate-950 font-bold text-white border border-slate-800 px-1 py-0.5 rounded text-[8.5px]"
                    >
                      <option value={3}>3 Channels</option>
                      <option value={4}>4 Channels</option>
                      <option value={5}>5 Channels</option>
                      <option value={6}>6 Channels</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCompileTweakQueues}
                    className="py-2 px-1 bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700/50 text-[10px] font-bold text-indigo-100 rounded-xl transition active:scale-95 cursor-pointer uppercase text-center flex items-center justify-center gap-1"
                  >
                    ⛓️ 1. Compile Queues
                  </button>
                  <button
                    onClick={handleGenerateTweakLevel}
                    className="py-2 px-1 bg-teal-900/60 hover:bg-teal-900 border border-teal-700/50 text-[10px] font-bold text-teal-100 rounded-xl transition active:scale-95 cursor-pointer uppercase text-center flex items-center justify-center gap-1"
                  >
                    💾 2. Save Sandbox
                  </button>
                </div>

                {/* Read-Only Telemetry Preview of Compiled Queues */}
                {tweakGeneratedQueues.length > 0 && (
                  <div className="bg-[#03060a]/90 border border-slate-905 p-2 rounded-lg space-y-1.5 text-[8.5px] text-slate-400" id="tweak-telemetry-preview">
                    <span className="text-[#60a5fa] font-black uppercase text-[7.5px] block">Compiled Telemetry Distribution Pipeline</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {tweakGeneratedQueues.map((col, idx) => (
                        <div key={idx} className="bg-slate-950 border border-slate-900 p-1 rounded flex items-center justify-between">
                          <span>Lane #{idx + 1}:</span>
                          <span className="font-bold text-white">{col.length} plates ({col.map(p => p.variety === 'maguro' ? '🍣' : (p.variety === 'california' ? '🍥' : '🥒')).slice(0,3).join('')}...)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Saved Sandbox Levels List */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Compiled Level Library</span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {savedLevels.map((lvl) => (
                  <div key={lvl.id} className="bg-[#030810] border border-slate-800 rounded-xl p-2 flex items-center justify-between text-[9px] hover:border-slate-700 transition">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-black text-white truncate max-w-[210px]">{lvl.name}</span>
                      <span className="text-slate-500 text-[8px] uppercase tracking-tighter">
                        {lvl.numCustomers} diners • {lvl.numSeats} seats • {lvl.numFreeDocks} docks • {lvl.numQueues} tracks
                      </span>
                    </div>
                    <button
                      onClick={() => handlePlaySavedLevel(lvl)}
                      className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[9px] font-black rounded-lg shadow transition active:scale-90 flex items-center gap-0.5 cursor-pointer"
                    >
                      🎮 PLAY
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN - CENTERED VIEWPORT CANVAS CONTAINER (Fits 1080x1080 nicely with zero scrollbar!) */}
          <div className="flex-1 h-full bg-[#02050a] flex items-center justify-center p-3 relative overflow-hidden" id="sandbox-viewport">
            
            {/* Aspect Square Card mirroring perfect landscape-constrained layout */}
            <div 
              className="w-full max-w-[min(calc(100vh-64px),720px)] h-full max-h-full bg-[#070b13] border-[3px] border-[#131d2f] rounded-[24px] relative shadow-2xl flex flex-col justify-between p-3 my-auto mx-auto min-h-0"
              style={{
                boxSizing: 'border-box',
              }}
            >
              {/* TOP HEADER: Status node bar */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-500 text-xs animate-ping">●</span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#60a5fa] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                    SYS: SIMULATOR ACTIVE
                  </span>
                </div>
                <div className="text-[9px] font-mono text-slate-400 font-bold uppercase flex items-center gap-2">
                  <span>Score: <span className="text-emerald-400 font-extrabold">{gameState.score}</span></span>
                  <span>Coins: <span className="text-amber-400 font-extrabold">🪙{gameState.coins}</span></span>
                </div>
              </div>

              {/* OUTDOORS Single entry door node at top center */}
              <div className="absolute top-[8%] left-1/2 transform -translate-x-1/2 z-30 flex flex-col items-center">
                <div className="bg-[#0f172a] border-2 border-[#1e293b] rounded-2xl px-3 py-1 text-center shadow-lg flex items-center gap-2 relative">
                  <span className="text-xl">🚪</span>
                  <div>
                    <span className="text-[6.5px] text-slate-500 font-bold block uppercase tracking-wider">ENTRY DOOR</span>
                    <span className="text-[8px] text-emerald-400 font-black tracking-tight leading-none">QUEUE FLOW</span>
                  </div>
                  {/* Streaming waiting lines circles indicators */}
                  <div className="flex gap-1 ml-2 pl-2 border-l border-slate-800 items-center">
                    {gameState.levelCustomersTemplates.slice(gameState.nextCustomerIndex, gameState.nextCustomerIndex + 6).map((c, idx) => (
                      <span key={idx} className="text-sm filter drop-shadow relative animate-pulse" title={c.characterName}>
                        {c.characterEmoji}
                      </span>
                    ))}
                    {gameState.levelCustomersTemplates.length <= gameState.nextCustomerIndex && (
                      <span className="text-[7px] text-slate-600 font-bold uppercase">EMPTY</span>
                    )}
                  </div>
                </div>
              </div>

              {/* MAIN CONTENT AREA: Conveyor, Plates and Seats */}
              <div
                ref={platePlayfieldRef}
                id="plate-playfield"
                className="relative flex-1 min-h-0 w-full flex flex-col justify-end"
              >
              <div className="flex-1 min-h-0 w-full flex items-center justify-center py-1">
                <div className="flex items-center justify-center gap-1.5 w-full h-full max-h-[min(38vh,220px)] px-1">
                  {/* Left seats */}
                  <div className="flex flex-col gap-1 items-center justify-center shrink-0 h-full">
                    <CustomerSeat
                      customer={gameState.customers[0]}
                      seatIndex={0}
                      side="left"
                      onArrived={handleCustomerArrived}
                      variant="tweak"
                    />
                    <CustomerSeat
                      customer={gameState.customers[1]}
                      seatIndex={1}
                      side="left"
                      onArrived={handleCustomerArrived}
                      variant="tweak"
                    />
                  </div>

                  {/* Conveyor belt center */}
                  <div id="conveyor-belt-frame" className="flex-1 min-w-0 h-full max-h-full flex items-center justify-center">
                    <ConveyorBelt
                      plates={gameState.beltPlates}
                      highlightedSlots={beltWarnings}
                      beltSpeed={gameState.beltSpeed}
                      variant="tweak"
                    />
                  </div>

                  {/* Right seats */}
                  <div className="flex flex-col gap-1 items-center justify-center shrink-0 h-full">
                    <CustomerSeat
                      customer={gameState.customers[2]}
                      seatIndex={2}
                      side="right"
                      onArrived={handleCustomerArrived}
                      variant="tweak"
                    />
                    <CustomerSeat
                      customer={gameState.customers[3]}
                      seatIndex={3}
                      side="right"
                      onArrived={handleCustomerArrived}
                      variant="tweak"
                    />
                  </div>
                </div>
              </div>

              {/* BOTTOM PANEL CONTROLS: Storage Buffer tray + Dispatch input tracks lanes */}
              <div className="space-y-2 mt-auto">
                {/* Dynamically configured Free Buffer tray storage docks (4, 5, or 6 deep) */}
                <div className="px-2">
                  <FreeBuffer 
                    freeSlots={gameState.freeSlots}
                    hasUnlockedFifthSlot={true}
                    onBufferPlateClick={handleBufferPlateClick}
                    onUnlockSlot={() => {}}
                    coinCostToUnlock={0}
                    playerCoins={gameState.coins}
                    variant="tweak"
                    dockCrashThreshold={tweakNumFreeDocks}
                  />
                </div>

                {/* Dispatch Input Tracks Queues Lanes (3 to 6 pipeline queues deep) */}
                <div className="px-2">
                  <QueueDispenser 
                    queues={gameState.queues}
                    onDispatch={handleDispatchQueue}
                    isBeltSlotOccupied={isBeltSlotOccupied}
                    variant="tweak"
                  />
                </div>
              </div>
              <PlateTransferOverlay
                transfers={activeTransfers}
                onComplete={handleTransferComplete}
              />
            </div>

          </div>

        </div>
        </div>
      ) : (
        <div 
          className={`w-full h-full max-h-full min-h-0 max-w-[min(100vw,1400px)] flex flex-col xl:flex-row overflow-hidden shadow-2xl transition-all duration-500 ${
            gameMode === 'zen' 
              ? 'bg-[#fffcf8] xl:border-[8px] xl:border-[#8a5a36] xl:rounded-[36px]' 
              : 'bg-[#141414] xl:border xl:border-[#2d2d2d] xl:rounded-3xl'
          }`}
        >
        {/* LEFT SIDEBAR: Static game metadata of Kaizen restaraunt */}
        <aside 
          className={`w-72 h-full min-h-0 flex flex-col justify-between hidden xl:flex shrink-0 overflow-hidden transition-all duration-500 ${
            gameMode === 'zen' 
              ? 'border-r-2 border-[#b5835a]/30 bg-[#faf2e9]' 
              : 'border-r border-[#2d2d2d] bg-[#141414]'
          }`}
        >
          <div className={`p-6 flex flex-col justify-end h-28 shrink-0 border-b transition-all duration-500 ${
            gameMode === 'zen' 
              ? 'bg-[#8a5a36] border-[#724624]/60' 
              : 'bg-[#d94e33] border-stone-900'
          }`}>
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase opacity-85 text-[#fafaf9]">
              RESTORATION MASTER
            </span>
            <h1 className="text-2xl font-serif italic tracking-wide font-black text-[#fafaf9] leading-tight">
              KAIZEN ZUSHI
            </h1>
          </div>

          <div className="p-6 flex-1 min-h-0 flex flex-col justify-between space-y-4 overflow-hidden">
            <div className="space-y-6">
              <div>
                <span className={`text-[10px] font-mono tracking-[0.1em] uppercase block ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-500'}`}>
                  Current Station
                </span>
                <h2 className={`text-xl font-serif italic mt-1 font-bold text-[#8a5a36]`}>
                  Zen Pond Garden — Lvl {gameState.level}
                </h2>
              </div>

              <div>
                <span className={`text-[10px] font-mono tracking-[0.1em] uppercase block ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-500'}`}>
                  KITCHEN SUPPLY
                </span>
                <div className={`flex justify-between items-baseline mt-1 text-xs font-mono ${gameMode === 'zen' ? 'text-[#5c3a21]' : 'text-stone-300'}`}>
                  <span>Dishes Delivered</span>
                  <span className={`font-bold ${gameMode === 'zen' ? 'text-stone-950 font-extrabold' : 'text-white'}`}>
                    {gameState.dishesConsumed}/{dishesProgressTarget}
                  </span>
                </div>
                <div className={`h-1 rounded-full overflow-hidden mt-2 ${gameMode === 'zen' ? 'bg-[#eedbc5]/60' : 'bg-stone-900'}`}>
                  <div 
                    className={`h-full transition-all duration-400 ${gameMode === 'zen' ? 'bg-[#b5835a]' : 'bg-amber-600'}`}
                    style={{ width: `${(gameState.dishesConsumed / Math.max(1, dishesProgressTarget)) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <span className={`text-[10px] font-mono tracking-[0.1em] uppercase block ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-500'}`}>
                  PATRON SATISFACTION
                </span>
                <div className={`flex justify-between items-baseline mt-1 text-xs font-mono ${gameMode === 'zen' ? 'text-[#5c3a21]' : 'text-stone-300'}`}>
                  <span>Diners Served</span>
                  <span className={`font-bold ${gameMode === 'zen' ? 'text-stone-950 font-extrabold' : 'text-white'}`}>
                    {gameState.customersServed}/{gameState.totalCustomersRequired}
                  </span>
                </div>
                <div className={`h-1 rounded-full overflow-hidden mt-2 ${gameMode === 'zen' ? 'bg-[#eedbc5]/60' : 'bg-stone-900'}`}>
                  <div 
                    className={`h-full transition-all duration-400 ${gameMode === 'zen' ? 'bg-[#8a5a36]' : 'bg-[#d94e33]'}`}
                    style={{ width: `${(gameState.customersServed / Math.max(1, gameState.totalCustomersRequired)) * 100}%` }}
                  />
                </div>
              </div>

              <div className={`p-4 rounded-xl text-[10px] font-mono space-y-1.5 leading-relaxed border ${
                gameMode === 'zen' 
                  ? 'bg-[#fcf5ee] border-[#b5835a]/30 text-[#8a5a36] font-bold shadow-xs' 
                  : 'bg-[#1a1a1a] border border-[#2d2d2d] text-stone-400'
              }`}>
                <span className="text-[9px] text-[#fafaf9]/30 uppercase tracking-widest block font-bold">
                  Tactical Notes:
                </span>
                <p>• Launch matching color ingredients onto empty bottom slots.</p>
                <p>• Belt revolves Counter-Clockwise.</p>
                <p>• Bottom queues start with exactly {dishesProgressTarget} dishes needed (pairs of 2).</p>
                <p>• Unneeded dishes auto-clear when diners are satisfied.</p>
              </div>
            </div>

            <div className="text-[9px] font-mono text-stone-600">
              © 2026 KAIZEN CORP.
            </div>
          </div>
        </aside>

        {/* MIDDLE PORTRAITS WRAPPER: Mobile and Desktop primary action panel */}
        <section className={`flex-1 min-h-0 w-full max-w-2xl mx-auto xl:w-[720px] xl:max-w-none p-3 xl:p-4 flex flex-col overflow-hidden h-full relative transition-all duration-500 xl:border-r xl:border-stone-800 ${
          gameMode === 'zen' ? 'bg-gradient-to-b from-[#fdf6ec] to-[#f4e6d3]' : 'bg-[#121212]'
        }`}>
          
          {/* MOBILE ONLY COMPACT HEADER PANEL */}
          <header className={`shrink-0 flex justify-between items-center p-2 rounded-2xl shadow-md xl:hidden mb-1 transition-all duration-300 ${
            gameMode === 'zen' 
              ? 'bg-[#faf2e9] border border-[#ddb892]/60 text-[#3e1f0a]' 
              : 'bg-[#141414] border border-[#2c2c2c] text-[#f5f5f0]'
          }`}>
            <div className="flex items-center gap-1.5">
              <span className="text-xl">🍣</span>
              <div>
                <h1 className={`text-xs font-serif font-black italic tracking-wide leading-none ${
                  gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-[#d94e33]'
                }`}>
                  Kaizen Zushi
                </h1>
                <span className={`text-[8px] font-mono uppercase tracking-wider ${
                  gameMode === 'zen' ? 'text-[#a07855]' : 'text-stone-500'
                }`}>
                  {gameMode === 'zen' ? 'Zen Garden' : `Station Rush ${gameState.level}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Menu Escape Hatch */}
              <button
                onClick={() => setGameMode('menu')}
                className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-tight uppercase cursor-pointer transition-all ${
                  gameMode === 'zen' 
                    ? 'bg-[#8a5a36] text-white hover:bg-[#724624]' 
                    : 'bg-[#d94e33] text-white hover:bg-[#b03a24]'
                }`}
              >
                ⛩️ Menu
              </button>
              {/* Coins */}
              <div className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${
                gameMode === 'zen' ? 'bg-[#f0d8c0] text-[#a07855]' : 'bg-[#121212] text-amber-500'
              }`}>
                🪙{gameState.coins}
              </div>
              {/* Score */}
              <div className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                gameMode === 'zen' ? 'bg-[#f0d8c0] text-[#8a5a36]' : 'bg-[#121212] text-[#d94e33]'
              }`}>
                Pts: {gameState.score}
              </div>

              {/* Sound Option */}
              <button
                onClick={handleToggleMute}
                className="p-1 hover:bg-stone-800/10 rounded cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
            </div>
          </header>

          {/* DESKTOP ONLY SMALL TOP TOOLBAR */}
          <header className={`shrink-0 hidden xl:flex justify-between items-center p-2 rounded-2xl shadow-md mb-1 transition-all duration-300 ${
            gameMode === 'zen' 
              ? 'bg-[#faf2e9] border border-[#ddb892]/60 text-[#3e1f0a]' 
              : 'bg-[#1a1a1a] border border-[#2c2c2c] text-[#fafaf9]'
          }`}>
            <span className={`text-[9px] font-mono tracking-wider ${gameMode === 'zen' ? 'text-[#8a5a36] font-bold' : 'text-stone-500'}`}>
              {gameMode === 'zen' ? '🌸 ZEN POND DINING GARDEN' : 'CORE WORKSTATION SCREEN'}
            </span>
            <div className="flex items-center gap-1.5">
              {/* Menu Escape Hatch */}
              <button
                onClick={() => setGameMode('menu')}
                className={`px-2 py-1 rounded text-[8px] font-mono font-bold tracking-wider uppercase cursor-pointer transition-all flex items-center gap-1 ${
                  gameMode === 'zen' 
                    ? 'bg-[#8a5a36] hover:bg-[#724624] text-white' 
                    : 'bg-[#d94e33] hover:bg-[#b03a24] text-[#fafaf9]'
                }`}
              >
                <span>⛩️</span> CHANGE WINDOW MODE
              </button>
              <div className="w-[1px] h-3 bg-[#b5835a]/30 mx-1" />
              {/* Audio button */}
              <button
                id="btn-toggle-sound"
                onClick={handleToggleMute}
                className="p-1 rounded transition cursor-pointer"
                title="Toggle SFX synth"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-[#d94e33]" /> : <Volume2 className="w-3.5 h-3.5 text-stone-400" />}
              </button>
              {/* Help trigger */}
              <button
                id="btn-show-help"
                onClick={() => setShowTutorial(true)}
                className="p-1 rounded transition text-stone-400 hover:text-stone-600 cursor-pointer"
                title="Open instruction panel"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* PLAYGROUND MIDDLE LAYERS */}
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
            
            {/* PREDICTIVE CUSTOMER DEMAND FORECAST BAR */}
            <div className={`w-full shrink-0 flex flex-col justify-center select-none px-3 py-1.5 rounded-2xl border transition-all duration-500 relative shadow-sm ${
              gameMode === 'zen'
                ? 'bg-[#faefe0] border-[#ddb892]/40 text-[#8a5a36]'
                : 'bg-[#191919] border-[#2c2c2c] text-stone-400'
            }`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[8px] font-mono font-black tracking-wider uppercase ${
                  gameMode === 'zen' ? 'text-[#8a5a36]/75' : 'text-stone-500'
                }`}>
                  🔮 Upcoming Demand Forecast (Predict Next Move)
                </span>
                <span className={`text-[8px] font-mono ${
                  gameMode === 'zen' ? 'text-[#8a5a36]/60' : 'text-stone-500'
                }`}>
                  Diners remaining: {gameState.levelCustomersTemplates.length - gameState.nextCustomerIndex}
                </span>
              </div>

              <div className="flex gap-3 items-center justify-start overflow-x-auto no-scrollbar py-0.5 min-h-[36px]">
                {gameState.levelCustomersTemplates.slice(gameState.nextCustomerIndex, gameState.nextCustomerIndex + 4).length > 0 ? (
                  gameState.levelCustomersTemplates.slice(gameState.nextCustomerIndex, gameState.nextCustomerIndex + 4).map((tmpl, idx) => {
                    const varietyConfig = SUSHI_VARIETIES[tmpl.orderedVariety];
                    return (
                      <motion.div
                        key={`upcoming-${idx}-${tmpl.characterName}`}
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-serif ${
                          gameMode === 'zen'
                            ? 'bg-[#fcf5ee] border border-[#e6ccb2]/45 text-stone-900 font-bold'
                            : 'bg-[#121212] border border-stone-800 text-[#fafaf9]'
                        }`}
                      >
                        <span className="text-base leading-none select-none filter drop-shadow">{tmpl.characterEmoji}</span>
                        <div className="flex items-center gap-2">
                          <SushiPlate
                            variety={tmpl.orderedVariety}
                            count={1}
                            size={gameMode === 'zen' ? 30 : 26}
                            active={false}
                            variant={gameMode === 'tweak' ? 'tweak' : 'classic'}
                          />
                          <div className="flex flex-col text-left leading-none justify-center">
                            <span className={`text-[8px] font-mono font-bold leading-none ${
                              gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-400'
                            }`}>
                              {tmpl.characterName}
                            </span>
                            <span className={`text-[10px] font-mono leading-none font-black mt-0.5 ${
                              gameMode === 'zen' ? 'text-[#5c3a21]' : 'text-indigo-300'
                            }`}>
                              × {tmpl.orderedCount}
                            </span>
                          </div>
                        </div>
                        {/* Small forecast position ticker */}
                        <span className="text-[7px] font-mono text-stone-500 bg-stone-900/10 dark:bg-stone-100/10 px-1 py-0.5 rounded-md self-center">
                          #{gameState.nextCustomerIndex + idx + 1}
                        </span>
                      </motion.div>
                    );
                  })
                ) : gameState.customersServed >= gameState.totalCustomersRequired &&
                  remainingDemandTotal === 0 ? (
                  <div className={`text-[10.5px] font-mono tracking-wide w-full text-center py-2 italic font-black animate-pulse flex items-center justify-center gap-1.5 ${
                    gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-emerald-400'
                  }`}>
                    ✨ All diners satisfied — closing station...
                  </div>
                ) : (
                  <div className="text-[10px] font-mono tracking-wide text-stone-500 w-full text-center py-2 italic">
                    🎉 All level diners have been seated! Satisfy the remaining customers to clear the station.
                  </div>
                )}
              </div>
            </div>

            {/* SINGLE UNIFIED DOORWAY ENTRY SYSTEM */}
            <div id="unified-central-entry-rail" className={`w-full shrink-0 flex flex-col items-center mb-0 select-none overflow-visible rounded-2xl relative border p-2 transition-all duration-300 ${
              gameMode === 'zen'
                ? 'bg-[#faefe0]/80 border-[#edd2b6]/40 shadow-inner'
                : 'bg-[#181818] border-stone-850 shadow-md'
            }`}>
              <div className="flex w-full items-center justify-between gap-1 relative overflow-visible">
                {/* IN SLIDERS */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-full select-none leading-none ${
                    gameMode === 'zen' ? 'bg-[#e2f0d9] text-[#2c581c]' : 'bg-emerald-950 text-emerald-400'
                  }`}>
                    IN
                  </span>
                  {/* Sliding panel box representation */}
                  <div className="w-14 h-8 bg-[#fbf6eb] border border-[#b5835a]/60 dark:border-stone-700/60 rounded flex items-center justify-center relative overflow-hidden shadow-sm">
                    {/* Grid texture inside sliding panel */}
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'repeating-linear-gradient(0, transparent, transparent 3px, #5c3a21 3px, #5c3a21 4px), repeating-linear-gradient(90deg, transparent, transparent 3px, #5c3a21 3px, #5c3a21 4px)'
                    }} />
                    {/* Sliding door panels moving open if we have active arrivals */}
                    <motion.div 
                      animate={gameState.customers.some(c => c && c.state === 'arriving') ? { x: -22 } : { x: 0 }}
                      className="absolute inset-y-0 left-0 w-1/2 bg-[#fcf5ee] border-r border-[#edd2b6]"
                    />
                    <motion.div 
                      animate={gameState.customers.some(c => c && c.state === 'arriving') ? { x: 22 } : { x: 0 }}
                      className="absolute inset-y-0 right-0 w-1/2 bg-[#fcf5ee] border-l border-[#edd2b6]"
                    />
                    <span className="text-[10px] z-10 filter drop-shadow scale-110">⛩️</span>
                  </div>
                </div>

                {/* Queue line: cute chibi heads of waiting customers */}
                <div id="doorway-queue-visualizer" className="flex-1 flex justify-center items-center gap-1 overflow-x-auto no-scrollbar mx-2 min-h-[30px] rounded-lg p-0.5 bg-[#edd2b6]/10">
                  <AnimatePresence>
                    {gameState.levelCustomersTemplates.slice(gameState.nextCustomerIndex).length > 0 ? (
                      gameState.levelCustomersTemplates.slice(gameState.nextCustomerIndex, gameState.nextCustomerIndex + 7).map((tmpl, idx) => (
                        <motion.div
                          key={`doorway-queue-${idx}-${tmpl.characterEmoji}`}
                          initial={{ opacity: 0, scale: 0.2, y: 15 }}
                          animate={{ opacity: 0.85, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.2 }}
                          transition={{ type: 'spring', damping: 10, stiffness: 120 }}
                          className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs filter drop-shadow hover:scale-110 select-none cursor-help"
                          title={tmpl.characterName}
                        >
                          {tmpl.characterEmoji}
                        </motion.div>
                      ))
                    ) : (
                      <span className="text-[7.5px] font-mono text-stone-500 italic uppercase tracking-wider animate-pulse">
                        All Level Diners Seated! 🎐
                      </span>
                    )}
                  </AnimatePresence>
                </div>

                {/* OUT SLIDERS */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-14 h-8 bg-[#fbf6eb] border border-[#b5835a]/60 dark:border-stone-700/60 rounded flex items-center justify-center relative overflow-hidden shadow-sm">
                    {/* Grid texture inside sliding panel */}
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'repeating-linear-gradient(0, transparent, transparent 3px, #5c3a21 3px, #5c3a21 4px), repeating-linear-gradient(90deg, transparent, transparent 3px, #5c3a21 3px, #5c3a21 4px)'
                    }} />
                    {/* Sliding door panels moving open if we have active departures */}
                    <motion.div 
                      animate={gameState.customers.some(c => c && c.state === 'leaving') ? { x: -22 } : { x: 0 }}
                      className="absolute inset-y-0 left-0 w-1/2 bg-[#fcf5ee] border-r border-[#edd2b6]"
                    />
                    <motion.div 
                      animate={gameState.customers.some(c => c && c.state === 'leaving') ? { x: 22 } : { x: 0 }}
                      className="absolute inset-y-0 right-0 w-1/2 bg-[#fcf5ee] border-l border-[#edd2b6]"
                    />
                    <span className="text-[10px] z-10 filter drop-shadow scale-110">⛩️</span>
                  </div>
                  <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-full select-none leading-none ${
                    gameMode === 'zen' ? 'bg-[#f0d4d4] text-[#711e1e]' : 'bg-rose-950 text-rose-400'
                  }`}>
                    OUT
                  </span>
                </div>
              </div>
            </div>

            {/* THE CONVEYOR & DINERS LAYOUT (Left seat, Conveyor, Right seat) */}
            <div
              ref={platePlayfieldRef}
              id="plate-playfield"
              className="relative flex flex-col gap-2 shrink-0 min-h-0"
            >
            <div id="game-stage" className="game-stage w-full min-h-0 flex-1">
              <div className="w-full max-h-full flex items-center justify-center min-h-0 max-w-full px-0.5">
            <div id="diners-conveyor-wrapper" className={`flex items-center justify-center gap-0.5 w-full max-h-full relative overflow-hidden transition-colors duration-500 ${
              gameMode === 'zen' 
                ? 'bg-transparent border-none p-0' 
                : 'bg-[#141414] p-2 border border-stone-850 shadow-lg rounded-2xl'
            }`}>
              


              {/* Left Seats */}
              <div id="left-seat-frame" className="flex flex-col gap-0.5 items-center z-10 overflow-visible w-14 xl:w-16 shrink-0">
                <CustomerSeat 
                  customer={gameState.customers[0]} 
                  seatIndex={0} 
                  side="left" 
                  onArrived={handleCustomerArrived}
                  variant={gameMode}
                />
                <CustomerSeat 
                  customer={gameState.customers[1]} 
                  seatIndex={1} 
                  side="left" 
                  onArrived={handleCustomerArrived}
                  variant={gameMode}
                />
              </div>

              {/* Conveyor Belt in center */}
              <div id="conveyor-belt-frame" className="overflow-hidden transition-all duration-500 flex-[3] min-w-0 w-full max-h-full">
                <ConveyorBelt
                  plates={gameState.beltPlates}
                  highlightedSlots={beltWarnings}
                  beltSpeed={gameState.beltSpeed}
                  onPlateClick={(p) => sfx.playError()}
                  onBeltTap={() => {
                    sfx.playDispatch();
                    setGameState((prev) => {
                      const newSpeed = Math.max(240, prev.beltSpeed * 0.72);
                      return {
                        ...prev,
                        beltSpeed: newSpeed,
                      };
                    });
                  }}
                  variant={gameMode}
                />
              </div>

              {/* Right Seats */}
              <div id="right-seat-frame" className="flex flex-col gap-0.5 items-center z-10 overflow-visible w-14 xl:w-16 shrink-0">
                <CustomerSeat 
                  customer={gameState.customers[2]} 
                  seatIndex={2} 
                  side="right" 
                  onArrived={handleCustomerArrived}
                  variant={gameMode}
                />
                <CustomerSeat 
                  customer={gameState.customers[3]} 
                  seatIndex={3} 
                  side="right" 
                  onArrived={handleCustomerArrived}
                  variant={gameMode}
                />
              </div>

            </div>
              </div>
            </div>

            {/* BUFFER STORAGE TRAY */}
            <div className="shrink-0 w-full">
            <FreeBuffer
              freeSlots={gameState.freeSlots}
              hasUnlockedFifthSlot={gameState.hasUnlockedFifthSlot}
              onBufferPlateClick={handleBufferPlateClick}
              onUnlockSlot={() => {
                if (gameState.coins >= 80) {
                  handleBuyFifthSlot();
                } else {
                  handleAdvertiseUnlock();
                }
              }}
              coinCostToUnlock={80}
              playerCoins={gameState.coins}
              variant={gameMode}
            />
            </div>

            {/* INGREDIENT QUEUES */}
            <div className="shrink-0 w-full">
            <QueueDispenser
              queues={gameState.queues}
              onDispatch={handleDispatchQueue}
              isBeltSlotOccupied={isBeltSlotOccupied}
              variant={gameMode}
              activeCustomerVarieties={gameState.customers.filter((c) => c && c.state === 'waiting').map((c) => c!.orderedVariety)}
            />
            </div>
            <PlateTransferOverlay
              transfers={activeTransfers}
              onComplete={handleTransferComplete}
            />
            </div>
          </div>

          {/* MOBILE ONLY SMALL FOOTER */}
          <footer className="shrink-0 mt-1 p-2 bg-[#141414] border border-[#2c2c2c] rounded-2xl flex justify-between items-center xl:hidden text-stone-400">
            <div className="text-left font-mono text-[9px]">
              <div>Served: {gameState.customersServed}/{gameState.totalCustomersRequired}</div>
              <div className="w-16 h-1 bg-stone-900 rounded-full mt-0.5 overflow-hidden">
                <div 
                  className="h-full bg-[#d94e33]"
                  style={{ width: `${(gameState.customersServed / gameState.totalCustomersRequired) * 100}%` }}
                />
              </div>
            </div>
            
            <button
              onClick={handleRestartGame}
              className="py-1 px-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-stone-800 text-[10px] font-mono text-[#d94e33] font-bold rounded-lg transition"
            >
              Restart
            </button>
          </footer>

        </section>

        {/* RIGHT SIDEBAR: Primary statistics and shop upgrades */}
        <aside 
          className={`w-72 h-full min-h-0 p-6 flex flex-col justify-between hidden xl:flex shrink-0 overflow-hidden transition-all duration-500 ${
            gameMode === 'zen' 
              ? 'border-l-2 border-[#b5835a]/30 bg-[#faf2e9]' 
              : 'bg-[#141414] border-l border-[#2d2d2d]'
          }`}
        >
          <div className="space-y-6">
            <div className="space-y-1">
              <span className={`text-[10px] font-mono tracking-[0.1em] uppercase block ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-500'}`}>
                Session Score
              </span>
              <div className={`text-4xl font-serif italic tracking-wider leading-none font-bold ${gameMode === 'zen' ? 'text-stone-900 font-black' : 'text-[#fafaf9]'}`}>
                {gameState.score}
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-wide block font-bold ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-[#d94e33]'}`}>
                RESTORATION STREAK
              </span>
            </div>

            <div className={`space-y-1.5 pt-4 border-t ${gameMode === 'zen' ? 'border-[#b5835a]/20' : 'border-[#222]'}`}>
              <span className={`text-[10px] font-mono tracking-[0.1em] uppercase block ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-500'}`}>
                Collected Tips
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-mono font-black text-amber-500">
                  🪙{gameState.coins}
                </span>
              </div>
            </div>

            {/* Belt speed calibration */}
            <div className={`space-y-1.5 pt-4 border-t ${gameMode === 'zen' ? 'border-[#b5835a]/20' : 'border-[#222]'}`}>
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-mono tracking-[0.1em] uppercase block font-bold ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-500'}`}>
                  Belt Speed
                </span>
                <span className={`text-[9px] font-mono font-black ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-teal-400'}`}>
                  {Math.round(gameState.beltSpeed)}ms
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                step="50"
                value={zenBaseBeltSpeed}
                onChange={(e) => {
                  const spd = parseInt(e.target.value, 10);
                  setZenBaseBeltSpeed(spd);
                  setGameState((prev) => ({
                    ...prev,
                    beltSpeed: Math.min(prev.beltSpeed, spd),
                  }));
                }}
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${gameMode === 'zen' ? 'accent-[#8a5a36] bg-[#eedbc5]/60' : 'accent-teal-500 bg-stone-900'}`}
              />
              <div className={`flex justify-between text-[7px] font-mono uppercase font-bold ${gameMode === 'zen' ? 'text-[#8a5a36]/60' : 'text-stone-600'}`}>
                <span>Fast</span>
                <span>Slow</span>
              </div>
              {gameMode === 'zen' && (
                <p className="text-[8px] font-mono text-[#8a5a36]/70 leading-snug">
                  Tap the pond to turbo; speed decays back to this baseline.
                </p>
              )}
            </div>

            {/* Eating speed — Zen runtime tweak */}
            <div className={`space-y-1.5 pt-4 border-t ${gameMode === 'zen' ? 'border-[#b5835a]/20' : 'border-[#222]'}`}>
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-mono tracking-[0.1em] uppercase block font-bold ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-500'}`}>
                  Eating Speed
                </span>
                <span className={`text-[9px] font-mono font-black ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-amber-400'}`}>
                  {zenTimeToEat}ms
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="10"
                value={zenTimeToEat}
                onChange={(e) => {
                  setZenTimeToEat(parseInt(e.target.value, 10));
                }}
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${gameMode === 'zen' ? 'accent-[#8a5a36] bg-[#eedbc5]/60' : 'accent-amber-500 bg-stone-900'}`}
              />
              <div className={`flex justify-between text-[7px] font-mono uppercase font-bold ${gameMode === 'zen' ? 'text-[#8a5a36]/60' : 'text-stone-600'}`}>
                <span>Instant (0)</span>
                <span>Slow (3000)</span>
              </div>
              <p className="text-[8px] font-mono text-[#8a5a36]/70 leading-snug">
                Delay per bite while chopsticks animate. Applies immediately to new bites.
              </p>
            </div>

            {/* Upgrades panel in dark custom flat wrapper */}
            <div className={`rounded-2xl p-4 space-y-2.5 border ${
              gameMode === 'zen' 
                ? 'bg-[#fcf5ee] border-[#b5835a]/30' 
                : 'bg-[#191919] border border-[#2d2d2d]'
            }`}>
              <span className={`text-[9px] font-mono tracking-[0.1em] uppercase block font-bold ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-stone-500'}`}>
                TRAY REINFORCEMENT
              </span>
              <p className={`text-[11px] font-mono leading-relaxed ${gameMode === 'zen' ? 'text-[#8a5a36]/80 font-bold' : 'text-stone-400'}`}>
                Unlock the 5th Backup Storage tray slot to prevent immediate buffer overflow as speeds accelerate.
              </p>
              {gameState.hasUnlockedFifthSlot ? (
                <div className={`text-[10px] font-mono flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg border ${
                  gameMode === 'zen' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' 
                    : 'bg-[#121c16] border-emerald-900/30 text-emerald-400'
                }`}>
                  ✓ Double Buffer Armed!
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    onClick={handleBuyFifthSlot}
                    className={`py-1.5 text-[#fafaf9] text-xs font-mono font-bold rounded-lg transition shadow-md cursor-pointer ${
                      gameMode === 'zen' ? 'bg-[#8a5a36] hover:bg-[#724624]' : 'bg-[#d94e33] hover:bg-[#c2422b]'
                    }`}
                  >
                    Pay tips (🪙80)
                  </button>
                  <button
                    onClick={handleAdvertiseUnlock}
                    className={`py-1 text-[10px] font-mono rounded-lg transition border cursor-pointer ${
                      gameMode === 'zen' 
                        ? 'bg-transparent text-[#8a5a36] border-[#b5835a]/45 hover:bg-[#b5835a]/10' 
                        : 'bg-[#1a1a1a] text-stone-400 border border-stone-800 hover:bg-[#222]'
                    }`}
                  >
                    Quick sponsor video ad
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`space-y-3 pt-4 border-t ${gameMode === 'zen' ? 'border-[#b5835a]/20' : 'border-[#222]'}`}>
            <button
              onClick={handleRestartGame}
              className={`w-full py-2 text-xs font-mono rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer uppercase font-bold border ${
                gameMode === 'zen' 
                  ? 'bg-amber-100 hover:bg-amber-200 text-[#8a5a36] border-[#b5835a]/30' 
                  : 'bg-[#1c1c1c] hover:bg-[#222] text-stone-400 border border-[#2d2d2d]'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${gameMode === 'zen' ? 'text-[#8a5a36]' : 'text-[#d94e33]'}`} />
              Restart Machine
            </button>
          </div>
        </aside>

      </div>
      )}

      {/* OVERLAY: Sponsor Ad Viewer */}
      {showAdSpinner && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="text-center max-w-xs bg-[#191919] border border-[#2d2d2d] p-6 rounded-3xl shadow-2xl flex flex-col items-center">
            <span className="text-4xl animate-bounce mb-3">📺</span>
            <h3 className="text-xs font-serif italic text-[#d94e33] uppercase tracking-wider mb-1 font-bold text-lg">
              Sponsor Broadcast
            </h3>
            <p className="text-[10px] text-stone-400 font-mono mb-4 leading-normal">
              "Master Chef Sushi Academy lessons are now open! Learn secret recipes from Tokyo master chefs..."
            </p>
            {/* Minimalist flat custom spinner */}
            <div className="w-10 h-10 border-2 border-stone-850 border-t-[#d94e33] rounded-full animate-spin mb-4" />
            <span className="text-[9px] text-[#fafaf9]/30 font-mono uppercase tracking-widest">
              Arming 5th Buffer Slot in 3s...
            </span>
          </div>
        </div>
      )}

      {/* OVERLAY: Level milestone completed */}
      {levelUpMessage && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs z-45 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1a1a1a] border border-[#2d2d2d] p-6 rounded-3xl text-center max-w-xs shadow-2xl flex flex-col items-center"
          >
            <div className="text-4xl mb-3 animate-pulse">🎉</div>
            <h2 className="text-xl font-serif italic text-[#fafaf9] tracking-wide font-bold">
              Level Completed!
            </h2>
            <p className="text-[11px] text-[#fafaf9]/60 font-mono mt-1.5">
              The kitchen speed has accelerated! 🍣
            </p>
            <div className="bg-[#121c16] px-4 py-2 border border-emerald-950/40 rounded-xl my-4 flex items-center gap-2">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                Tips Reward: +🪙50 Bonus
              </span>
            </div>
            <button
              id="btn-next-level"
              onClick={handleNextLevelStart}
              className="w-full py-2.5 bg-[#d94e33] hover:bg-[#c2422b] text-[#fafaf9] font-black font-mono text-xs rounded-xl shadow-md transition-transform flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              Start Level {gameState.level}
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}

      {/* OVERLAY: Grand Game Victory (Beat Level 5) */}
      {gameState.isGameVictory && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-45 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1a1c18] border-2 border-emerald-500/50 p-8 rounded-[32px] text-center max-w-sm shadow-2xl flex flex-col items-center"
          >
            <div className="text-5xl mb-4 animate-bounce">🏆👑🍣</div>
            <h2 className="text-2xl font-serif italic text-emerald-400 font-extrabold tracking-wide uppercase leading-tight">
              Victory!
            </h2>
            <h3 className="text-sm font-serif italic text-[#fafaf9] mt-1 font-bold">
              Kaizen Grand Master Chef
            </h3>
            <p className="text-[11px] text-[#fafaf9]/75 mt-2.5 font-mono leading-relaxed">
              Incredible! You have successfully cleared all 5 challenge levels in perfect balance under the Law of System Balance. Not a single plate went wasted!
            </p>

            {/* Score statistics dashboard */}
            <div className="w-full bg-[#121412] border border-[#2d2f2d] p-4 rounded-2xl my-5 text-left grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <span className="text-stone-500 block text-[8px] uppercase tracking-wider">Final Score</span>
                <span className="text-emerald-300 font-black text-sm">{gameState.score} pts</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[8px] uppercase tracking-wider font-bold">Tips Collected</span>
                <span className="font-black text-amber-400 text-sm">🪙{gameState.coins}</span>
              </div>
            </div>

            <button
              id="btn-victory-restart"
              onClick={() => {
                sfx.playCoinDing();
                handleRestartGame();
              }}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black font-mono text-xs rounded-xl shadow-lg transition-transform flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              PLAY AGAIN & RETAIN SKILLS
            </button>
          </motion.div>
        </div>
      )}

      {/* OVERLAY: Game Over Buffer Overflow */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-45 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1a1a1a] border border-[#d94e33]/50 p-6 rounded-3xl text-center max-w-xs shadow-2xl flex flex-col items-center"
          >
            <div className="text-4xl mb-2">💥</div>
            <h2 className="text-lg font-serif italic text-[#d94e33] font-bold uppercase">
              Buffer Overflow!
            </h2>
            <p className="text-[11px] text-[#fafaf9]/60 mt-1 font-mono leading-relaxed">
              Too many plates bypassed customers and filled the buffer tray. The restoration loop stopped!
            </p>

            {/* Score stats */}
            <div className="w-full bg-[#121212] border border-[#2d2d2d] p-3.5 rounded-2xl my-4 text-left grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-stone-500 block text-[8px] uppercase tracking-wide">High score</span>
                <span className="text-white font-bold">{gameState.score} pts</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[8px] uppercase tracking-wide">Last Station</span>
                <span className="font-bold text-white">LV.{gameState.level}</span>
              </div>
            </div>

            <button
              id="btn-play-again"
              onClick={handleRestartGame}
              className="w-full py-2.5 bg-[#d94e33] hover:bg-[#c2422b] text-[#fafaf9] font-bold font-mono text-xs rounded-xl shadow-md transition-transform flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              PLAY AGAIN
            </button>
          </motion.div>
        </div>
      )}

      {/* OVERLAY: Interactive step-by-step tutorial board */}
      {showTutorial && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-45 flex items-center justify-center p-5">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1a1a1a] border border-[#2d2d2d] p-5 rounded-3xl text-left max-w-sm shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto"
          >
            <div className="text-center">
              <span className="text-4xl">🍣</span>
              <h2 className="text-xl font-serif italic text-[#fafaf9] font-bold tracking-wide mt-2">
                Kaizen Zushi Restaurant
              </h2>
              <span className="text-[9px] font-mono text-stone-500 uppercase tracking-widest block mt-0.5">
                Pattern Conveyor Game Guide
              </span>
            </div>

            {/* Sushi index */}
            <div className="my-4 bg-[#121212] p-3 rounded-2xl border border-stone-850">
              <h3 className="text-[10px] font-mono font-bold text-[#d94e33] uppercase tracking-widest mb-2.5">
                VARIETY SHAPES & OUTLINES
              </h3>
              <div className="space-y-2.5 text-[10px] font-mono text-stone-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#f7f4eb] border border-amber-900 flex items-center justify-center text-xs">🔴</div>
                  <div>
                    <span className="font-bold text-[#fafaf9]">Tuna (Maguro):</span> Cream Circle plate. Sleek Oval Slice.
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded bg-[#e6c280] border border-amber-800 flex items-center justify-center text-xs">🟠</div>
                  <div>
                    <span className="font-bold text-[#fafaf9]">Calif. Roll:</span> Tan Square plate. Textured Outer Rim.
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#134e4a] border border-emerald-950 flex items-center justify-center text-xs">🟢</div>
                  <div>
                    <span className="font-bold text-[#fafaf9]">Cucumber (Kappa):</span> Dark Emerald plate. Crisp White Ring.
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 bg-[#8b5a2b] border border-yellow-800 rounded-sm flex items-center justify-center overflow-hidden"><div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[13px] border-b-yellow-400" /></div>
                  <div>
                    <span className="font-bold text-[#fafaf9]">Egg (Tamago):</span> Wood Triangle plate. Seaweed Staple.
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#1e3a8a] border border-blue-900 flex items-center justify-center text-xs">🦐</div>
                  <div>
                    <span className="font-bold text-[#fafaf9]">Shrimp (Ebi):</span> Ocean Blue Circle. Pointed Tail Fan.
                  </div>
                </div>
              </div>
            </div>

            {/* Layout parameters */}
            <div className="space-y-2 text-[10px] text-stone-400 font-mono leading-relaxed">
              <span className="font-bold text-[#d94e33] uppercase block tracking-wider">How to Play:</span>
              <p>
                1. <span className="text-[#fafaf9] font-bold">Tap Kitchen Columns:</span> Launch sushi into bottom lanes of the rotating anti-clockwise conveyor belt.
              </p>
              <p>
                2. <span className="text-[#fafaf9] font-bold">Interception:</span> Seated diners automatically take matching plates when they pass by!
              </p>
              <p>
                3. <span className="text-[#fafaf9] font-bold">Avoid Overflow:</span> Plates that complete a 360° turn drop to the Leftover Buffer. Keep it empty to avoid game overflow!
              </p>
            </div>

            <button
              id="btn-tutorial-start"
              onClick={handleStartGame}
              className="mt-4 w-full py-2.5 bg-[#d94e33] hover:bg-[#c2422b] text-[#fafaf9] font-bold font-mono text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current text-[#fafaf9]" />
              {hasFirstLaunch ? 'RESUME GAME' : 'START PLAYING'}
            </button>
          </motion.div>
        </div>
      )}

    </div>
  );
}

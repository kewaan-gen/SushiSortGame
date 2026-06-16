/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React from 'react';
import { Plate } from '../types';
import { SushiPlate } from './SushiPlate';
import { motion } from 'motion/react';
import { Plus, Lock } from 'lucide-react';

interface FreeBufferProps {
  freeSlots: (Plate | null)[];
  hasUnlockedFifthSlot: boolean;
  onBufferPlateClick: (plate: Plate, slotIdx: number) => void;
  onUnlockSlot: () => void;
  coinCostToUnlock: number;
  playerCoins: number;
  variant?: 'classic' | 'zen' | 'tweak';
  dockCrashThreshold?: number;
}

export const FreeBuffer: React.FC<FreeBufferProps> = ({
  freeSlots,
  hasUnlockedFifthSlot,
  onBufferPlateClick,
  onUnlockSlot,
  coinCostToUnlock,
  playerCoins,
  variant = 'classic',
  dockCrashThreshold = 5,
}) => {
  const totalSlots = variant === 'tweak' ? dockCrashThreshold : (hasUnlockedFifthSlot ? 5 : 4);
  const occupiedCount = freeSlots.filter(Boolean).length;

  if (variant === 'tweak') {
    return (
      <div className="w-full bg-[#090d14] border border-[#1e293b] rounded-xl p-2 shadow-lg select-none">
        {/* Header bar for buffer */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">🗄️</span>
            <h3 className="text-[10px] font-mono font-extrabold text-[#60a5fa] tracking-wider uppercase">
              TRAY STORAGE ({occupiedCount}/{totalSlots})
            </h3>
          </div>
          <div className="text-[7.5px] text-[#475569] font-mono tracking-tight font-extrabold uppercase">
            Buffer Dock Queue
          </div>
        </div>

        {/* Grid of Slots */}
        <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
          {Array.from({ length: totalSlots }).map((_, idx) => {
            const plate = freeSlots[idx] || null;

            return (
              <div
                key={idx}
                className={`relative h-[52px] rounded-lg flex items-center justify-center transition-all duration-250 ${
                  plate
                    ? 'bg-[#0a0f1d] border-2 border-[#10b981]'
                    : 'bg-[#06080d] border border-dashed border-[#1e293b]'
                }`}
              >
                {plate ? (
                  <motion.div
                    layoutId={plate.id}
                    className="cursor-pointer"
                    onClick={() => onBufferPlateClick(plate, idx)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <SushiPlate variety={plate.variety} count={plate.count} size={34} variant={variant} />
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-30">
                    <span className="text-[7px] text-[#94a3b8] font-mono font-bold">
                      SLOT_0{idx}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'zen') {
    return (
      <div className="w-full bg-transparent border-none rounded-none p-0 select-none">
        {/* Header bar styled for Zen Garden Mode */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🗄️</span>
            <h3 className="text-xs font-serif font-black text-[#5c3a21] italic tracking-wide">
              Tray Buffer Storage ({occupiedCount}/{totalSlots})
            </h3>
          </div>
          <div className="text-[8.5px] text-[#8a5a36] font-mono tracking-tight font-bold uppercase">
            Click target plates to reload
          </div>
        </div>

        {/* Beautiful Row representation of nested circular wooden trays */}
        <div className="flex justify-around items-center gap-2 max-w-md mx-auto py-2 px-1.5 bg-[#fceada]/60 border-2 border-[#b5835a]/40 rounded-3xl shadow-inner">
          {Array.from({ length: 5 }).map((_, idx) => {
            // If the 5th slot is not unlocked yet, we render a lock button
            if (idx === 4 && !hasUnlockedFifthSlot) {
              return (
                <button
                  key="lock-slot"
                  id="btn-unlock-slot"
                  onClick={onUnlockSlot}
                  className="w-14 h-14 rounded-full border-2 border-dashed border-[#9c6644] bg-[#9c6644]/5 hover:bg-[#9c6644]/15 flex flex-col items-center justify-center text-[#9c6644] cursor-pointer active:scale-95 transition-all duration-200"
                >
                  <Lock className="w-3.5 h-3.5 mb-0.5" />
                  <span className="text-[7px] font-bold font-mono tracking-tighter">🪙{coinCostToUnlock}</span>
                </button>
              );
            }

            const plate = freeSlots[idx];

            return (
              <div
                key={idx}
                className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  // Realistic wooden circles with depth
                  background: 'radial-gradient(circle, #5c3a21 0%, #3e1f0a 100%)',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1)',
                  border: '3px solid #8a5a36',
                }}
              >
                {/* Thin internal gold concentric circle */}
                <div className="absolute inset-1 rounded-full border border-yellow-600/25 pointer-events-none" />

                {plate ? (
                  <motion.div
                    layoutId={plate.id}
                    className="cursor-pointer z-10"
                    onClick={() => onBufferPlateClick(plate, idx)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <SushiPlate variety={plate.variety} count={plate.count} size={42} />
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-25">
                    <span className="text-[7px] text-[#fbf5ee] font-mono uppercase font-bold tracking-wider">
                      Tray {idx + 1}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Classic fallback
  return (
    <div className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-2xl p-2.5 shadow-lg select-none">
      {/* Header bar for buffer */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">🗄️</span>
          <h3 className="text-xs font-serif italic text-stone-300 tracking-wide">
            Leftover Buffer Tray ({occupiedCount}/{totalSlots})
          </h3>
        </div>
        <div className="text-[8px] text-[#fafaf9]/40 font-mono tracking-tight uppercase">
          Reload plates from overflow
        </div>
      </div>

      {/* Grid of Slots */}
      <div className="grid grid-cols-5 gap-2.5 max-w-sm mx-auto">
        {Array.from({ length: 5 }).map((_, idx) => {
          // If the 5th slot is not unlocked yet, we render a lock button
          if (idx === 4 && !hasUnlockedFifthSlot) {
            return (
              <button
                key="lock-slot"
                id="btn-unlock-slot"
                onClick={onUnlockSlot}
                className="h-[60px] border border-dashed border-[#d94e33]/30 bg-[#d94e33]/5 hover:bg-[#d94e33]/10 rounded-xl flex flex-col items-center justify-center text-[#d94e33]/80 hover:text-[#d94e33] cursor-pointer active:scale-95 transition-all duration-200"
              >
                <Lock className="w-3.5 h-3.5 text-[#d94e33] animate-pulse mb-0.5" />
                <span className="text-[8px] font-mono leading-none tracking-tight">Unlock</span>
                <span className="text-[7px] font-mono font-bold text-amber-500 mt-0.5">
                  🪙{coinCostToUnlock}
                </span>
              </button>
            );
          }

          const plate = freeSlots[idx];

          return (
            <div
              key={idx}
              className={`relative h-[60px] rounded-xl flex items-center justify-center transition-all duration-200 ${
                plate
                  ? 'bg-[#121212] border border-[#d94e33]/40'
                  : 'bg-[#121212] border border-dashed border-stone-800'
              }`}
            >
              {plate ? (
                <motion.div
                  layoutId={plate.id}
                  className="cursor-pointer"
                  onClick={() => onBufferPlateClick(plate, idx)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.93 }}
                >
                  <SushiPlate variety={plate.variety} count={plate.count} size={38} />
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center opacity-20">
                  <span className="text-[8px] text-[#fafaf9] font-mono">
                    S{idx + 1}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

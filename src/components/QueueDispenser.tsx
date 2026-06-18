/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plate, SushiVariety } from '../types';
import { SushiPlate } from './SushiPlate';
import { ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QueueDispenserProps {
  queues: Plate[][]; // Array of 3 columns, each column is a list of Plates
  onDispatch: (queueIdx: number) => void;
  isBeltSlotOccupied: (slotIdx: number) => boolean;
  variant?: 'classic' | 'zen' | 'tweak';
  activeCustomerVarieties?: SushiVariety[];
}

export const QueueDispenser: React.FC<QueueDispenserProps> = ({
  queues,
  onDispatch,
  isBeltSlotOccupied,
  variant = 'classic',
  activeCustomerVarieties = [],
}) => {
  if (variant === 'tweak') {
    return (
      <div className="w-full bg-[#090d14] border border-[#1e293b] rounded-xl p-2 shadow-lg select-none">
        {/* Label block */}
        <div className="flex justify-between items-center mb-1.5 px-1">
          <h4 className="text-[10px] font-mono font-extrabold text-[#60a5fa] tracking-wider flex items-center gap-1.5">
            <span>⚙️</span> INPUT TRACKS
          </h4>
          <span className="text-[7.5px] font-mono text-[#475569] uppercase tracking-wider font-bold">
            Data Node Insertion Channels
          </span>
        </div>

        {/* 3 columns design */}
        <div 
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${queues.length}, minmax(0, 1fr))` }}
        >
          {queues.map((col, colIdx) => {
            const targetSlotIdx = colIdx + 1;
            const isBlocked = isBeltSlotOccupied(targetSlotIdx);

            return (
              <div
                key={colIdx}
                className="flex flex-col items-center bg-[#070a0f] border border-[#1e293b] rounded-lg p-2 relative h-40 justify-start pt-7 transition-all overflow-visible select-none"
              >
                {/* Visual Pipeline Central Track Line */}
                <div className="absolute inset-y-1 w-[2px] bg-[#1e293b] rounded" />

                {/* Arrow indicator */}
                <div className="absolute top-1 flex flex-col items-center z-10 pointer-events-none">
                  <span
                    className={`text-[6.5px] font-mono px-1 py-0.5 rounded scale-90 font-bold ${
                      isBlocked
                        ? 'bg-rose-950/80 text-rose-400 border border-rose-900/40'
                        : 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/40'
                    }`}
                  >
                    {isBlocked ? 'BLOCKED' : `CH_0${targetSlotIdx}`}
                  </span>
                </div>

                {/* Column Stack (row 0 front/top -> row 1 -> row 2 bottom) */}
                <div className="flex flex-col items-center gap-1.5 z-20 w-full mt-2">
                  <AnimatePresence>
                    {col.slice(0, 3).map((plate, rowIdx) => {
                      const isFront = rowIdx === 0;
                      const isMatch = isFront && activeCustomerVarieties.includes(plate.variety);

                      let size = 18;
                      let opacity = 'opacity-35 scale-75';
                      if (rowIdx === 1) {
                        size = 26;
                        opacity = 'opacity-65 scale-90';
                      } else if (isFront) {
                        size = 38;
                        opacity = 'opacity-100 scale-100';
                      }

                      return (
                        <motion.div
                           key={plate.id}
                           layout
                           initial={{ opacity: 0, y: 15 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, scale: 0.8 }}
                           transition={{
                             type: 'spring',
                             stiffness: 160,
                             damping: 15,
                           }}
                           className={`flex justify-center items-center relative transition-transform duration-200 ${opacity} ${
                             isFront
                               ? 'cursor-pointer hover:scale-110 active:scale-95 drop-shadow z-30'
                               : 'pointer-events-none'
                           }`}
                           onClick={(e) => {
                             if (isFront) {
                               e.stopPropagation();
                               onDispatch(colIdx);
                             }
                           }}
                        >
                          {isMatch && (
                            <div className="absolute inset-0 rounded-full border border-indigo-400 animate-ping opacity-65 scale-125 pointer-events-none" />
                          )}
                          <SushiPlate
                            variety={plate.variety}
                            count={plate.count}
                            size={size}
                            active={isFront}
                            variant={variant}
                          />
                          {isMatch && (
                            <span className="absolute -top-1 -right-2 bg-indigo-600 text-white border border-indigo-300 text-[5px] font-mono leading-none px-0.5 py-0.5 rounded-sm font-extrabold rotate-3 animate-bounce scale-90 z-40">
                              MATCH
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
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
        {/* Label block */}
        <div className="flex justify-between items-center mb-1.5 outline-none px-1">
          <h4 className="text-xs font-serif font-black text-[#5c3a21] italic tracking-wide flex items-center gap-1.5">
            <span>🎋</span> Dispatch Kitchen Lanes
          </h4>
          <div className="text-[8.5px] font-mono text-[#8a5a36] font-bold tracking-tight uppercase">
            Launch plates onto central belt
          </div>
        </div>

        {/* 3 columns design */}
        <div className="grid grid-cols-3 gap-3">
          {queues.map((col, colIdx) => {
            const targetSlotIdx = colIdx;
            const isBlocked = isBeltSlotOccupied(targetSlotIdx);

            return (
              <div
                key={colIdx}
                className="flex flex-col items-center bg-[#f7eedc] rounded-2xl border-4 border-[#b5835a]/50 hover:border-[#b5835a] shadow-inner p-2 relative h-36 xl:h-40 justify-start pt-8 transition-all overflow-visible select-none"
              >
                {/* Vertical tracks - bamboo shoots inside lanes */}
                <div className="absolute inset-y-2 w-[5px] bg-[#4d8b31]/45 rounded-full" />
                <div className="absolute inset-y-2 w-[1px] bg-[#3a5a40]/30" />

                {/* Belt Entrance Connector/Arrow */}
                <div className="absolute top-2 flex flex-col items-center z-10 pointer-events-none">
                  <ChevronUp
                    className={`w-3.5 h-3.5 -mb-1 select-none pointer-events-none ${
                      isBlocked ? 'text-red-500 animate-pulse' : 'text-emerald-500'
                    }`}
                  />
                  <span
                    className={`text-[8px] font-mono font-black scale-90 px-1 py-0.5 rounded leading-none ${
                      isBlocked
                        ? 'bg-red-200 text-red-700 border border-red-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {isBlocked ? 'Wait' : `Slot ${targetSlotIdx}`}
                  </span>
                </div>

                {/* Column Stack (row 0 front/top -> row 1 -> row 2 bottom) */}
                <div className="flex flex-col items-center gap-2.5 z-20 w-full">
                  <AnimatePresence>
                    {col.slice(0, 3).map((plate, rowIdx) => {
                      const isFront = rowIdx === 0;
                      const isMatch = isFront && activeCustomerVarieties.includes(plate.variety);

                      // Proportions: topmost plate is largest, clearly visible
                      let size = 28;
                      let opacity = 'opacity-35 scale-80';
                      if (rowIdx === 1) {
                        size = 38;
                        opacity = 'opacity-70 scale-90';
                      } else if (isFront) {
                        size = 56; // Extra prominent size
                        opacity = 'opacity-100 scale-100';
                      }

                      return (
                        <motion.div
                          key={plate.id}
                          layout
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{
                            type: 'spring',
                            stiffness: 160,
                            damping: 15,
                          }}
                          className={`flex justify-center items-center relative transition-transform duration-200 ${opacity} ${
                            isFront
                              ? 'cursor-pointer hover:scale-110 active:scale-95 drop-shadow-md z-30'
                              : 'pointer-events-none'
                          }`}
                          onClick={(e) => {
                            if (isFront) {
                              e.stopPropagation();
                              onDispatch(colIdx);
                            }
                          }}
                        >
                          {isMatch && (
                            <div className="absolute inset-0 rounded-full border-2 border-amber-500 animate-ping opacity-65 scale-125 pointer-events-none" />
                          )}
                          <SushiPlate
                            variety={plate.variety}
                            count={plate.count}
                            size={size}
                            active={isFront}
                          />
                          {isMatch && (
                            <span className="absolute -top-1 -right-1 bg-amber-500 text-stone-900 border border-amber-300 text-[6px] font-mono leading-none px-1 py-0.5 rounded-full font-black tracking-tighter uppercase animate-bounce scale-90 z-40">
                              MATCH
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback to classic
  return (
    <div className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-2xl p-2.5 shadow-lg select-none">
      {/* Label block */}
      <div className="flex justify-between items-center mb-1.5 outline-none">
        <h4 className="text-xs font-serif italic text-stone-300 tracking-wide flex items-center gap-1">
          <span>🍽️</span> Dispatch Kitchen Columns
        </h4>
        <div className="text-[8px] font-mono text-[#fafaf9]/40 tracking-tight uppercase">
          Tap columns to shoot plate onto belt
        </div>
      </div>

      {/* 3 columns design */}
      <div className="grid grid-cols-3 gap-3">
        {queues.map((col, colIdx) => {
          const targetSlotIdx = colIdx;
          const isBlocked = isBeltSlotOccupied(targetSlotIdx);

          return (
            <div
              key={colIdx}
              className="flex flex-col items-center bg-[#121212] border border-stone-800 p-2 relative h-36 xl:h-40 justify-start pt-8 transition-all overflow-visible rounded-xl select-none"
            >
              {/* Vertical track line representing kitchen rail */}
              <div className="absolute inset-y-2 w-[1px] bg-[#222]" />

              {/* Belt Entrance Connector/Arrow */}
              <div className="absolute top-2 flex flex-col items-center z-10 pointer-events-none">
                <ChevronUp
                  className={`w-3 h-3 -mb-0.5 select-none pointer-events-none ${
                    isBlocked ? 'text-[#d94e33] animate-pulse' : 'text-stone-400'
                  }`}
                />
                <span
                  className={`text-[7.5px] font-mono leading-none px-1 py-0.5 rounded ${
                    isBlocked
                      ? 'bg-red-950/80 text-red-300 border border-red-900/30'
                      : 'bg-[#1a1a1a] text-stone-300 border border-stone-800'
                  }`}
                >
                  {isBlocked ? 'Blocked' : `Slot ${targetSlotIdx}`}
                </span>
              </div>

              {/* Column Stack (row 0 front/top -> row 1 -> row 2 bottom) */}
              <div className="flex flex-col items-center gap-2.5 z-20 w-full">
                <AnimatePresence>
                  {col.slice(0, 3).map((plate, rowIdx) => {
                    const isFront = rowIdx === 0;
                    const isMatch = isFront && activeCustomerVarieties.includes(plate.variety);

                    // Aesthetics based on depth: front plate is big, back plates are nested smaller
                    let size = 26;
                    let opacity = 'opacity-30 scale-75';
                    if (rowIdx === 1) {
                      size = 36;
                      opacity = 'opacity-65 scale-90';
                    } else if (isFront) {
                      size = 52;
                      opacity = 'opacity-100 scale-100';
                    }

                    return (
                      <motion.div
                        key={plate.id}
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{
                          type: 'spring',
                          stiffness: 160,
                          damping: 15,
                        }}
                        className={`flex justify-center items-center relative transition-transform duration-200 ${opacity} ${
                          isFront
                            ? 'cursor-pointer hover:scale-110 active:scale-95 drop-shadow z-30'
                            : 'pointer-events-none'
                        }`}
                        onClick={(e) => {
                          if (isFront) {
                            e.stopPropagation();
                            onDispatch(colIdx);
                          }
                        }}
                      >
                        {isMatch && (
                          <div className="absolute inset-0 rounded-full border border-[#d94e33] animate-ping opacity-65 scale-125 pointer-events-none" />
                        )}
                        <SushiPlate
                          variety={plate.variety}
                          count={plate.count}
                          size={size}
                          active={isFront}
                        />
                        {isMatch && (
                          <span className="absolute -top-1 -right-1 bg-[#d94e33] text-white border border-red-400 text-[6px] font-mono leading-none px-1 py-0.5 rounded-full font-black tracking-tighter uppercase animate-bounce scale-90 z-40">
                            MATCH
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

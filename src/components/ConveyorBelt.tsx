/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Plate } from '../types';
import { SushiPlate } from './SushiPlate';
import { motion, AnimatePresence } from 'motion/react';

// Coordinates matching Counter-Clockwise progression around the loop (0 to 11)
export const SLOT_COORDS: Record<number, { x: number; y: number }> = {
  0: { x: 12, y: 88 },
  1: { x: 40, y: 88 },
  2: { x: 64, y: 88 },
  3: { x: 88, y: 88 },
  4: { x: 94, y: 62 },
  5: { x: 94, y: 36 },
  6: { x: 88, y: 12 },
  7: { x: 64, y: 12 },
  8: { x: 40, y: 12 },
  9: { x: 12, y: 12 },
  10: { x: 6, y: 36 },
  11: { x: 6, y: 62 },
};

const BELT_ASPECT = '1.12 / 1';
const MIN_PLATE_SIZE = 28;
const MAX_PLATE_SIZE = 40;

function clampPlateSize(beltWidth: number): number {
  return Math.round(Math.min(MAX_PLATE_SIZE, Math.max(MIN_PLATE_SIZE, beltWidth / 14)));
}

interface ConveyorBeltProps {
  plates: Plate[];
  onPlateClick?: (plate: Plate) => void;
  highlightedSlots?: number[];
  lastTickTime: number;
  beltSpeed: number;
  variant?: 'classic' | 'zen' | 'tweak';
  onBeltTap?: () => void;
}

interface SlotGuideProps {
  idx: number;
  coord: { x: number; y: number };
  isHighlighted: boolean;
  isOccupied: boolean;
  variant: 'classic' | 'zen' | 'tweak';
}

const SlotGuide: React.FC<SlotGuideProps> = ({ idx, coord, isHighlighted, isOccupied, variant }) => {
  if (variant === 'tweak') {
    return (
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
      >
        <div
          className={`w-3 h-3 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
            isHighlighted
              ? 'bg-rose-600 border-rose-300 animate-pulse scale-125'
              : isOccupied
                ? 'bg-indigo-950 border-indigo-700/50 scale-75'
                : 'bg-[#121214] border-[#1e293b]'
          }`}
        />
        <span className="text-[7.5px] font-mono text-[#475569] absolute -top-4 -left-1.5 select-none font-bold">
          P0{idx}
        </span>
      </div>
    );
  }

  if (variant === 'zen') {
    return (
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
            isHighlighted
              ? 'bg-rose-500 border-red-300 animate-ping'
              : isOccupied
                ? 'bg-[#9c6644]/40 border-[#7f5539]/50 scale-75'
                : 'bg-[#faf0e6]/70 border-[#ddb892]'
          }`}
        />
        <span className="text-[7.5px] font-mono text-[#8a5a36]/70 absolute -top-4 -left-2 scale-75 select-none font-extrabold opacity-60">
          {idx}
        </span>
      </div>
    );
  }

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
    >
      <div
        className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 ${
          isHighlighted
            ? 'bg-[#d94e33] border-red-200 animate-ping'
            : isOccupied
              ? 'bg-[#d94e33]/20 border-[#d94e33]/30 scale-75'
              : 'bg-[#222] border-[#3c3c3c]'
        }`}
      />
      <span className="text-[7px] font-mono text-slate-500 absolute -top-4 -left-2 scale-75 select-none opacity-40">
        {idx}
      </span>
    </div>
  );
};

interface BeltPlatesOverlayProps {
  plates: Plate[];
  beltSpeed: number;
  plateSize: number;
  variant: 'classic' | 'zen' | 'tweak';
  onPlateClick?: (plate: Plate) => void;
}

const BeltPlatesOverlay: React.FC<BeltPlatesOverlayProps> = ({
  plates,
  beltSpeed,
  plateSize,
  variant,
  onPlateClick,
}) => {
  const seenSlots = new Set<number>();
  const uniquePlates = plates.filter((plate) => {
    if (seenSlots.has(plate.currentSlot)) return false;
    seenSlots.add(plate.currentSlot);
    return true;
  });

  const transitionDuration = beltSpeed / 1000;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <AnimatePresence>
        {uniquePlates.map((plate) => {
          const coordCurr = SLOT_COORDS[plate.currentSlot];
          if (!coordCurr) return null;

          return (
            <motion.div
              key={plate.id}
              layout={false}
              animate={{
                left: `${coordCurr.x}%`,
                top: `${coordCurr.y}%`,
              }}
              transition={{
                type: 'tween',
                ease: 'linear',
                duration: transitionDuration,
              }}
              style={{ zIndex: 25 }}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer transition-transform hover:scale-110 duration-200"
            >
              <SushiPlate
                variety={plate.variety}
                count={plate.count}
                size={plateSize}
                variant={variant}
                onClick={() => onPlateClick?.(plate)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export const ConveyorBelt: React.FC<ConveyorBeltProps> = ({
  plates = [],
  onPlateClick,
  highlightedSlots = [],
  lastTickTime,
  beltSpeed,
  variant = 'classic',
  onBeltTap,
}) => {
  const beltRef = useRef<HTMLDivElement>(null);
  const [plateSize, setPlateSize] = useState(36);

  const updatePlateSize = useCallback(() => {
    if (!beltRef.current) return;
    setPlateSize(clampPlateSize(beltRef.current.offsetWidth));
  }, []);

  useEffect(() => {
    updatePlateSize();
    const el = beltRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updatePlateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updatePlateSize]);

  const safePlates = plates || [];
  const beltSlots = Array.from({ length: 12 }).map((_, idx) => {
    return safePlates.find((p) => p.currentSlot === idx) || null;
  });

  const slotGuides = Object.entries(SLOT_COORDS).map(([idxStr, coord]) => {
    const idx = parseInt(idxStr, 10);
    return (
      <SlotGuide
        key={idx}
        idx={idx}
        coord={coord}
        isHighlighted={highlightedSlots.includes(idx)}
        isOccupied={!!beltSlots[idx]}
        variant={variant}
      />
    );
  });

  const platesOverlay = (
    <BeltPlatesOverlay
      plates={safePlates}
      beltSpeed={beltSpeed}
      plateSize={plateSize}
      variant={variant}
      onPlateClick={onPlateClick}
    />
  );

  if (variant === 'tweak') {
    return (
      <div
        ref={beltRef}
        className="relative w-full aspect-[1.12/1] bg-[#070a0f] border-4 border-[#1e293b] rounded-2xl shadow-2xl p-3 overflow-hidden select-none"
        style={{
          aspectRatio: BELT_ASPECT,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7), inset 0 1px 3px rgba(255, 255, 255, 0.05)',
        }}
      >
        <div className="absolute inset-1.5 border-[2px] border-[#1e293b] rounded-xl overflow-hidden bg-[#090d14] shadow-inner">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)',
              backgroundSize: '12px 12px',
            }}
          />
          <div className="absolute inset-[18%] bg-[#0f172a] border-2 border-[#1e293b] rounded-lg shadow-md flex flex-col items-center justify-center font-mono text-center p-2">
            <span className="text-xl animate-pulse">🛰️</span>
            <div className="text-[10px] font-black text-[#50e3c2] tracking-wider uppercase mt-1">
              PIPELINE_CORE
            </div>
            <div className="text-[6.5px] text-slate-500 uppercase tracking-widest mt-1">
              FEEDBACK REVOLUTION
            </div>
          </div>
        </div>
        {slotGuides}
        {platesOverlay}
      </div>
    );
  }

  if (variant === 'zen') {
    return (
      <div
        ref={beltRef}
        className="relative w-full aspect-[1.12/1] bg-[#edd2b6] border-[6px] border-[#9c6644] rounded-[48px] shadow-2xl p-3 overflow-hidden select-none cursor-pointer active:scale-[0.98] active:brightness-95 transition-all duration-150"
        style={{
          aspectRatio: BELT_ASPECT,
          boxShadow: '0 20px 40px -15px rgba(66, 35, 12, 0.5), inset 0 2px 8px rgba(255, 255, 255, 0.4)',
        }}
        onClick={() => onBeltTap?.()}
      >
        <div className="absolute inset-1 border-[4px] border-[#7f5539] rounded-[42px] overflow-hidden bg-[#e6ccb2] shadow-inner">
          <div
            className="absolute inset-0 opacity-25 animate-belt-running"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M0,20 Q10,0 20,20 Q30,0 40,20 L40,40 L0,40 Z' fill='%239a7b56' stroke='%23ffffff' stroke-width='1.5'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              '--belt-duration': `${beltSpeed / 1000}s`,
            } as React.CSSProperties}
          />
          <div
            className="absolute inset-[15%] border-[3px] border-[#7f5539] rounded-[24px] overflow-hidden bg-[#cbf3f0] shadow-2xl flex items-center justify-center"
            style={{
              boxShadow: 'inset 0 4px 10px rgba(10, 80, 100, 0.25)',
              backgroundColor: '#b5e2fa',
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.15, 0.25, 0.15] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 bg-radial from-[#ffffff] to-transparent pointer-events-none"
            />
            <div className="absolute top-[20%] left-[15%] w-9 h-6 bg-[#6b705c]/95 rounded-full rotate-12 flex items-center justify-center text-[7px] text-white/35 font-mono shadow-sm border-b-2 border-slate-700/40">石</div>
            <div className="absolute bottom-[22%] left-[24%] w-6 h-5 bg-[#52796f] rounded-full -rotate-45 shadow-sm border-b-2 border-slate-700/40" />
            <div className="absolute bottom-[30%] right-[16%] w-10 h-7 bg-[#415a77]/90 rounded-full rotate-45 flex items-center justify-center text-[7px] text-white/35 font-mono shadow-sm border-b-2 border-slate-800/40">石</div>
            <div className="absolute top-[15%] right-[25%] w-5 h-5 bg-[#7f5539]/60 rounded-full shadow-sm" />
            <motion.div
              animate={{ y: [0, -4, 0], rotate: [0, 8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-[28%] right-[32%] text-lg select-none filter drop-shadow-sm"
            >
              🌸
            </motion.div>
            <motion.div
              animate={{ y: [0, 3, 0], rotate: [0, -10, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute bottom-[25%] left-[45%] text-lg select-none filter drop-shadow-sm"
            >
              🌸
            </motion.div>
            <motion.div
              animate={{ y: [0, -2, 0], rotate: [0, 15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="absolute top-[52%] left-[18%] text-sm select-none opacity-80"
            >
              🌸
            </motion.div>
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="absolute top-4 left-6 flex flex-col items-center rotate-[70deg]">
                <svg viewBox="0 0 40 20" className="w-10 h-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                  <path d="M5,10 Q15,3 25,10 Q15,17 5,10 L0,5 L0,15 Z" fill="#f97316" />
                  <path d="M12,10 Q18,6 23,10 Q18,14 12,10 Z" fill="#ffffff" />
                  <motion.path
                    d="M23,10 L31,5 Q34,10 31,15 Z"
                    fill="#f97316"
                    animate={{ rotate: [-10, 10, -10] }}
                    transition={{ repeat: Infinity, duration: 0.3 }}
                    className="origin-left"
                  />
                  <circle cx="8" cy="7" r="1" fill="#000" />
                  <circle cx="8" cy="13" r="1" fill="#000" />
                </svg>
              </div>
              <div className="absolute bottom-4 right-6 flex flex-col items-center rotate-[-110deg]">
                <svg viewBox="0 0 36 18" className="w-9 h-4.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                  <path d="M5,9 Q15,2 25,9 Q15,16 5,9 L0,5 L0,13 Z" fill="#eab308" />
                  <motion.path
                    d="M23,9 L29,5 Q32,9 29,13 Z"
                    fill="#ca8a04"
                    animate={{ rotate: [-12, 12, -12] }}
                    transition={{ repeat: Infinity, duration: 0.28 }}
                    className="origin-left"
                  />
                  <circle cx="8" cy="6" r="1.2" fill="#fafafa" />
                  <circle cx="8" cy="6" r="0.5" fill="#000" />
                </svg>
              </div>
            </motion.div>
            <div className="text-center pointer-events-none select-none">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#7f5539] opacity-60">
                POND COY
              </div>
            </div>
          </div>
        </div>
        {slotGuides}
        {platesOverlay}
      </div>
    );
  }

  return (
    <div
      ref={beltRef}
      className="relative w-full aspect-[1.12/1] bg-[#1a1a1a] border-[8px] border-[#2d2d2d] rounded-[36px] shadow-2xl p-2.5 overflow-hidden select-none"
      style={{ aspectRatio: BELT_ASPECT }}
    >
      <div className="absolute inset-1.5 border-[4px] border-[#1d1d1d] rounded-[28px] overflow-hidden bg-[#121212] shadow-inner">
        <div
          className="absolute inset-0 opacity-10 animate-belt-running"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, #000, #000 6px, transparent 6px, transparent 18px)',
            '--belt-duration': `${beltSpeed / 1000}s`,
          } as React.CSSProperties}
        />
        <div className="absolute inset-[15%] bg-[#1d1d1d] border-2 border-[#2c2c2c] rounded-[18px] shadow-lg flex flex-col items-center justify-center">
          <div className="text-center">
            <span className="text-[24px] opacity-75">🍣</span>
            <div className="text-2xl font-serif italic text-[#d94e33] leading-none mt-1">
              Kaizen
            </div>
            <div className="text-[7px] font-mono uppercase tracking-[0.3em] text-[#fafaf9] opacity-30 mt-1">
              Rotating CCW
            </div>
          </div>
        </div>
      </div>
      {slotGuides}
      {platesOverlay}
    </div>
  );
};

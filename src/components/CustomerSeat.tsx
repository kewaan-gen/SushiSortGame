/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Customer } from '../types';
import { SUSHI_VARIETIES } from '../sushiConfig';
import { SushiPlate } from './SushiPlate';
import { motion, AnimatePresence } from 'motion/react';
import { sfx } from '../utils/audio';

interface CustomerSeatProps {
  customer: Customer | null;
  seatIndex: number;
  side: 'left' | 'right';
  onArrived?: (seatIndex: number) => void;
  variant?: 'classic' | 'zen' | 'tweak';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
}

export const CustomerSeat: React.FC<CustomerSeatProps> = ({
  customer,
  seatIndex,
  side,
  onArrived,
  variant = 'classic',
}) => {
  const [eatingProgress, setEatingProgress] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastBowlCountRef = useRef(0);

  // Trigger arrived callback when entering animation finishes
  useEffect(() => {
    if (customer && customer.state === 'arriving') {
      const timer = setTimeout(() => {
        onArrived?.(seatIndex);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [customer?.id, customer?.state]);

  // Handle chopstick strike sounds while eating
  useEffect(() => {
    if (customer && customer.state === 'eating' && customer.chopstickTicks > 0) {
      setEatingProgress(0);
      const interval = setInterval(() => {
        setEatingProgress((p) => {
          if (p < customer.chopstickTicks) {
            sfx.playChopstickStrike();
            return p + 1;
          }
          clearInterval(interval);
          return p;
        });
      }, 300);
      return () => clearInterval(interval);
    } else {
      setEatingProgress(0);
    }
  }, [customer?.state, customer?.chopstickTicks, customer?.id]);

  // Launch particle explosion when the plate stack vanishes
  useEffect(() => {
    const currentBowlCount = customer?.bowlCount || 0;
    const lastBowlCount = lastBowlCountRef.current;
    
    // If the stack is cleared (meaning customer was satisfied and left)
    if (lastBowlCount > 0 && currentBowlCount === 0) {
      triggerVanishExplosion();
    }
    
    lastBowlCountRef.current = currentBowlCount;
  }, [customer?.bowlCount, customer?.id]);

  const triggerVanishExplosion = () => {
    sfx.playCoinDing();
    const newParticles: Particle[] = Array.from({ length: 15 }).map((_, idx) => {
      const angle = (idx / 15) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      return {
        id: Date.now() + idx,
        x: side === 'left' ? 45 : -45, // Originates from the plate stack side
        y: 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: ['#eab308', '#ffffff', '#f97316', '#ffedd5', '#fda4af'][Math.floor(Math.random() * 5)],
        size: 5 + Math.random() * 6,
        alpha: 1,
      };
    });

    setParticles(newParticles);
  };

  // Particles animation frame ticker
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles((prevParticles) => {
        return prevParticles
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.12, // Gravity force
            alpha: p.alpha - 0.04,
          }))
          .filter((p) => p.alpha > 0);
      });
    }, 20);

    return () => clearInterval(interval);
  }, [particles]);

  const desiredSushi = customer ? SUSHI_VARIETIES[customer.orderedVariety] : null;
  const remainingCount = customer ? customer.orderedCount - customer.satisfiedCount : 0;

  // Render the stacked wooden bowls next to the table counter
  const renderBowlStack = () => {
    const stackSize = customer ? customer.bowlCount : 0;
    if (stackSize === 0) return null;

    const plateColor = variant === 'tweak' ? '#334155' : (variant === 'zen' ? '#fcf0e5' : '#d94e33');
    const rimColor = variant === 'tweak' ? '#64748b' : (variant === 'zen' ? '#b5835a' : '#731919');

    return (
      <div 
        className={`absolute bottom-3.5 flex flex-col-reverse items-center w-6 pointer-events-none z-10 ${
          side === 'left' ? 'right-2' : 'left-2'
        }`}
      >
        <AnimatePresence>
          {Array.from({ length: Math.min(stackSize, 12) }).map((_, idx) => (
            <motion.div
              key={idx}
              initial={{ y: -15, opacity: 0, scale: 1.3 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ scale: 0.2, opacity: 0, duration: 0.25 }}
              transition={{ type: 'spring', damping: 12, stiffness: 150 }}
              className="w-4 h-[3px] rounded-b-sm shadow-sm -mt-[1px]"
              style={{
                backgroundColor: plateColor,
                borderBottom: `1px solid ${rimColor}`,
                boxShadow: variant === 'tweak' ? 'none' : 'inset 0 0.5px 0 rgba(255,255,255,0.22)',
                zIndex: idx,
              }}
            />
          ))}
        </AnimatePresence>
        {stackSize > 12 && (
          <span className="text-[6px] font-mono font-bold text-[#fafaf9] -mt-0.5 bg-red-650 px-0.5 py-[0.2px] rounded shadow-sm scale-75">
            +{stackSize - 12}
          </span>
        )}
      </div>
    );
  };

  const bubbleBg = variant === 'tweak' 
    ? 'bg-[#0f172a] border-[#6366f1] text-[#818cf8]' 
    : (variant === 'zen' ? 'bg-[#fffcf8] border-[#9c6644]' : 'bg-[#1c1917] border-[#d94e33]/50');
  const textColour = variant === 'tweak' ? 'text-indigo-400' : (variant === 'zen' ? 'text-[#5c3a21]' : 'text-[#fafaf9]');

  // In and out trajectories relative to top unified Shoji entryway
  const entryX = side === 'left' ? 42 : -42;
  const entryY = -120;
  const exitX = side === 'left' ? 90 : -90;
  const exitY = -120;

  return (
    <div className="relative flex flex-col items-center justify-end w-14 xl:w-16 h-28 xl:h-32 max-h-full select-none overflow-visible shrink-0">
      {/* Floating Order Cloud Speech Bubble */}
      <AnimatePresence mode="wait">
        {customer && customer.state !== 'arriving' && customer.state !== 'leaving' && desiredSushi && (
          <motion.div
            key={customer.id + '-' + customer.satisfiedCount}
            initial={{ scale: 0, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: -10 }}
            className={`absolute -top-12 flex flex-col items-center justify-center border py-0.5 px-1.5 rounded-xl shadow-lg z-25 w-[76px] sm:w-[82px] ${bubbleBg} ${
              side === 'left' ? '-left-1' : '-right-1'
            }`}
          >
            {/* Triangular anchor below bubble */}
            <div 
              className={`absolute -bottom-1 w-1.5 h-1.5 border-r border-b rotate-45 ${
                variant === 'tweak' ? 'bg-[#0f172a] border-[#6366f1]' : (variant === 'zen' ? 'bg-[#fffcf8] border-[#9c6644]' : 'bg-[#1c1917] border-[#d94e33]/50')
              } ${
                side === 'left' ? 'left-4' : 'right-4'
              }`} 
            />

            <div className="flex items-center gap-1">
              <span className="text-[8px] font-extrabold font-mono text-indigo-400">
                {Math.max(0, remainingCount)}x
              </span>
              <SushiPlate
                variety={customer.orderedVariety}
                count={1}
                size={16}
                active={false}
                variant={variant}
              />
            </div>
            <span className={`text-[7px] font-mono tracking-tight leading-none uppercase truncate w-full text-center mt-0.5 ${textColour}`}>
              {desiredSushi.displayName}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Seat & Avatar with walking transition */}
      <div className="relative flex flex-col items-center z-10 w-full pb-3">
        <AnimatePresence>
          {customer ? (
            <motion.div
              key={customer.id}
              initial={{ 
                x: entryX, 
                y: entryY,
                scale: 0.6,
                opacity: 0,
              }}
              animate={customer.state === 'leaving' ? {
                x: exitX,
                y: exitY,
                opacity: 0,
                scale: 0.6,
              } : { 
                x: 0, 
                opacity: 1,
                y: -12,
                scale: 1,
              }}
              exit={{ opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 75,
                damping: 14,
              }}
              className="flex flex-col items-center"
            >
              {/* Dynamic status indicators */}
              {customer.state === 'satisfied' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: 1, y: -20, scale: 1 }}
                  className="absolute z-30 font-bold text-[#fef08a] text-[8px] bg-red-650 px-1.5 py-[1px] rounded-full border border-red-800 shadow"
                >
                  Arigato! 🎉
                </motion.div>
              )}

              {/* Chibi Character container */}
              {variant === 'tweak' ? (
                <div className="w-[54px] h-[70px] bg-[#111827] border border-[#10b981] rounded flex flex-col items-center justify-between p-1 font-mono text-[6px] shadow-[0_0_8px_rgba(16,185,129,0.3)] select-none">
                  <div className="text-lg filter drop-shadow">{customer.characterEmoji}</div>
                  <div className="font-extrabold text-[#fafaf9] uppercase tracking-wide truncate w-full text-center scale-90">{customer.characterName}</div>
                  <div className={`text-[5px] px-0.5 py-[0.1px] rounded font-black border text-center leading-none ${
                    customer.state === 'eating' 
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400' 
                      : customer.state === 'satisfied' 
                        ? 'bg-amber-950/80 border-amber-500 text-amber-400'
                        : 'bg-indigo-950/80 border-indigo-500 text-indigo-400'
                  }`}>
                    {customer.state.toUpperCase().substring(0, 5)}
                  </div>
                </div>
              ) : (
                <motion.div
                  animate={
                    customer.state === 'eating'
                      ? {
                          y: [0, -2, 0],
                          scale: [1, 1.05, 1],
                          rotate: [0, -1, 1, 0],
                        }
                      : customer.state === 'satisfied'
                        ? {
                            y: [0, -10, 0],
                            rotate: [0, 8, -8, 0],
                          }
                        : customer.state === 'arriving' || customer.state === 'leaving'
                          ? {
                              y: [0, -6, 0],
                              rotate: [-6, 6, -6],
                            }
                          : {}
                  }
                  transition={{
                    repeat: Infinity,
                    duration: customer.state === 'eating' ? 0.25 : (customer.state === 'satisfied' ? 0.35 : 0.4),
                  }}
                  className={`flex flex-col items-center justify-center relative ${
                    customer.state === 'satisfied' ? 'drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : ''
                  }`}
                >
                  {/* Visual Head Emoji */}
                  <div className="text-2xl filter drop-shadow z-20 absolute -top-2 w-8 h-8 flex items-center justify-center">
                    {customer.characterEmoji}
                  </div>

                  {/* Vector SVG Kimono Chibi Chef Dress */}
                  <svg viewBox="0 0 80 100" className="w-8 h-10 overflow-visible z-10 pt-2.5">
                    {/* Left hand holding chopsticks when eating */}
                    {customer.state === 'eating' && (
                      <motion.g
                        animate={{
                          rotate: [-20, 25, -20],
                          y: [0, 4, 0]
                        }}
                        transition={{ duration: 0.25, repeat: Infinity }}
                        className="origin-[25px_50px]"
                      >
                        {/* Left Arm */}
                        <path d="M 25,50 Q 14,53 12,60" stroke="#f5f5f4" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                        {/* Slanting Chopstick */}
                        <line x1="10" y1="57" x2="2" y2="72" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
                      </motion.g>
                    )}

                    {/* Right hand waving when happy */}
                    {customer.state === 'satisfied' && (
                      <motion.g
                        animate={{
                          rotate: [0, -45, 0],
                          y: [0, -3, 0]
                        }}
                        transition={{ duration: 0.3, repeat: Infinity }}
                        className="origin-[55px_50px]"
                      >
                        <path d="M 55,50 Q 66,45 72,35" stroke="#f5f5f4" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                        <circle cx="72" cy="35" r="3" fill="#f5f5f4" />
                      </motion.g>
                    )}

                    {/* Japanese Obi-Dress Body */}
                    <path 
                      d="M 24,44 L 18,84 Q 40,90 62,84 L 56,44 Z" 
                      fill={variant === 'zen' ? '#4361ee' : '#b91c1c'} 
                      stroke={variant === 'zen' ? '#3f37c9' : '#7f1d1d'} 
                      strokeWidth="3.2" 
                      strokeLinejoin="round" 
                    />
                    {/* Obi Sash Gold belt */}
                    <rect x="25" y="65" width="30" height="7" fill="#f59e0b" rx="1.5" />
                    <rect x="37" y="63" width="6" height="11" fill="#7f1d1d" rx="1" />

                    {/* Animated Little Walking feet (Stubby sandals) */}
                    <motion.circle
                      cx="30"
                      cy="88"
                      r="5"
                      fill="#18181b"
                      animate={customer.state === 'arriving' || customer.state === 'leaving' ? { y: [0, -4, 0] } : {}}
                      transition={{ duration: 0.3, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="50"
                      cy="88"
                      r="5"
                      fill="#18181b"
                      animate={customer.state === 'arriving' || customer.state === 'leaving' ? { y: [0, -4, 0] } : {}}
                      transition={{ duration: 0.3, repeat: Infinity, delay: 0.15 }}
                    />
                  </svg>
                </motion.div>
              )}

              {/* Patient Waiting Gauge */}
              {variant !== 'tweak' && (
                <span className={`text-[7.5px] font-mono font-bold mt-1 scale-95 leading-none ${variant === 'zen' ? 'text-[#5c3a21]' : 'text-stone-300'}`}>
                  {customer.characterName}
                </span>
              )}

              {/* Waiting status / Patience gauge block */}
              {customer.state === 'waiting' && (
                <div className="h-1 w-10 bg-stone-850 rounded-full mt-1 border border-stone-850 overflow-hidden relative">
                  <motion.div 
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 24, ease: 'linear' }}
                    className={`h-full ${variant === 'tweak' ? 'bg-[#10b981]' : 'bg-amber-500'}`} 
                  />
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-20 pointer-events-none opacity-20">
              {variant === 'tweak' ? (
                <div className="w-[54px] h-[70px] bg-slate-950 border border-dashed border-slate-700 rounded flex flex-col items-center justify-center text-[6px] font-mono text-slate-500 tracking-wider">
                  <span>VACANT</span>
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full border border-dashed border-stone-550 flex items-center justify-center text-[7px] font-serif italic text-stone-400">
                    LOBBY
                  </div>
                  <span className="text-[6px] font-mono tracking-wide text-[#5c3a21] uppercase mt-1">
                    Vacant
                  </span>
                </>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Visual Table Workspace Counter */}
      {variant === 'tweak' ? (
        <div 
          className="absolute bottom-0 w-14 h-3.5 bg-[#1e293b] border border-[#475569] flex flex-col items-center justify-center z-20 font-mono text-[5px] text-[#94a3b8] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-sm"
        >
          <div>NODE_0{seatIndex}</div>
        </div>
      ) : (
        <div 
          className="absolute bottom-0 w-14 sm:w-16 h-3.5 border-t-[3px] rounded-lg flex items-center justify-around px-1 z-20 shadow"
          style={{
            boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.06)',
            backgroundColor: variant === 'zen' ? '#9c6644' : '#3a2010',
            borderColor: variant === 'zen' ? '#b5835a' : '#ffb170/10',
          }}
        >
          {/* Table Chopsticks & Rest (Always visible!) */}
          <div className="flex flex-col items-center relative z-25">
            {(!customer || customer.state !== 'eating') ? (
              /* Rested Chopsticks on ceramic holder */
              <div className="flex flex-col items-center justify-center scale-75">
                {/* Bamboo rest */}
                <div className="w-3 h-0.5 bg-[#4d8b31] rounded-full border border-stone-800" />
                {/* Couple of Chopsticks sitting horizontally skewed on holder */}
                <div className="absolute -top-0.5 w-[26px] h-0.5 flex flex-col justify-between pointer-events-none">
                  <div className="w-8 h-[1px] bg-[#dfc59f] rounded-full transform rotate-3 origin-center" />
                  <div className="w-8 h-[1px] bg-[#dfc59f] rounded-full transform -rotate-3 origin-center" />
                </div>
              </div>
            ) : (
              /* Chopsticks are active in character hands! Rest is empty */
              <div className="w-3 h-0.5 bg-[#4d8b31] rounded-full border border-stone-800 scale-75" />
            )}
          </div>

          {/* Visual stack of empty bowls on table */}
          {renderBowlStack()}
        </div>
      )}

      {/* Vanish Particles Layer */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none z-30 flex items-center justify-center text-xs"
          style={{
            left: `calc(50% + ${p.x}px)`,
            top: `calc(60% + ${p.y}px)`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            opacity: p.alpha,
            filter: 'blur(0.2px)',
          }}
        >
          {p.size > 8 && <span style={{ fontSize: `${p.size * 0.9}px` }}>✨</span>}
        </div>
      ))}
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React from 'react';
import { motion } from 'motion/react';
import { Play, Sparkles, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { sfx } from '../utils/audio';

interface MainMenuProps {
  onSelectMode: (mode: 'zen' | 'tweak') => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onShowTutorial: () => void;
  highScore: number;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onSelectMode,
  isMuted,
  onToggleMute,
  onShowTutorial,
  highScore,
}) => {
  const selectMode = (mode: 'zen' | 'tweak') => {
    sfx.playCoinDing();
    onSelectMode(mode);
  };

  return (
    <div 
      className="w-full min-h-screen flex flex-col items-center justify-center p-4 relative antialiased"
      style={{
        backgroundColor: '#edd4b8',
        backgroundImage: `
          radial-gradient(rgba(139, 90, 43, 0.08) 1.5px, transparent 1.5px),
          linear-gradient(#f7e3cb 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px, 100% 48px',
      }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3 z-30">
        <button
          onClick={onToggleMute}
          className="p-2.5 bg-white/80 hover:bg-white text-stone-700 hover:text-[#d94e33] rounded-full shadow-md backdrop-blur-xs transition cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-emerald-600" />}
        </button>
        <button
          onClick={onShowTutorial}
          className="p-2.5 bg-white/80 hover:bg-white text-stone-750 hover:text-[#d94e33] rounded-full shadow-md backdrop-blur-xs transition cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-rose-300 rounded-full opacity-60"
            style={{
              width: `${Math.random() * 8 + 6}px`,
              height: `${Math.random() * 12 + 6}px`,
              borderRadius: '50% 10% 50% 50%',
              left: `${Math.random() * 100}%`,
              top: `-20px`,
            }}
            animate={{
              y: ['0vh', '110vh'],
              x: ['0px', `${Math.random() * 120 - 60}px`],
              rotate: [0, 360],
            }}
            transition={{
              duration: Math.random() * 10 + 8,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-[#fffcf8]/90 border-[6px] border-[#8a5a36] rounded-[36px] shadow-2xl p-6 sm:p-10 z-20 flex flex-col items-center relative"
        style={{
          boxShadow: '0 25px 50px -12px rgba(84, 45, 12, 0.45)',
        }}
      >
        <div className="absolute top-4 left-4 text-xs font-mono text-[#8a5a36]/50 select-none">⛩️ KAIZEN SYSTEM</div>
        <div className="absolute top-4 right-4 text-xs font-mono text-[#8a5a36]/50 select-none">EST. 2026</div>

        <div className="text-center mb-8">
          <motion.span 
            className="text-5xl inline-block mb-3 drop-shadow"
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            🍣
          </motion.span>
          <h1 className="text-4xl sm:text-5xl font-serif italic tracking-wide font-black text-[#5c3a21] leading-tight select-none">
            KAIZEN ZUSHI
          </h1>
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-[#8a5d36] mt-1 select-none">
            Rotating Pattern Conveyor Challenge
          </p>
          {highScore > 0 && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-[#8a5a36]/10 text-[#8a5a36] px-3.5 py-1 rounded-full text-xs font-mono font-extrabold shadow-inner">
              <Sparkles className="w-3.5 h-3.5" />
              HIGH SCORE: {highScore} PTS
            </div>
          )}
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-3xl mt-2">
          
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectMode('zen')}
            className="flex flex-col justify-between bg-[#fbf5ee] border-[4px] border-[#aa7b54] rounded-3xl p-6 shadow-lg cursor-pointer transition-colors relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-xl group-hover:bg-sky-500/20 transition-all duration-300" />
            
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl text-sky-500 drop-shadow">🎏</span>
                <span className="text-[10px] font-mono font-bold bg-[#8a5a36]/10 text-[#8a5a36] border border-[#8a5a36]/20 px-2 py-0.5 rounded-md">
                  RECOMMENDED
                </span>
              </div>

              <h3 className="text-xl font-serif italic font-extrabold text-[#5c3a21] mb-2 group-hover:text-[#8a5a36] transition-colors">
                Zen Pond Garden
              </h3>
              <p className="text-xs font-mono text-stone-700 leading-relaxed mb-6">
                The main game experience. Wooden decks, koi pond, sakura blossoms, and smooth continuous belt motion across 5 handcrafted levels with exact dish supply.
              </p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-stone-200">
              <span className="text-[10px] font-mono text-[#8a562b] uppercase tracking-widest">
                5 Levels · Pairs of 2
              </span>
              <span className="text-xs font-bold font-mono text-white bg-[#8a5a36] hover:bg-[#724624] flex items-center gap-1.5 px-3 py-1 rounded-lg shadow-sm transition">
                Play <Play className="w-3 h-3 fill-current" />
              </span>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectMode('tweak')}
            id="mode3"
            className="flex flex-col justify-between bg-[#0c1017] border-[4px] border-emerald-900 rounded-3xl p-6 shadow-lg cursor-pointer transition-colors relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all duration-300" />
            
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl text-emerald-400 font-mono drop-shadow font-extrabold">⚙️</span>
                <span className="text-[10px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  SANDBOX
                </span>
              </div>

              <h3 className="text-xl font-mono font-extrabold text-emerald-400 mb-2 transition-colors">
                Developer Station
              </h3>
              <p className="text-xs font-mono text-stone-400 leading-relaxed mb-6">
                Build custom levels with exact demand-matched queues, timing sliders, and live telemetry. Compile dishes in pairs of 2.
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-emerald-950">
              <span className="text-[10px] font-mono text-emerald-600 uppercase tracking-widest">
                Level Builder & Simulator
              </span>
              <button 
                id="mode3-button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectMode('tweak');
                }}
                className="w-full text-center text-xs font-bold font-mono text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg shadow-sm transition cursor-pointer"
              >
                Open Developer Mode
              </button>
            </div>
          </motion.div>

        </div>

        <div className="mt-8 text-[11px] font-mono text-[#8a5a36]/60 text-center uppercase tracking-widest">
          ⛩️ Relax, analyze, and dispatch with timing precision ⛩️
        </div>
      </motion.div>
    </div>
  );
};

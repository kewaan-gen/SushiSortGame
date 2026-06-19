/**
 * Shared UI primitives for the Level Forge dashboard (light "white-grey" theme).
 */

import React from 'react';
import { DishLetter, LETTER_TO_HEX, ForgeLevel } from '../../forge/types';
import { ratingForDifficulty } from '../../forge/difficulty';

/**
 * A single dish chip: coloured disc with its letter.
 *
 * When `onClick` is provided it is an interactive button. When it is purely
 * decorative (no onClick) it renders pointer-events-none so taps pass through to
 * any parent button (this is what makes the in-game dispatch icons fully tappable).
 */
export const DishChip: React.FC<{
  dish: DishLetter;
  size?: number;
  dim?: boolean;
  ring?: boolean;
  onClick?: () => void;
  title?: string;
}> = ({ dish, size = 34, dim = false, ring = false, onClick, title }) => {
  const hex = LETTER_TO_HEX[dish];
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      tabIndex={interactive ? 0 : -1}
      style={{ width: size, height: size, borderColor: hex }}
      className={`relative shrink-0 rounded-full border-[2.5px] bg-white flex items-center justify-center font-black font-mono transition-transform ${
        interactive
          ? 'cursor-pointer hover:scale-110 active:scale-95'
          : 'cursor-default pointer-events-none'
      } ${dim ? 'opacity-40' : ''} ${ring ? 'ring-2 ring-offset-1 ring-amber-400' : ''}`}
    >
      <span
        className="absolute inset-[5px] rounded-full"
        style={{ backgroundColor: hex, opacity: 0.95 }}
      />
      <span
        className="relative z-10"
        style={{ color: '#fff', fontSize: size * 0.42, textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}
      >
        {dish}
      </span>
    </button>
  );
};

/** Star rating row. */
export const Stars: React.FC<{ count: number; size?: number }> = ({ count, size = 14 }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <span
        key={i}
        style={{ fontSize: size }}
        className={i <= count ? 'text-amber-400' : 'text-slate-300'}
      >
        ★
      </span>
    ))}
  </span>
);

/** Difficulty pill with band colour. */
export const DifficultyPill: React.FC<{ difficulty: number }> = ({ difficulty }) => {
  const rating = ratingForDifficulty(difficulty);
  const palette: Record<string, string> = {
    NOVICE: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    APPRENTICE: 'bg-sky-100 text-sky-700 border-sky-300',
    CHALLENGER: 'bg-amber-100 text-amber-700 border-amber-300',
    EXPERT: 'bg-orange-100 text-orange-700 border-orange-300',
    MASTER: 'bg-rose-100 text-rose-700 border-rose-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold tracking-wide ${palette[rating.badge]}`}
    >
      D{difficulty} · {rating.badge}
    </span>
  );
};

/** Small labelled stat block. */
export const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({
  label,
  value,
  accent = 'text-violet-700',
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">{label}</span>
    <span className={`text-sm font-mono font-bold ${accent}`}>{value}</span>
  </div>
);

/** Trigger a JSON file download for a level. */
export function downloadLevelJSON(level: ForgeLevel): void {
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = level.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  a.download = `${safeName || 'forge_level'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const PANEL = 'bg-white border border-slate-200 rounded-2xl shadow-sm';
export const ACCENT_BTN =
  'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-mono font-bold rounded-xl transition cursor-pointer';
export const GHOST_BTN =
  'bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono rounded-xl transition cursor-pointer border border-slate-300';

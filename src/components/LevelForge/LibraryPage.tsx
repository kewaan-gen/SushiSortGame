/**
 * Library page: the first screen. Grid of saved levels + "Generate New Level".
 * Each level card has a 3-dot menu: Play, Download JSON, Edit, Delete.
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  MoreVertical,
  Play,
  Download,
  Pencil,
  Trash2,
  ArrowLeft,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ForgeLevel } from '../../forge/types';
import {
  DishChip,
  Stars,
  DifficultyPill,
  Stat,
  downloadLevelJSON,
  PANEL,
  ACCENT_BTN,
} from './shared';
import { ratingForDifficulty } from '../../forge/difficulty';

interface Props {
  levels: ForgeLevel[];
  loading: boolean;
  onCreate: () => void;
  onPlay: (level: ForgeLevel) => void;
  onEdit: (level: ForgeLevel) => void;
  onDelete: (id: string) => void;
  onImport: (raw: string) => Promise<boolean>;
  onExit: () => void;
}

export const LibraryPage: React.FC<Props> = ({
  levels,
  loading,
  onCreate,
  onPlay,
  onEdit,
  onDelete,
  onImport,
  onExit,
}) => {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await onImport(text);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="w-full h-full overflow-y-auto" onClick={() => setMenuOpen(null)}>
      <div className="max-w-6xl mx-auto px-5 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
              title="Back to menu"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <span className="text-violet-600">⚒</span> Kaizen Level Forge
              </h1>
              <p className="text-[11px] font-mono text-slate-500 tracking-wide">
                Intelligent solver-backed level generator · {levels.length} saved
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2.5 text-sm rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 font-mono transition cursor-pointer"
              title="Import a level JSON"
            >
              <Upload className="w-4 h-4" /> Import
            </button>
            <button
              onClick={onCreate}
              className={`${ACCENT_BTN} flex items-center gap-2 px-4 py-2.5 text-sm shadow-lg shadow-violet-900/40`}
            >
              <Plus className="w-4 h-4" /> Generate New Level
            </button>
          </div>
        </header>

        {/* Empty / loading states */}
        {loading ? (
          <div className="text-center py-24 text-slate-500 font-mono text-sm">Loading library…</div>
        ) : levels.length === 0 ? (
          <div className={`${PANEL} text-center py-20 px-6`}>
            <Sparkles className="w-10 h-10 mx-auto text-violet-600 mb-4" />
            <h2 className="text-lg font-bold mb-1">No levels yet</h2>
            <p className="text-sm text-slate-500 font-mono mb-6 max-w-md mx-auto">
              Generate your first intelligently-calculated level. Pick a difficulty 1-10 and the
              forge computes the queues, the optimal move plan, and the difficulty rating.
            </p>
            <button
              onClick={onCreate}
              className={`${ACCENT_BTN} inline-flex items-center gap-2 px-5 py-2.5 text-sm`}
            >
              <Plus className="w-4 h-4" /> Generate New Level
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {levels.map((level) => (
              <LevelCard
                key={level.id}
                level={level}
                menuOpen={menuOpen === level.id}
                onToggleMenu={(e) => {
                  e.stopPropagation();
                  setMenuOpen(menuOpen === level.id ? null : level.id);
                }}
                onPlay={() => onPlay(level)}
                onEdit={() => onEdit(level)}
                onDownload={() => downloadLevelJSON(level)}
                onDelete={() => setConfirmDelete(level.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className={`${PANEL} p-6 max-w-sm w-full`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">Delete level?</h3>
              <p className="text-sm text-slate-500 font-mono mb-5">
                This permanently removes the level from your library.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete(confirmDelete);
                    setConfirmDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-mono font-bold cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LevelCard: React.FC<{
  level: ForgeLevel;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onPlay: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}> = ({ level, menuOpen, onToggleMenu, onPlay, onEdit, onDownload, onDelete }) => {
  const rating = ratingForDifficulty(level.difficulty);
  const sim = level.sim;
  const previewDishes = level.queues.map((lane) => lane[0]).filter(Boolean).slice(0, 5);

  return (
    <div className={`${PANEL} p-4 relative flex flex-col gap-3 hover:border-violet-600/60 transition`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold truncate">{level.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Stars count={rating.stars} />
            <span className="text-[10px] font-mono text-slate-500">
              {sim?.solvable ? 'solvable' : 'unsolved'}
            </span>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={onToggleMenu}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-9 z-20 w-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
              >
                <MenuItem icon={<Play className="w-3.5 h-3.5" />} label="Play level" onClick={onPlay} />
                <MenuItem
                  icon={<Download className="w-3.5 h-3.5" />}
                  label="Download JSON"
                  onClick={onDownload}
                />
                <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Edit level" onClick={onEdit} />
                <MenuItem
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  label="Delete"
                  danger
                  onClick={onDelete}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <DifficultyPill difficulty={level.difficulty} />

      {/* Front-of-queue preview */}
      <div className="flex items-center gap-1.5">
        {previewDishes.map((d, i) => (
          <DishChip key={i} dish={d} size={28} />
        ))}
        <span className="text-[10px] font-mono text-slate-500 ml-1">
          {level.params.numQueues} lanes
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
        <Stat label="Moves" value={sim?.totalMoves ?? '—'} />
        <Stat label="Crit" value={sim?.criticalMoves ?? '—'} accent="text-amber-600" />
        <Stat
          label="Err risk"
          value={sim ? `${Math.round(sim.failChance * 100)}%` : '—'}
          accent="text-rose-600"
        />
      </div>

      <button
        onClick={onPlay}
        className={`${ACCENT_BTN} w-full flex items-center justify-center gap-2 py-2 text-sm mt-1`}
      >
        <Play className="w-3.5 h-3.5" /> Play
      </button>
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon, label, onClick, danger }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono text-left hover:bg-slate-100 transition cursor-pointer ${
      danger ? 'text-rose-600' : 'text-slate-700'
    }`}
  >
    {icon}
    {label}
  </button>
);

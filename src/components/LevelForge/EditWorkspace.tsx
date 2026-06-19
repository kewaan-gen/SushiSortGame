/**
 * EditWorkspace - opens an edit surface with a separate window/tab per section:
 *   Structure | Queues | Customers | Simulation
 *
 * The forge owns optimal generation; manual editing here is a precaution. Any edit
 * re-runs the solver (regenerateSim) so the level's move plan + rating stay correct.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeftRight,
  Plus,
  Loader2,
  LayoutGrid,
  Users,
  Activity,
  Sliders,
} from 'lucide-react';
import {
  ForgeLevel,
  DishLetter,
  DISH_LETTERS,
} from '../../forge/types';
import { regenerateSim } from '../../forge/generator';
import { ratingForDifficulty, computeDifficultyIndex } from '../../forge/difficulty';
import {
  DishChip,
  Stat,
  Stars,
  DifficultyPill,
  PANEL,
  ACCENT_BTN,
  GHOST_BTN,
} from './shared';

type Tab = 'structure' | 'queues' | 'customers' | 'simulation';

interface Props {
  level: ForgeLevel;
  onCancel: () => void;
  onSave: (level: ForgeLevel) => void;
  onPlay: (level: ForgeLevel) => void;
}

interface Selection {
  lane: number;
  index: number;
}

export const EditWorkspace: React.FC<Props> = ({ level, onCancel, onSave, onPlay }) => {
  const [draft, setDraft] = useState<ForgeLevel>(level);
  const [tab, setTab] = useState<Tab>('queues');
  const [sel, setSel] = useState<Selection | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const varieties = draft.params.numVarieties;
  const letters = DISH_LETTERS.slice(0, varieties);

  /** Apply a mutation to queues/customers and schedule a re-simulation. */
  const mutate = (next: ForgeLevel) => {
    setDraft(next);
    setRecomputing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const resimmed = regenerateSim(next);
      setDraft(resimmed);
      setRecomputing(false);
    }, 350);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // --- queue mutations --- //
  const cycleDish = (lane: number, index: number) => {
    const q = draft.queues.map((l) => [...l]);
    const cur = q[lane][index];
    const pos = letters.indexOf(cur);
    q[lane][index] = letters[(pos + 1) % letters.length] as DishLetter;
    mutate({ ...draft, queues: q });
  };

  const setDish = (lane: number, index: number, dish: DishLetter) => {
    const q = draft.queues.map((l) => [...l]);
    q[lane][index] = dish;
    mutate({ ...draft, queues: q });
  };

  const removePlate = (lane: number, index: number) => {
    const q = draft.queues.map((l) => [...l]);
    q[lane].splice(index, 1);
    mutate({ ...draft, queues: q });
    setSel(null);
  };

  const movePlate = (lane: number, index: number, dir: -1 | 1) => {
    const q = draft.queues.map((l) => [...l]);
    const j = index + dir;
    if (j < 0 || j >= q[lane].length) return;
    [q[lane][index], q[lane][j]] = [q[lane][j], q[lane][index]];
    mutate({ ...draft, queues: q });
    setSel({ lane, index: j });
  };

  const movePlateLane = (lane: number, index: number, dir: -1 | 1) => {
    const target = lane + dir;
    if (target < 0 || target >= draft.queues.length) return;
    const q = draft.queues.map((l) => [...l]);
    const [plate] = q[lane].splice(index, 1);
    q[target].unshift(plate);
    mutate({ ...draft, queues: q });
    setSel({ lane: target, index: 0 });
  };

  const addPlate = (lane: number) => {
    const q = draft.queues.map((l) => [...l]);
    q[lane].push(letters[0] as DishLetter);
    mutate({ ...draft, queues: q });
  };

  // --- customer mutations --- //
  const setCustomer = (i: number, dish: DishLetter, demand: number) => {
    const customers = draft.customers.map((c, idx) =>
      idx === i ? { dish, demand: Math.max(1, demand) } : c,
    );
    mutate({ ...draft, customers });
  };

  const sim = draft.sim;
  const measuredRating = sim ? ratingForDifficulty(Math.round(sim.difficultyIndex)) : null;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="bg-transparent font-black text-lg outline-none border-b border-transparent focus:border-violet-500"
            />
            <div className="flex items-center gap-2 mt-0.5">
              <DifficultyPill difficulty={draft.difficulty} />
              {recomputing ? (
                <span className="text-[10px] font-mono text-amber-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> re-solving…
                </span>
              ) : (
                sim && (
                  <span className="text-[10px] font-mono text-slate-500">
                    index {sim.difficultyIndex} · {sim.solvable ? 'solvable' : 'unsolved'}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPlay(draft)}
            className={`${GHOST_BTN} px-4 py-2.5 text-sm flex items-center gap-2`}
          >
            <Play className="w-4 h-4" /> Test play
          </button>
          <button
            onClick={() => onSave(draft)}
            className={`${ACCENT_BTN} px-5 py-2.5 text-sm flex items-center gap-2`}
          >
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </header>

      {/* Tabs (section windows) */}
      <div className="shrink-0 flex items-center gap-1 px-5 py-3 border-b border-slate-200">
        <TabButton active={tab === 'structure'} onClick={() => setTab('structure')} icon={<Sliders className="w-3.5 h-3.5" />} label="Structure" />
        <TabButton active={tab === 'queues'} onClick={() => setTab('queues')} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Queues" />
        <TabButton active={tab === 'customers'} onClick={() => setTab('customers')} icon={<Users className="w-3.5 h-3.5" />} label="Customers" />
        <TabButton active={tab === 'simulation'} onClick={() => setTab('simulation')} icon={<Activity className="w-3.5 h-3.5" />} label="Simulation" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === 'structure' && (
          <div className={`${PANEL} p-6 max-w-2xl`}>
            <h3 className="font-bold mb-4">Structure</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <Stat label="Difficulty" value={`D${draft.difficulty}`} />
              <Stat label="Varieties" value={draft.params.numVarieties} />
              <Stat label="Seats" value={draft.params.numSeats} />
              <Stat label="Customers" value={draft.customers.length} />
              <Stat label="Queues" value={draft.queues.length} />
              <Stat
                label="Total plates"
                value={draft.queues.reduce((s, l) => s + l.length, 0)}
              />
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-5 leading-relaxed">
              Structure is fixed at generation. To change seats/varieties/customers, generate a new
              level. You can still re-arrange queues and tune customer demand here — the solver
              re-rates the level on every change.
            </p>
            {measuredRating && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">Re-rated:</span>
                <Stars count={measuredRating.stars} />
                <span className="text-xs font-mono text-slate-500">{measuredRating.label}</span>
              </div>
            )}
          </div>
        )}

        {tab === 'queues' && (
          <div>
            <p className="text-xs font-mono text-slate-500 mb-4">
              Tap a plate to select it, then use the toolbar to recolor, reorder, move lanes, or
              delete. Front of each lane is at the bottom (dispatched first).
            </p>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {draft.queues.map((lane, li) => (
                <div key={li} className={`${PANEL} p-3 shrink-0 w-[120px]`}>
                  <div className="text-center text-xs font-mono text-slate-500 mb-2">
                    Lane {li}
                    <span className="block text-[9px] text-slate-400">{lane.length} plates</span>
                  </div>
                  <div className="flex flex-col-reverse gap-1.5 items-center min-h-[40px]">
                    {lane.map((dish, di) => (
                      <div key={di} className="relative">
                        <DishChip
                          dish={dish}
                          size={34}
                          dim={di !== 0 && !(sel?.lane === li && sel?.index === di)}
                          ring={sel?.lane === li && sel?.index === di}
                          onClick={() =>
                            setSel(
                              sel?.lane === li && sel?.index === di ? null : { lane: li, index: di },
                            )
                          }
                        />
                        {di === 0 && (
                          <span className="absolute -left-1 -bottom-1 text-[8px] font-mono bg-emerald-500 text-black px-1 rounded-full">
                            ▲
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addPlate(li)}
                    className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-mono cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> add
                  </button>
                </div>
              ))}
            </div>

            {/* Selection toolbar */}
            {sel && draft.queues[sel.lane] && draft.queues[sel.lane][sel.index] && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${PANEL} p-4 mt-2 max-w-3xl`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-mono text-slate-500">
                    Lane {sel.lane}, pos {sel.index}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {letters.map((l) => (
                      <DishChip
                        key={l}
                        dish={l}
                        size={28}
                        dim={draft.queues[sel.lane][sel.index] !== l}
                        onClick={() => setDish(sel.lane, sel.index, l)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <IconBtn title="Move up" onClick={() => movePlate(sel.lane, sel.index, 1)}>
                      <ChevronUp className="w-4 h-4" />
                    </IconBtn>
                    <IconBtn title="Move down" onClick={() => movePlate(sel.lane, sel.index, -1)}>
                      <ChevronDown className="w-4 h-4" />
                    </IconBtn>
                    <IconBtn title="Move to left lane" onClick={() => movePlateLane(sel.lane, sel.index, -1)}>
                      <ArrowLeftRight className="w-4 h-4 -scale-x-100" />
                    </IconBtn>
                    <IconBtn title="Move to right lane" onClick={() => movePlateLane(sel.lane, sel.index, 1)}>
                      <ArrowLeftRight className="w-4 h-4" />
                    </IconBtn>
                    <IconBtn title="Delete" danger onClick={() => removePlate(sel.lane, sel.index)}>
                      <Trash2 className="w-4 h-4" />
                    </IconBtn>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {tab === 'customers' && (
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-mono text-slate-500 mb-3">
              Customers arrive in this order; the first {draft.params.numSeats} are seated at start.
            </p>
            {draft.customers.map((c, i) => (
              <div key={i} className={`${PANEL} p-3 flex items-center gap-3`}>
                <span className="text-xs font-mono text-slate-500 w-8">#{i + 1}</span>
                <div className="flex items-center gap-1.5">
                  {letters.map((l) => (
                    <DishChip
                      key={l}
                      dish={l}
                      size={26}
                      dim={c.dish !== l}
                      onClick={() => setCustomer(i, l, c.demand)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[10px] font-mono text-slate-500">demand</span>
                  <button
                    onClick={() => setCustomer(i, c.dish, c.demand - 1)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono cursor-pointer"
                  >
                    −
                  </button>
                  <span className="font-mono font-bold w-6 text-center">{c.demand}</span>
                  <button
                    onClick={() => setCustomer(i, c.dish, c.demand + 1)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'simulation' && sim && (
          <div className="max-w-3xl space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <Stat label="Solvable" value={sim.solvable ? 'Yes' : 'No'} accent={sim.solvable ? 'text-emerald-700' : 'text-rose-600'} />
              <Stat label="Moves req." value={sim.totalMoves} />
              <Stat label="Critical" value={sim.criticalMoves} accent="text-amber-600" />
              <Stat label="Buffer peak" value={`${sim.bufferPeak}/5`} />
              <Stat label="MCR" value={sim.mcr.toFixed(2)} accent="text-sky-700" />
              <Stat label="Err risk" value={`${Math.round(sim.failChance * 100)}%`} accent="text-rose-600" />
              <Stat label="Ticks" value={sim.completionTicks} />
              <Stat label="Index" value={sim.difficultyIndex} accent="text-violet-700" />
            </div>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                Optimal move plan ({sim.movePlan.length} taps)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sim.movePlan.map((m) => (
                  <div
                    key={m.index}
                    title={`Move ${m.index}: lane ${m.lane}, dish ${m.dish}, err ${Math.round(
                      m.errorChance * 100,
                    )}%`}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border ${
                      m.critical
                        ? 'bg-amber-100 border-amber-300 text-amber-700'
                        : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                    }`}
                  >
                    <span className="opacity-60">{m.index}</span>
                    <span className="font-bold">{m.source === 'buffer' ? 'Dock' : `Q${m.lane}`}</span>
                    <span>{m.dish}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono transition cursor-pointer ${
      active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
    }`}
  >
    {icon}
    {label}
  </button>
);

const IconBtn: React.FC<{
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, danger, children }) => (
  <button
    title={title}
    onClick={onClick}
    className={`p-2 rounded-lg cursor-pointer transition ${
      danger ? 'bg-rose-100 hover:bg-rose-200 text-rose-600' : 'bg-slate-100 hover:bg-slate-200'
    }`}
  >
    {children}
  </button>
);

void computeDifficultyIndex;

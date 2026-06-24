/**
 * PlayView - standalone playable board for a forged level + live Move Tracker panel.
 *
 * Light "white-grey" theme. The board is driven by the same deterministic simulator
 * the solver uses, so play matches the computed move plan exactly. The right panel
 * shows: all dishes in the level, the live queues (with the recommended lane
 * highlighted), and the optimal plan with completed moves checked.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Play as PlayIcon,
  Pause,
  RotateCcw,
  Trophy,
  XCircle,
  Target,
  Users,
} from 'lucide-react';
import { ForgeLevel, FIXED, DishLetter } from '../../forge/types';
import {
  GameState,
  LevelDef,
  createInitialState,
  dispatch,
  dispatchBuffer,
  bufferEntryFree,
  tick,
  isVictory,
  laneDispatchable,
  seatSlotsFor,
  remainingDemand,
  firstFreeSlotFrom,
  BELT_ENTRY_SLOT,
} from '../../forge/simulator';
import { DishChip, Stat, PANEL, ACCENT_BTN, GHOST_BTN, DifficultyPill } from './shared';

interface Props {
  level: ForgeLevel;
  onExit: () => void;
}

type Status = 'playing' | 'won' | 'lost';

const BELT_TICK_MS = FIXED.beltSpeedMs;

/**
 * Position of belt slot i on an oval (schematic).
 * Slot 0 sits at the BOTTOM; slots increase counter-clockwise (0 bottom -> 1 lower-right
 * -> 3 right -> 6 top -> 9 left), matching the direction plates travel.
 */
function slotPos(i: number, cx: number, cy: number, rx: number, ry: number) {
  const theta = (i / 12) * Math.PI * 2;
  return { x: cx + rx * Math.sin(theta), y: cy + ry * Math.cos(theta) };
}

let laneIdSeq = 0;
/** Stable per-plate ids so queue rows can layout-animate as the front is dispatched. */
function makeLaneIds(queues: DishLetter[][]): number[][] {
  return queues.map((lane) => lane.map(() => laneIdSeq++));
}

interface Flight {
  id: number;
  dish: DishLetter;
  slot: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** A short celebratory particle burst around a seat when a dish is eaten. */
const EatParticles: React.FC<{ big?: boolean }> = ({ big }) => {
  const n = big ? 10 : 6;
  return (
    <>
      {Array.from({ length: n }).map((_, k) => {
        const ang = (k / n) * Math.PI * 2 + (big ? 0.3 : 0);
        const dist = (big ? 34 : 24) + (k % 3) * 5;
        const sz = big ? 7 : 5;
        return (
          <motion.span
            key={k}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: sz,
              height: sz,
              marginLeft: -sz / 2,
              marginTop: -sz / 2,
              backgroundColor: big ? '#f59e0b' : '#34d399',
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, opacity: 0, scale: 0.3 }}
            transition={{ duration: big ? 0.7 : 0.55, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
};

export const PlayView: React.FC<Props> = ({ level, onExit }) => {
  const def: LevelDef = {
    queues: level.queues,
    customers: level.customers,
    numSeats: level.params.numSeats,
  };
  const seatSlots = seatSlotsFor(def.numSeats);
  const plan = level.sim?.movePlan ?? [];

  const [gs, setGs] = useState<GameState>(() => createInitialState(def));
  const [status, setStatus] = useState<Status>('playing');
  const [running, setRunning] = useState(true);
  const [ptr, setPtr] = useState(0);
  const [movesMade, setMovesMade] = useState(0);
  const [deviations, setDeviations] = useState(0);
  const gsRef = useRef(gs);
  gsRef.current = gs;

  // --- Juice: dispatch flights, queue layout ids, eat pulses + particle bursts ---
  const [laneIds, setLaneIds] = useState<number[][]>(() => makeLaneIds(level.queues));
  const [flights, setFlights] = useState<Flight[]>([]);
  const [pulse, setPulse] = useState<number[]>(() => def.customers.length ? gsRef.current.seats.map(() => 0) : []);
  const [bursts, setBursts] = useState<{ id: number; seat: number; big: boolean }[]>([]);
  const playRef = useRef<HTMLDivElement>(null);
  const flightSeq = useRef(0);
  const burstSeq = useRef(0);
  const prevSeatsRef = useRef(gs.seats.map((s) => ({ c: s.customerIdx, r: s.remaining })));

  const centerInPlay = (el: Element | null | undefined): { x: number; y: number } | null => {
    if (!el || !playRef.current) return null;
    const host = playRef.current;
    const p = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // Content-space coords (add scroll) so the absolute overlay aligns even when scrolled.
    return {
      x: r.left + r.width / 2 - p.left + host.scrollLeft,
      y: r.top + r.height / 2 - p.top + host.scrollTop,
    };
  };

  const launchFlight = (dish: DishLetter, fromEl: Element | null | undefined, toSlot: number) => {
    const from = centerInPlay(fromEl);
    const to = centerInPlay(playRef.current?.querySelector(`[data-belt-slot="${toSlot}"]`));
    if (!from || !to) return;
    const id = ++flightSeq.current;
    setFlights((f) => [...f, { id, dish, slot: toSlot, from, to }]);
    window.setTimeout(() => setFlights((f) => f.filter((x) => x.id !== id)), 460);
  };

  // Belt slots currently masked by an in-flight chip (so we never show a duplicate plate).
  const coveredSlots = new Set(flights.map((f) => f.slot));

  const triggerEat = (seatIdx: number, big: boolean) => {
    setPulse((p) => {
      const n = [...p];
      n[seatIdx] = (n[seatIdx] ?? 0) + 1;
      return n;
    });
    const id = ++burstSeq.current;
    setBursts((b) => [...b, { id, seat: seatIdx, big }]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), big ? 750 : 600);
  };

  // Detect dishes being eaten (remaining drops, or a customer leaves after the last bite).
  useEffect(() => {
    const prev = prevSeatsRef.current;
    gs.seats.forEach((s, i) => {
      const p = prev[i];
      if (!p) return;
      if (p.c >= 0 && p.c === s.customerIdx && s.remaining < p.r) {
        triggerEat(i, false);
      } else if (p.c >= 0 && p.c !== s.customerIdx && p.r > 0) {
        // Customer finished their last bite and left — celebratory burst.
        triggerEat(i, true);
      }
    });
    prevSeatsRef.current = gs.seats.map((s) => ({ c: s.customerIdx, r: s.remaining }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs]);

  const nextStep = ptr < plan.length ? plan[ptr] : null;
  const recIsBuffer = nextStep?.source === 'buffer';
  const recommendedLane = nextStep && !recIsBuffer ? nextStep.lane : null;
  const recommendedDock = recIsBuffer ? nextStep!.dish : null;
  const nextErr = nextStep ? nextStep.errorChance : 0;

  const checkEnd = useCallback(
    (next: GameState) => {
      if (next.failed) {
        setStatus('lost');
        setRunning(false);
      } else if (isVictory(next, def)) {
        setStatus('won');
        setRunning(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!running || status !== 'playing') return;
    const id = setInterval(() => {
      const next = tick(gsRef.current, def);
      setGs(next);
      checkEnd(next);
    }, BELT_TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, status]);

  const handleDispatch = (lane: number) => {
    if (status !== 'playing') return;
    if (!laneDispatchable(gs, lane)) return;
    const entry = firstFreeSlotFrom(gs, BELT_ENTRY_SLOT);
    const dish = gs.queues[lane][0];
    const next = dispatch(gs, def, lane);
    setGs(next);
    setLaneIds((prev) => prev.map((ids, i) => (i === lane ? ids.slice(1) : ids)));
    if (dish && entry >= 0) {
      launchFlight(dish, playRef.current?.querySelector(`[data-lane-front="${lane}"]`), entry);
    }
    setMovesMade((m) => m + 1);
    if (recommendedLane === lane) setPtr((p) => p + 1);
    else setDeviations((d) => d + 1);
    checkEnd(next);
  };

  const handleDockDispatch = (dish: DishLetter, fromEl?: Element | null) => {
    if (status !== 'playing') return;
    if (!bufferEntryFree(gs) || !gs.buffer.includes(dish)) return;
    const entry = firstFreeSlotFrom(gs, BELT_ENTRY_SLOT);
    const next = dispatchBuffer(gs, def, dish);
    setGs(next);
    if (entry >= 0) launchFlight(dish, fromEl, entry);
    setMovesMade((m) => m + 1);
    if (recommendedDock === dish) setPtr((p) => p + 1);
    else setDeviations((d) => d + 1);
    checkEnd(next);
  };

  const restart = () => {
    const fresh = createInitialState(def);
    prevSeatsRef.current = fresh.seats.map((s) => ({ c: s.customerIdx, r: s.remaining }));
    setGs(fresh);
    setLaneIds(makeLaneIds(level.queues));
    setFlights([]);
    setBursts([]);
    setPulse(fresh.seats.map(() => 0));
    setStatus('playing');
    setRunning(true);
    setPtr(0);
    setMovesMade(0);
    setDeviations(0);
  };

  const totalRequired = plan.length;
  const movesLeft = Math.max(0, totalRequired - ptr);
  const demandLeft = remainingDemand(gs, def);
  const totalDemand = level.customers.reduce((s, c) => s + c.demand, 0);

  // Live incoming-customer strip: who is seated now (with their remaining counter),
  // who is still queued to arrive, and who is already done.
  const seatedByIdx = new Map<number, (typeof gs.seats)[number]>(
    gs.seats.filter((s) => s.customerIdx >= 0).map((s) => [s.customerIdx, s]),
  );
  const customerList = level.customers.map((c, idx) => {
    const seat = seatedByIdx.get(idx);
    if (seat) return { idx, dish: c.dish, count: seat.remaining, state: 'seated' as const };
    if (idx < gs.nextCustomerIdx) return { idx, dish: c.dish, count: 0, state: 'done' as const };
    return { idx, dish: c.dish, count: c.demand, state: 'incoming' as const };
  });

  // Board geometry — enlarged ~40% for readability.
  const cx = 250;
  const cy = 205;
  const rx = 168;
  const ry = 150;

  return (
    <div className="w-full h-full flex flex-col lg:flex-row text-slate-800">
      {/* LEFT: board */}
      <div className="flex-1 flex flex-col min-h-0">
        <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white/70">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-black text-lg">{level.name}</h1>
              <DifficultyPill difficulty={level.difficulty} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRunning((r) => !r)}
              disabled={status !== 'playing'}
              className={`${GHOST_BTN} px-3 py-2 text-sm flex items-center gap-2 disabled:opacity-40`}
            >
              {running ? <Pause className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
              {running ? 'Pause' : 'Resume'}
            </button>
            <button onClick={restart} className={`${GHOST_BTN} px-3 py-2 text-sm flex items-center gap-2`}>
              <RotateCcw className="w-4 h-4" /> Restart
            </button>
          </div>
        </header>

        <div ref={playRef} className="relative flex-1 overflow-auto p-5 flex flex-col items-center gap-6">
          {/* Dispatch flight overlay (queue/dock -> belt jumps). No exit anim: the chip
              vanishes the instant it lands, exactly as the real belt plate is revealed. */}
          <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
            {flights.map((f) => {
              const peak = Math.min(f.from.y, f.to.y) - 70;
              return (
                <motion.div
                  key={f.id}
                  className="absolute left-0 top-0"
                  initial={{ x: f.from.x, y: f.from.y, scale: 1 }}
                  animate={{
                    x: f.to.x,
                    y: [f.from.y, peak, f.to.y],
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, 0],
                  }}
                  transition={{ duration: 0.44, ease: 'easeOut' }}
                >
                  <div className="-translate-x-1/2 -translate-y-1/2 drop-shadow-lg">
                    <DishChip dish={f.dish} size={42} />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Incoming customers — who to serve, with their live demand counters */}
          <div className={`${PANEL} w-full max-w-2xl px-5 py-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Incoming customers
              </span>
              <span className="text-[10px] font-mono text-slate-400 ml-auto">
                seated · waiting · served
              </span>
            </div>
            <div className="flex items-end gap-3 overflow-x-auto pb-1">
              {customerList.map((c) => (
                <div
                  key={c.idx}
                  className={`shrink-0 flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-2.5 ${
                    c.state === 'seated'
                      ? 'border-amber-400 bg-amber-50'
                      : c.state === 'done'
                      ? 'border-slate-200 bg-slate-50 opacity-40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <DishChip dish={c.dish} size={42} dim={c.state === 'done'} />
                  <span
                    className={`text-base font-mono font-bold leading-none ${
                      c.state === 'done'
                        ? 'text-slate-400'
                        : c.state === 'seated'
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {c.state === 'done' ? '✓' : `×${c.count}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Belt + seats */}
          <div className="relative" style={{ width: 520, height: 430 }}>
            <div
              className="absolute rounded-[50%] border-2 border-violet-300"
              style={{ left: cx - rx - 24, top: cy - ry - 24, width: (rx + 24) * 2, height: (ry + 24) * 2, background: 'rgba(124,58,237,0.05)' }}
            />
            <div
              className="absolute rounded-[50%] border border-dashed border-violet-200"
              style={{ left: cx - rx + 30, top: cy - ry + 30, width: (rx - 30) * 2, height: (ry - 30) * 2 }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-mono text-violet-400 tracking-widest">BELT ↻</span>
            </div>

            {Array.from({ length: 12 }).map((_, i) => {
              const p = slotPos(i, cx, cy, rx, ry);
              const plate = gs.belt.find((b) => b.slot === i);
              const isSeat = seatSlots.indexOf(i) >= 0;
              return (
                <div
                  key={i}
                  data-belt-slot={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ left: p.x, top: p.y, width: 50, height: 50 }}
                >
                  <div
                    className={`absolute inset-0 rounded-full border ${
                      isSeat ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50'
                    }`}
                  />
                  <span className="absolute -top-4 text-[9px] font-mono text-slate-400">{i}</span>
                  {plate && !coveredSlots.has(i) ? <DishChip dish={plate.dish} size={42} /> : null}
                </div>
              );
            })}

            {gs.seats.map((seat, si) => {
              const slot = seatSlots[si];
              const p = slotPos(slot, cx, cy, rx, ry);
              const dx = p.x - cx;
              const dy = p.y - cy;
              const len = Math.hypot(dx, dy) || 1;
              const ox = p.x + (dx / len) * 46;
              const oy = p.y + (dy / len) * 46;
              return (
                <div
                  key={si}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: ox, top: oy }}
                >
                  {/* Eat particle bursts for this seat */}
                  <div className="absolute left-1/2 top-3 w-0 h-0">
                    <AnimatePresence>
                      {bursts
                        .filter((b) => b.seat === si)
                        .map((b) => (
                          <motion.div
                            key={b.id}
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute left-0 top-0 w-0 h-0"
                          >
                            <EatParticles big={b.big} />
                          </motion.div>
                        ))}
                    </AnimatePresence>
                  </div>

                  {seat.customerIdx >= 0 && seat.dish ? (
                    <div className="flex flex-col items-center gap-1">
                      <motion.div
                        key={pulse[si] ?? 0}
                        initial={{ scale: 1 }}
                        animate={{ scale: (pulse[si] ?? 0) > 0 ? [1, 1.4, 1] : 1 }}
                        transition={{ duration: 0.34, ease: 'easeOut' }}
                      >
                        <DishChip dish={seat.dish} size={34} />
                      </motion.div>
                      <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shadow-sm">
                        ×{seat.remaining}
                      </span>
                    </div>
                  ) : seat.turnover > 0 ? (
                    <span className="text-xs font-mono text-slate-400">…</span>
                  ) : (
                    <span className="text-xs font-mono text-slate-300">empty</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dock (tap a dish to send it back onto the belt) */}
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Dock — tap a dish to send it back
              </span>
              <span
                className={`text-sm font-mono font-bold ${
                  gs.buffer.length >= 4 ? 'text-rose-600' : 'text-slate-500'
                }`}
              >
                {gs.buffer.length}/{FIXED.bufferSlots}
              </span>
            </div>
            <div className="flex gap-3">
              {Array.from({ length: FIXED.bufferSlots }).map((_, i) => {
                const dish = gs.buffer[i];
                const isRec = dish && recommendedDock === dish && status === 'playing';
                const canTap = !!dish && bufferEntryFree(gs) && status === 'playing';
                return (
                  <button
                    key={i}
                    onClick={(e) => dish && handleDockDispatch(dish, e.currentTarget)}
                    disabled={!canTap}
                    className={`flex-1 h-16 rounded-xl border-2 flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed ${
                      isRec
                        ? 'border-emerald-500 bg-emerald-50'
                        : dish
                        ? 'bg-rose-50 border-rose-300 hover:border-violet-400'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {dish ? <DishChip dish={dish} size={44} /> : null}
                  </button>
                );
              })}
            </div>
            {!bufferEntryFree(gs) && gs.buffer.length > 0 && (
              <p className="text-[11px] font-mono text-amber-600 mt-1.5">
                Belt is full — clear some space before sending a dock plate back.
              </p>
            )}
          </div>

          {/* Dispatch lanes — only the next 3 plates per lane (3rd half-peeking) */}
          <div className="w-full max-w-2xl">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 block mb-2">
              Dispatch lanes — tap a column (front on top, any lane any time)
            </span>
            <div className="flex gap-3 justify-center items-start">
              {gs.queues.map((lane, li) => {
                const dispatchable = laneDispatchable(gs, li) && status === 'playing';
                const isRecommended = recommendedLane === li && status === 'playing';
                const top3 = lane.slice(0, 3);
                const extra = lane.length - top3.length;
                return (
                  <button
                    key={li}
                    onClick={() => handleDispatch(li)}
                    disabled={!dispatchable}
                    className={`relative flex-1 max-w-[120px] rounded-2xl border-2 p-3 transition cursor-pointer disabled:cursor-not-allowed ${
                      isRecommended
                        ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-200'
                        : dispatchable
                        ? 'border-slate-300 bg-white hover:border-violet-400 hover:bg-violet-50'
                        : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div
                      className={`text-xs font-mono font-bold text-center mb-2 ${
                        isRecommended ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      Q{li}
                      {isRecommended && (
                        <motion.span
                          initial={{ opacity: 0.4 }}
                          animate={{ opacity: 1 }}
                          transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.7 }}
                          className="ml-1 inline-flex items-center text-emerald-600"
                        >
                          <Target className="w-3 h-3" />
                        </motion.span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 items-center">
                      {lane.length === 0 ? (
                        <span className="text-xs font-mono text-slate-400 py-3">empty</span>
                      ) : (
                        <AnimatePresence initial={false} mode="popLayout">
                          {top3.map((dish, di) => {
                            const isFront = di === 0;
                            const id = laneIds[li]?.[di] ?? `${li}-${di}-${dish}`;
                            const chip =
                              di === 2 ? (
                                <div
                                  className="overflow-hidden flex items-start justify-center"
                                  style={{ height: 24 }}
                                >
                                  <DishChip dish={dish} size={48} dim />
                                </div>
                              ) : (
                                <DishChip
                                  dish={dish}
                                  size={isFront ? 56 : 48}
                                  dim={!isFront}
                                  ring={isFront && isRecommended}
                                />
                              );
                            return (
                              <motion.div
                                key={id}
                                layout
                                {...(isFront ? { 'data-lane-front': li } : {})}
                                initial={{ opacity: 0, y: 16, scale: 0.7 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.12 } }}
                                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                              >
                                {chip}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-500 font-bold text-center mt-2">
                      {extra > 0 ? `+${extra} more · ${lane.length}` : `${lane.length} left`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Move Tracker */}
      <aside className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white flex flex-col min-h-0">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-black flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" /> Move Tracker
          </h2>
        </div>

        <div className="px-5 py-4 grid grid-cols-2 gap-4 border-b border-slate-200">
          <Stat label="Moves made" value={movesMade} />
          <Stat label="Optimal total" value={totalRequired} />
          <Stat label="On-plan left" value={movesLeft} accent="text-emerald-700" />
          <Stat label="Deviations" value={deviations} accent={deviations ? 'text-rose-600' : 'text-slate-600'} />
          <Stat label="Dishes left" value={`${demandLeft}/${totalDemand}`} />
          <Stat
            label="Buffer"
            value={`${gs.buffer.length}/5`}
            accent={gs.buffer.length >= 4 ? 'text-rose-600' : 'text-slate-600'}
          />
        </div>

        {/* Live queues */}
        <div className="px-5 py-4 border-b border-slate-200">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">
            Queues (front on top)
          </span>
          <div className="flex gap-2">
            {gs.queues.map((lane, li) => {
              const isRecommended = recommendedLane === li && status === 'playing';
              const dispatchable = laneDispatchable(gs, li);
              return (
                <button
                  key={li}
                  onClick={() => handleDispatch(li)}
                  disabled={!dispatchable || status !== 'playing'}
                  className={`flex-1 rounded-xl border-2 p-1.5 transition cursor-pointer disabled:cursor-default ${
                    isRecommended
                      ? 'border-emerald-500 bg-emerald-50'
                      : dispatchable
                      ? 'border-slate-200 bg-slate-50 hover:border-violet-400'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div
                    className={`text-[9px] font-mono font-bold text-center mb-1 ${
                      isRecommended ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    Q{li}
                    {isRecommended && <span className="block text-[7px]">NEXT</span>}
                  </div>
                  <div className="flex flex-col gap-1 items-center min-h-[24px]">
                    {lane.length === 0 ? (
                      <span className="text-[8px] font-mono text-slate-300 py-1">empty</span>
                    ) : (
                      lane.map((dish, di) => (
                        <DishChip key={di} dish={dish} size={20} dim={di !== 0} />
                      ))
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next move + error chance */}
        <div className="px-5 py-4 border-b border-slate-200">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Next recommended
          </span>
          {nextStep ? (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">Tap</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 font-mono font-bold text-sm">
                  {recIsBuffer ? 'Dock' : `Q${recommendedLane}`}
                </span>
                <DishChip dish={nextStep.dish} size={26} />
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono text-slate-400">err if blind</div>
                <div
                  className={`font-mono font-bold ${
                    nextErr > 0.5 ? 'text-rose-600' : nextErr > 0 ? 'text-amber-600' : 'text-emerald-700'
                  }`}
                >
                  {Math.round(nextErr * 100)}%
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-slate-500 mt-2">Plan complete.</p>
          )}
        </div>

        {/* Plan list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">
            Optimal plan
          </span>
          {plan.length === 0 ? (
            <p className="text-xs font-mono text-slate-500">
              No exact plan available (large level — play freely).
            </p>
          ) : (
            <div className="space-y-1">
              {plan.map((m, i) => {
                const done = i < ptr;
                const current = i === ptr;
                return (
                  <div
                    key={m.index}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono border ${
                      done
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : current
                        ? 'bg-violet-50 border-violet-300 text-violet-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <span className="opacity-60 w-5">{m.index}</span>
                    <span className={`font-bold ${m.source === 'buffer' ? 'text-rose-600' : ''}`}>
                      {m.source === 'buffer' ? 'Dock' : `Q${m.lane}`}
                    </span>
                    <DishChip dish={m.dish} size={18} />
                    {m.critical && (
                      <span className="ml-auto text-[8px] text-amber-600 font-bold">CRIT</span>
                    )}
                    {done && <span className="ml-auto text-emerald-600">✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Win/Lose overlay */}
      <AnimatePresence>
        {status !== 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className={`${PANEL} p-8 max-w-sm w-full text-center`}
            >
              {status === 'won' ? (
                <>
                  <Trophy className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                  <h2 className="text-2xl font-black mb-1">Level Cleared!</h2>
                  <p className="text-sm font-mono text-slate-500 mb-5">
                    {movesMade} moves · {deviations} deviations from optimal
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 mx-auto text-rose-500 mb-3" />
                  <h2 className="text-2xl font-black mb-1">Dock Overflow</h2>
                  <p className="text-sm font-mono text-slate-500 mb-5">
                    The buffer filled up. Follow the green recommended moves to stay safe.
                  </p>
                </>
              )}
              <div className="flex gap-2 justify-center">
                <button onClick={restart} className={`${ACCENT_BTN} px-5 py-2.5 text-sm flex items-center gap-2`}>
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
                <button onClick={onExit} className={`${GHOST_BTN} px-5 py-2.5 text-sm`}>
                  Library
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

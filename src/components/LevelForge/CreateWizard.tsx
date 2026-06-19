/**
 * CreateWizard - linear, step-wise level creation flow.
 *   Step 1: Difficulty (1-10) with live derived-parameter preview.
 *   Step 2: Structure (optional overrides: seats, customers, varieties, name).
 *   Step 3: Generate & Review (forge computes queues + simulation), then Save.
 */

import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, RefreshCw, BrainCircuit, Cpu, X } from 'lucide-react';
import { ForgeLevel, ForgeParams } from '../../forge/types';
import {
  paramsForDifficulty,
  demandForDifficulty,
  ratingForDifficulty,
  naiveWinRate,
} from '../../forge/difficulty';
import { currentIntelligence, GenProgress } from '../../forge/generator';
import { generateLevelManaged, hardwareConcurrency } from '../../forge/forgeClient';
import {
  DishChip,
  Stars,
  Stat,
  PANEL,
  ACCENT_BTN,
  GHOST_BTN,
  DifficultyPill,
} from './shared';

interface Props {
  onCancel: () => void;
  onSave: (level: ForgeLevel) => void;
}

const STEPS = ['Difficulty', 'Structure', 'Generate & Review'];

export const CreateWizard: React.FC<Props> = ({ onCancel, onSave }) => {
  const [step, setStep] = useState(0);
  const [difficulty, setDifficulty] = useState(3);
  const [overrides, setOverrides] = useState<Partial<ForgeParams>>({});
  const [name, setName] = useState('');
  const [generated, setGenerated] = useState<ForgeLevel | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<GenProgress | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const runIdRef = useRef(0);
  const cancelRef = useRef<null | (() => void)>(null);

  const params = useMemo(
    () => paramsForDifficulty(difficulty, overrides),
    [difficulty, overrides],
  );
  const rating = ratingForDifficulty(difficulty);

  const runGenerate = async () => {
    const myRun = ++runIdRef.current;
    setBusy(true);
    setGenerated(null);
    setProgress(null);
    setLog([]);
    // Defer so the spinner paints before work starts.
    await new Promise((r) => setTimeout(r, 30));

    const handle = generateLevelManaged(difficulty, { overrides }, (p) => {
      if (runIdRef.current !== myRun) return;
      setProgress(p);
      setLog((prev) => {
        if (prev.length && prev[prev.length - 1] === p.message) return prev;
        return [...prev.slice(-40), p.message];
      });
    });
    cancelRef.current = handle.cancel;

    try {
      const level = await handle.promise;
      if (runIdRef.current !== myRun) return;
      if (name.trim()) level.name = name.trim();
      setGenerated(level);
      setBusy(false);
    } catch (err) {
      if (runIdRef.current !== myRun) return;
      setBusy(false);
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      if (!aborted) setLog((prev) => [...prev, `Error: ${String(err)}`]);
    }
  };

  const cancelGenerate = () => {
    runIdRef.current++; // ignore any late messages from this run
    cancelRef.current?.();
    cancelRef.current = null;
    setBusy(false);
    setProgress(null);
    setStep(1);
  };

  const goNext = () => {
    if (step === 1) {
      setStep(2);
      runGenerate();
    } else {
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 py-6">
        {/* Header + stepper */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black">New Level</h1>
        </header>

        <Stepper step={step} />

        {/* Step body */}
        <div className="mt-6">
          {step === 0 && (
            <div className={`${PANEL} p-6`}>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
                Difficulty (1 easy → 10 master)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="flex-1 accent-violet-500 cursor-pointer"
                />
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="bg-white border border-slate-300 text-slate-800 rounded-lg px-3 py-2 font-mono text-sm cursor-pointer"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      D{d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <DifficultyPill difficulty={difficulty} />
                <Stars count={rating.stars} />
              </div>

              <ParamPreview params={params} difficulty={difficulty} />
            </div>
          )}

          {step === 1 && (
            <div className={`${PANEL} p-6 space-y-5`}>
              <p className="text-xs font-mono text-slate-500 leading-relaxed">
                The forge owns the queue layout. These are optional structural overrides — leave
                them as-is to use the calibrated defaults for D{difficulty}.
              </p>

              <Field label="Level name (optional)">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Auto: ${rating.label} level`}
                  className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg px-3 py-2 font-mono text-sm"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Seats"
                  value={params.numSeats}
                  min={4}
                  max={5}
                  onChange={(v) => setOverrides((o) => ({ ...o, numSeats: v }))}
                />
                <NumberField
                  label="Varieties (A–H)"
                  value={params.numVarieties}
                  min={3}
                  max={8}
                  onChange={(v) => setOverrides((o) => ({ ...o, numVarieties: v }))}
                />
                <NumberField
                  label="Customers"
                  value={params.numCustomers}
                  min={4}
                  max={14}
                  onChange={(v) => setOverrides((o) => ({ ...o, numCustomers: v }))}
                />
                <NumberField
                  label="Queues"
                  value={params.numQueues}
                  min={3}
                  max={5}
                  onChange={(v) => setOverrides((o) => ({ ...o, numQueues: v }))}
                />
              </div>

              <button
                onClick={() => setOverrides({})}
                className={`${GHOST_BTN} text-xs px-3 py-1.5`}
              >
                Reset to calibrated defaults
              </button>
            </div>
          )}

          {step === 2 && (
            <div className={`${PANEL} p-6`}>
              {busy || !generated ? (
                <GenerationConsole progress={progress} log={log} onCancel={cancelGenerate} />
              ) : (
                <GeneratedReview level={generated} onRegenerate={runGenerate} />
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
            className={`${GHOST_BTN} px-4 py-2.5 text-sm flex items-center gap-2`}
          >
            <ArrowLeft className="w-4 h-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < 2 ? (
            <button
              onClick={goNext}
              className={`${ACCENT_BTN} px-5 py-2.5 text-sm flex items-center gap-2`}
            >
              {step === 1 ? 'Generate' : 'Next'} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              disabled={!generated || busy}
              onClick={() => generated && onSave(generated)}
              className={`${ACCENT_BTN} px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40`}
            >
              <Check className="w-4 h-4" /> Save to Library
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const PHASE_LABEL: Record<GenProgress['phase'], string> = {
  init: 'Booting',
  searching: 'Searching queue space',
  validating: 'Validating solvability',
  optimizing: 'Optimizing toward target',
  finalizing: 'Finalizing',
  done: 'Done',
};

const GenerationConsole: React.FC<{
  progress: GenProgress | null;
  log: string[];
  onCancel: () => void;
}> = ({ progress, log, onCancel }) => {
  const pct = progress
    ? Math.min(100, Math.round((progress.simsDone / Math.max(1, progress.simBudget)) * 100))
    : 0;
  const cores = hardwareConcurrency();
  return (
    <div className="py-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Cpu className="w-8 h-8 text-violet-600 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-slate-800">
            {progress ? PHASE_LABEL[progress.phase] : 'Booting forge…'}
          </p>
          <p className="font-mono text-[11px] text-slate-500">
            Simulating on a background thread · {cores}-core device · UI stays responsive
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-violet-700 font-mono font-bold text-sm justify-end">
            <BrainCircuit className="w-4 h-4" /> Lv.{progress?.intelligence ?? currentIntelligence()}
          </div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">brain</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
        <motion.div
          className="h-full bg-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ease: 'linear', duration: 0.2 }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-4">
        <span>
          Simulation {progress?.simsDone ?? 0} / {progress?.simBudget ?? 1000}
        </span>
        <span>
          {progress?.solvableFound ?? 0} solvable · best gap{' '}
          {progress?.bestGap != null ? progress.bestGap.toFixed(3) : '—'}
        </span>
      </div>

      {/* Live backend log */}
      <div className="rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] p-3 h-40 overflow-y-auto">
        {log.length === 0 ? (
          <span className="text-slate-500">$ initializing forge engine…</span>
        ) : (
          log.map((line, i) => (
            <div key={i} className="leading-relaxed">
              <span className="text-emerald-400">$</span>{' '}
              <span className={i === log.length - 1 ? 'text-white' : 'text-slate-400'}>{line}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end mt-3">
        <button onClick={onCancel} className={`${GHOST_BTN} px-4 py-2 text-xs flex items-center gap-2`}>
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
};

const Stepper: React.FC<{ step: number }> = ({ step }) => (
  <div className="flex items-center gap-2">
    {STEPS.map((label, i) => (
      <React.Fragment key={label}>
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold border ${
              i < step
                ? 'bg-violet-600 border-violet-500 text-white'
                : i === step
                ? 'bg-violet-100 border-violet-400 text-violet-700'
                : 'bg-slate-100 border-slate-300 text-slate-400'
            }`}
          >
            {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span
            className={`text-xs font-mono ${i === step ? 'text-violet-700' : 'text-slate-400'}`}
          >
            {label}
          </span>
        </div>
        {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-300" />}
      </React.Fragment>
    ))}
  </div>
);

const ParamPreview: React.FC<{ params: ForgeParams; difficulty: number }> = ({
  params,
  difficulty,
}) => (
  <div className="mt-5 pt-5 border-t border-slate-200">
    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-3">
      Calibrated parameters
    </p>
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
      <Stat label="Varieties" value={`${params.numVarieties} (A–${String.fromCharCode(64 + params.numVarieties)})`} />
      <Stat label="Seats" value={params.numSeats} />
      <Stat label="Customers" value={params.numCustomers} />
      <Stat label="Queues" value={params.numQueues} />
      <Stat label="Demand/cust" value={demandForDifficulty(difficulty)} />
      <Stat label="Target MCR" value={params.targetMCR.toFixed(2)} accent="text-sky-700" />
      <Stat
        label="Naive win%"
        value={`${Math.round(naiveWinRate(difficulty) * 100)}%`}
        accent="text-rose-600"
      />
      <Stat label="Belt / Buffer" value="850ms / 5" accent="text-slate-600" />
    </div>
    <p className="text-[10px] font-mono text-slate-400 mt-3">
      Belt speed, eating speed, buffer (5) and belt slots (12) are fixed. Naive win% is the
      Monte-Carlo-measured chance a random player wins — the felt-difficulty signal.
    </p>
  </div>
);

const GeneratedReview: React.FC<{ level: ForgeLevel; onRegenerate: () => void }> = ({
  level,
  onRegenerate,
}) => {
  const sim = level.sim!;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">{level.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <DifficultyPill difficulty={level.difficulty} />
            <span className="text-[10px] font-mono text-slate-500">
              measured index {sim.difficultyIndex}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
              {sim.approxSolve ? 'AI-validated solvable' : 'exact solvable'}
            </span>
            {sim.simRuns != null && (
              <span className="text-[10px] font-mono text-slate-400">{sim.simRuns} sims</span>
            )}
          </div>
        </div>
        <button onClick={onRegenerate} className={`${GHOST_BTN} px-3 py-2 text-xs flex items-center gap-2`}>
          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
        </button>
      </div>

      {/* Simulation summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <Stat label="Solvable" value={sim.solvable ? 'Yes' : 'No'} accent={sim.solvable ? 'text-emerald-700' : 'text-rose-600'} />
        <Stat label="Moves req." value={sim.totalMoves} />
        <Stat label="Critical" value={sim.criticalMoves} accent="text-amber-600" />
        <Stat label="Buffer peak" value={`${sim.bufferPeak}/5`} />
        <Stat label="MCR" value={sim.mcr.toFixed(2)} accent="text-sky-700" />
        <Stat label="Err risk" value={`${Math.round(sim.failChance * 100)}%`} accent="text-rose-600" />
        <Stat
          label="Naive win"
          value={sim.naiveWinRate != null ? `${Math.round(sim.naiveWinRate * 100)}%` : '—'}
          accent="text-rose-600"
        />
        <Stat label="Index" value={sim.difficultyIndex} accent="text-violet-700" />
      </div>

      {/* Queues */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
          Generated queues (front = top)
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {level.queues.map((lane, li) => (
            <div key={li} className="shrink-0">
              <div className="text-[10px] font-mono text-slate-500 text-center mb-1">Q{li}</div>
              <div className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50 border border-slate-200">
                {lane.map((dish, di) => (
                  <DishChip key={di} dish={dish} size={26} dim={di !== 0} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

const NumberField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, onChange }) => (
  <Field label={label}>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono cursor-pointer"
      >
        −
      </button>
      <span className="flex-1 text-center font-mono font-bold">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono cursor-pointer"
      >
        +
      </button>
    </div>
  </Field>
);

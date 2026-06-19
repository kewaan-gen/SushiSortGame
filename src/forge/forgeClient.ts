/**
 * Main-thread client for worker-backed level generation.
 *
 * Spawns the forge Web Worker (so generation never blocks the UI), forwards live
 * progress, persists the reinforced brain when the worker finishes, and exposes a
 * cancel handle. Falls back to running on the main thread if Workers are unavailable.
 */

import { loadBrain, saveBrain } from './learn';
import { GenProgress, GenerateOptions, runGeneration } from './generator';
import { ForgeLevel } from './types';

export interface GenHandle {
  promise: Promise<ForgeLevel>;
  cancel: () => void;
}

/** How many logical cores the device reports (for UI / "uses your hardware" feedback). */
export function hardwareConcurrency(): number {
  return typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 1;
}

export function generateLevelManaged(
  difficulty: number,
  opts: GenerateOptions,
  onProgress: (p: GenProgress) => void,
  timeBudgetMs = 9000,
): GenHandle {
  const brain = loadBrain();

  // Preferred path: dedicated worker thread.
  if (typeof Worker !== 'undefined') {
    try {
      let worker: Worker | null = new Worker(new URL('./forge.worker.ts', import.meta.url), {
        type: 'module',
      });
      let settled = false;
      const kill = () => {
        const w = worker;
        worker = null;
        w?.terminate();
      };

      const promise = new Promise<ForgeLevel>((resolve, reject) => {
        worker!.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (!msg) return;
          if (msg.type === 'progress') {
            onProgress(msg.payload as GenProgress);
          } else if (msg.type === 'done') {
            settled = true;
            try {
              saveBrain(msg.payload.brain);
            } catch {
              /* ignore */
            }
            kill();
            resolve(msg.payload.level as ForgeLevel);
          } else if (msg.type === 'cancelled') {
            settled = true;
            kill();
            reject(new DOMException('Generation cancelled', 'AbortError'));
          } else if (msg.type === 'error') {
            settled = true;
            kill();
            reject(new Error(String(msg.payload)));
          }
        };
        worker!.onerror = (err) => {
          if (settled) return;
          settled = true;
          kill();
          reject(err instanceof ErrorEvent ? new Error(err.message) : new Error('Worker error'));
        };
        worker!.postMessage({ type: 'generate', difficulty, opts, brain, timeBudgetMs });
      });

      const cancel = () => {
        if (settled) return;
        worker?.postMessage({ type: 'cancel' });
        kill();
      };
      return { promise, cancel };
    } catch {
      /* fall through to main-thread fallback */
    }
  }

  // Fallback: run on the main thread (rare — Workers unsupported). Still time-budgeted.
  let cancelled = false;
  const start = Date.now();
  const promise = (async () => {
    const { level, brain: updated } = runGeneration(
      difficulty,
      opts,
      brain,
      onProgress,
      () => cancelled || Date.now() - start > timeBudgetMs,
    );
    saveBrain(updated);
    return level;
  })();
  return { promise, cancel: () => (cancelled = true) };
}

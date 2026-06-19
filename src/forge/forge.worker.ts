/**
 * Forge generation Web Worker.
 *
 * Runs the heavy `runGeneration` core off the main thread so the UI never freezes,
 * no matter how hard the requested level. The main thread (forgeClient) posts the
 * current brain in; the worker streams progress and returns the level + reinforced
 * brain (the worker has no localStorage, so persistence happens on the main thread).
 *
 * Cancellation is cooperative: a `cancel` message flips a flag checked between
 * candidates; the client may also terminate() the worker outright.
 */

import { runGeneration, GenProgress, GenerateOptions } from './generator';
import { ForgeBrain } from './learn';

interface GenerateMsg {
  type: 'generate';
  difficulty: number;
  opts: GenerateOptions;
  brain: ForgeBrain;
  timeBudgetMs: number;
}
interface CancelMsg {
  type: 'cancel';
}
type InMsg = GenerateMsg | CancelMsg;

let cancelled = false;

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (msg.type === 'generate') {
    cancelled = false;
    const start = performance.now();
    try {
      const { level, brain } = runGeneration(
        msg.difficulty,
        msg.opts,
        msg.brain,
        (p: GenProgress) => (self as unknown as Worker).postMessage({ type: 'progress', payload: p }),
        () => cancelled || performance.now() - start > msg.timeBudgetMs,
      );
      if (cancelled) {
        (self as unknown as Worker).postMessage({ type: 'cancelled' });
        return;
      }
      (self as unknown as Worker).postMessage({ type: 'done', payload: { level, brain } });
    } catch (err) {
      (self as unknown as Worker).postMessage({ type: 'error', payload: String(err) });
    }
  }
};

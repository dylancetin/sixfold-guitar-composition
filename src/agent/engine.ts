import { Worker } from 'node:worker_threads';
import { ArrangeResultSchema } from '../domain';
import type { ArrangementRequest, ArrangeResult, Plan, PlannerProvenance, SourceScoreV1 } from '../domain';

/** The pure engine owns state count; this process boundary owns elapsed time/cancellation. */
export function arrangeBounded(source: SourceScoreV1, request: ArrangementRequest, plan: Plan, provenance: PlannerProvenance, signal?: AbortSignal): Promise<ArrangeResult> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./engine-worker.ts', import.meta.url), { workerData: { source, request, plan, provenance } });
    let done = false;
    const finish = (error: unknown, result?: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      void worker.terminate();
      if (error) reject(error);
      else { try { resolve(ArrangeResultSchema.parse(result)); } catch (cause) { reject(cause); } }
    };
    const abort = () => finish(signal?.reason ?? new Error('Arrangement cancelled'));
    const timer = setTimeout(() => finish(new Error(`search-exhausted: engine exceeded ${request.budget.maxElapsedMs}ms; no publication installed`)), request.budget.maxElapsedMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.once('message', (result: unknown) => finish(null, result));
    worker.once('error', (error) => finish(error));
    worker.once('exit', (code) => { if (!done) finish(new Error(`Engine worker exited without a candidate (${code})`)); });
    if (signal?.aborted) abort();
  });
}

export class AdapterError extends Error {
  constructor(readonly code: 'unsupported-construct' | 'artifact-mismatch' | 'revision-stale' | 'validation-failed', message: string) {
    super(message);
    this.name = 'AdapterError';
  }
}

export function requireAdapter(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AdapterError('unsupported-construct', message);
}

export function checkAbort(signal?: AbortSignal): void {
  signal?.throwIfAborted();
}

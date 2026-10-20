import fontUrl from '@coderline/alphatab/font/Bravura.woff2?url';
import { createAlphaTabBridge } from './alphatab-bridge';
import type { AlphaTabFactories } from './alphatab-bridge';
import { loadCanonical } from 'virtual:canonical-score';

// The viewer consumes notation/playback only: no source, engine or planner imports.
export async function createViewerAdapter() {
  const canonical = await loadCanonical() as Pick<AlphaTabFactories, 'createAlphaTabScore' | 'createPlaybackController'>;
  if (typeof canonical.createAlphaTabScore !== 'function' || typeof canonical.createPlaybackController !== 'function') throw new Error('The score adapter is incomplete.');
  return createAlphaTabBridge({ ...canonical, fontUrl });
}

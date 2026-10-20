declare module 'virtual:canonical-score' {
  export function loadCanonical(): Promise<Pick<import('./alphatab-bridge').AlphaTabFactories, 'createAlphaTabScore' | 'createPlaybackController'>>;
}

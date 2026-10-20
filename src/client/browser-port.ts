import type { ScoreV1 } from '../domain';

export type Role = 'melody' | 'bass' | 'harmony';
export type PlaybackSnapshot = {
  status: 'stopped' | 'playing' | 'paused'; quarter: number; occurrenceIndex: number;
  seconds: number; durationSeconds: number; activePerformedSoundIds: string[];
};
export interface ScoreController {
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(occurrenceIndex: number): void;
  setTempo(absoluteScale: number): void;
  setLoop(range: { from: number; to: number } | null): void;
  setMuted(roles: Role[]): void;
  setSolo(roles: Role[]): void;
  setFollow(enabled: boolean): void;
  setZoom(scale: number): void;
  dispose(): void;
}
export interface BrowserViewerAdapter {
  mount(options: {
    container: HTMLElement; score: ScoreV1; title: string;
    onCursor: (snapshot: PlaybackSnapshot) => void;
    onSelect: (soundId: string, occurrenceId: string) => void;
    onError: (message: string) => void;
  }): Promise<ScoreController>;
}
export async function loadViewerAdapter(): Promise<BrowserViewerAdapter> {
  const path = '/integrations/canonical.js';
  const module = await import(/* @vite-ignore */ path) as { createViewerAdapter?: () => BrowserViewerAdapter | Promise<BrowserViewerAdapter> };
  if (!module.createViewerAdapter) throw new Error('The published score renderer is not installed in this build. Downloads remain available.');
  return module.createViewerAdapter();
}

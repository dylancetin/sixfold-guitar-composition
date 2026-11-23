import type { ScoreV1 } from '../domain';
import type { PreviewLyrics } from '../lyrics';

export type Role = 'melody' | 'bass' | 'harmony';
export type FretMode = 'relative' | 'absolute';
/** Standard notation + TAB, notation only, or TAB only. */
export type StaffView = 'both' | 'notation' | 'tab';
export type PreviewLayout = { spacing: 'normal' | 'compact' | 'tight'; barsPerRow: number };
export const DEFAULT_PREVIEW_LAYOUT: PreviewLayout = { spacing: 'tight', barsPerRow: 4 };
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
  setFretMode(mode: FretMode): Promise<void>;
  setLayout(layout: PreviewLayout): Promise<void>;
  setFingerNumbers(enabled: boolean): Promise<void>;
  setMeasureLabels(enabled: boolean): Promise<void>;
  setStaves(staves: StaffView): Promise<void>;
  setNoteNames(enabled: boolean): Promise<void>;
  setLyrics(lyrics: PreviewLyrics | undefined): Promise<void>;
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

import { useEffect, useState } from 'react';
import type { ScoreV1 } from '../domain';
import { lyricsForScore, PreviewLyricsSchema } from '../lyrics';
import type { PreviewLyrics } from '../lyrics';

type LyricsState = { status: 'loading' } | { status: 'ready'; lyrics: PreviewLyrics } | { status: 'unavailable' };

export function useSourceLyrics(id: string, score: ScoreV1): LyricsState {
  const [state, setState] = useState<LyricsState>({ status: 'loading' });
  useEffect(() => {
    const abort = new AbortController();
    setState({ status: 'loading' });
    void (async () => {
      const response = await fetch(`/arrangements/${encodeURIComponent(id)}/lyrics.json`, { signal: abort.signal });
      if (!response.ok) throw new Error('Source lyrics unavailable');
      const lyrics = PreviewLyricsSchema.parse(await response.json());
      if (lyrics.sourceRevision.id !== score.source.revision.id || lyrics.sourceRevision.digest !== score.source.revision.digest || lyrics.scoreRevision.id !== score.revision.id || lyrics.scoreRevision.digest !== score.revision.digest) throw new Error('Lyrics revision mismatch');
      if (!abort.signal.aborted) setState({ status: 'ready', lyrics: { ...lyrics, syllables: lyricsForScore(score, lyrics) } });
    })().catch(() => { if (!abort.signal.aborted) setState({ status: 'unavailable' }); });
    return () => abort.abort();
  }, [id, score]);
  return state;
}

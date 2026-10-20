import { AdapterProjectionSchema } from '../domain';
import type { AdapterProjection, ScoreV1 } from '../domain';
import type { BrowserViewerAdapter, Role } from './browser-port';

type Bounds = { x: number; y: number; w: number; h: number };
type Layout = { width: number; height: number; fragments: { x: number; y: number; width: number; height: number; svg: string }[]; beats: { nativeBeatId: string; occurrenceId: string; bounds: Bounds; cursorX: number }[] };
type AudioSnapshot = {
  state: string; positionQuarter: number; positionSeconds: number; durationSeconds: number;
  occurrenceId: string | null; error: string | null; activePerformedSoundIds: string[];
  activeSegments: { eventId: string; segmentId: string; occurrenceId: string }[];
};
export type AlphaTabFactories = {
  fontUrl: string;
  createAlphaTabScore: (score: ScoreV1, options: { title: string; barsPerRow: number }) => { projection: AdapterProjection; renderSvg(width: number, signal?: AbortSignal): Promise<Layout> };
  createPlaybackController: (score: ScoreV1) => {
    play(): Promise<void>; pause(): void; stop(): void; seek(quarter: number): void;
    setTempoScale(scale: number): void; setMuted(role: Role, muted: boolean): void; setSolo(role: Role, solo: boolean): void;
    setLoop(range: { startQuarter: number; endQuarter: number } | null): void;
    subscribe(callback: (snapshot: AudioSnapshot) => void): () => void;
    dispose(): void | Promise<void>;
  };
};
const number = (q: { n: number; d: number }) => q.n / q.d;
export function createAlphaTabBridge(factories: AlphaTabFactories): BrowserViewerAdapter {
  return {
    async mount({ container, score, title, onCursor, onSelect, onError }) {
      const abort = new AbortController();
      const font = new FontFace('alphaTab', `url(${JSON.stringify(factories.fontUrl)})`);
      await font.load(); document.fonts.add(font);
      let audio: ReturnType<AlphaTabFactories['createPlaybackController']> | null = null;
      let unsubscribe = () => {};
      const surface = document.createElement('div'); surface.className = 'native-score';
      try {
        const notation = factories.createAlphaTabScore(score, { title, barsPerRow: 2 });
        const projection = AdapterProjectionSchema.parse(notation.projection);
        if (projection.scoreRevision.id !== score.revision.id || projection.scoreRevision.digest !== score.revision.digest) throw new Error('The engraving belongs to another revision.');
        const layout = await notation.renderSvg(Math.max(790, container.clientWidth - 32), abort.signal);
        const content = document.createElement('div'); content.className = 'native-content';
        surface.append(content);
        let zoom = 1, follow = true, lastQuarter = 0;
        const size = () => {
          surface.style.width = `${layout.width * zoom}px`; surface.style.height = `${layout.height * zoom}px`;
          content.style.width = `${layout.width}px`; content.style.height = `${layout.height}px`;
          content.style.transform = `scale(${zoom})`;
        };
        size();
        for (const fragment of layout.fragments) {
          const node = document.createElement('div'); node.className = 'native-fragment';
          Object.assign(node.style, { left: `${fragment.x}px`, top: `${fragment.y}px`, width: `${fragment.width}px`, height: `${fragment.height}px` });
          const svg = new DOMParser().parseFromString(fragment.svg, 'image/svg+xml');
          if (svg.querySelector('parsererror,script,foreignObject,iframe,image') || [...svg.querySelectorAll('*')].some(e => [...e.attributes].some(a => /^on/i.test(a.name) || (/(?:href|src)$/i.test(a.name) && !a.value.startsWith('#')) || (a.name === 'style' && /(?:url\(|javascript:|data:)/i.test(a.value))))) throw new Error('Unsafe content in score rendering.');
          node.append(svg.documentElement); content.append(node);
        }
        audio = factories.createPlaybackController(score);
        for (const beat of layout.beats) {
          const mappings = projection.mapping.filter(m => m.nativeBeatId === beat.nativeBeatId && m.occurrenceId === beat.occurrenceId && m.nativeNoteId !== null);
          const mapping = mappings.find(m => score.sounds.find(s => s.id === m.eventId)?.role === 'melody') ?? mappings[0];
          if (!mapping) continue;
          const sound = score.sounds.find(s => s.id === mapping.eventId)!;
          const target = document.createElement('button'); target.className = 'native-note-target';
          target.setAttribute('aria-label', `Inspect ${sound.role} ${sound.spelling.step}${sound.spelling.octave}, ${beat.occurrenceId}`);
          target.dataset.soundId = sound.id; target.dataset.occurrenceId = beat.occurrenceId;
          Object.assign(target.style, { left: `${beat.bounds.x}px`, top: `${beat.bounds.y}px`, width: `${Math.max(20, beat.bounds.w)}px`, height: `${Math.max(24, beat.bounds.h)}px` });
          target.addEventListener('click', () => {
            onSelect(mapping.eventId, mapping.occurrenceId);
            const occurrence = score.occurrences.find(o => o.id === mapping.occurrenceId)!;
            const written = score.bars.find(b => b.id === occurrence.writtenBarId)!;
            const segment = score.notation.find(s => s.id === mapping.segmentId)!;
            audio!.seek(number(occurrence.start) + number(segment.start) - number(written.start));
          });
          content.append(target);
        }
        const cursor = document.createElement('div'); cursor.className = 'native-cursor'; cursor.hidden = true; content.append(cursor);
        container.replaceChildren(surface);
        unsubscribe = audio.subscribe(snapshot => {
          if (snapshot.error) onError(snapshot.error);
          const occurrenceIndex = Math.max(0, score.occurrences.findIndex(o => o.id === snapshot.occurrenceId));
          onCursor({ status: snapshot.state === 'playing' ? 'playing' : snapshot.state === 'paused' ? 'paused' : 'stopped', quarter: snapshot.positionQuarter, seconds: snapshot.positionSeconds, durationSeconds: snapshot.durationSeconds, occurrenceIndex, activePerformedSoundIds: snapshot.activePerformedSoundIds });
          const active = snapshot.activeSegments.find(s => score.sounds.find(n => n.id === s.eventId)?.role === 'melody') ?? snapshot.activeSegments[0];
          const mapping = active && projection.mapping.find(m => m.segmentId === active.segmentId && m.occurrenceId === active.occurrenceId);
          const beat = mapping && layout.beats.find(b => b.nativeBeatId === mapping.nativeBeatId && b.occurrenceId === active?.occurrenceId);
          cursor.hidden = !beat;
          if (beat) {
            Object.assign(cursor.style, { left: `${beat.cursorX}px`, top: `${beat.bounds.y}px`, width: `${Math.max(8, beat.bounds.w)}px`, height: `${beat.bounds.h}px` });
            const jumped = Math.abs(snapshot.positionQuarter - lastQuarter) > .5;
            if (follow && (snapshot.state === 'playing' || jumped)) {
              const top = beat.bounds.y * zoom, left = beat.cursorX * zoom;
              if (top < container.scrollTop + 20 || top + beat.bounds.h * zoom > container.scrollTop + container.clientHeight - 30) container.scrollTop = Math.max(0, top - 55);
              if (left < container.scrollLeft + 20 || left + beat.bounds.w * zoom > container.scrollLeft + container.clientWidth - 30) container.scrollLeft = Math.max(0, left - 80);
            }
          }
          lastQuarter = snapshot.positionQuarter;
        });
        return {
          play: () => audio!.play(), pause: () => audio!.pause(), stop: () => audio!.stop(),
          seek: index => audio!.seek(number(score.occurrences[index]!.start)),
          setTempo: scale => audio!.setTempoScale(scale),
          setMuted: muted => { for (const role of ['melody', 'bass', 'harmony'] as const) audio!.setMuted(role, muted.includes(role)); },
          setSolo: solo => { for (const role of ['melody', 'bass', 'harmony'] as const) audio!.setSolo(role, solo.includes(role)); },
          setFollow: enabled => { follow = enabled; }, setZoom: scale => { zoom = scale; size(); },
          setLoop: range => audio!.setLoop(range ? { startQuarter: number(score.occurrences[range.from]!.start), endQuarter: number(score.occurrences[range.to]!.start) + number(score.occurrences[range.to]!.length) } : null),
          dispose() { abort.abort(); unsubscribe(); void audio!.dispose(); surface.remove(); document.fonts.delete(font); },
        };
      } catch (error) {
        abort.abort(); unsubscribe(); void audio?.dispose(); surface.remove(); document.fonts.delete(font); throw error;
      }
    },
  };
}

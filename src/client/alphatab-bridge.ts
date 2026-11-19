import { AdapterProjectionSchema } from '../domain';
import type { AdapterProjection, ScoreV1 } from '../domain';
import { DEFAULT_PREVIEW_LAYOUT } from './browser-port';
import type { BrowserViewerAdapter, Role } from './browser-port';
import type { NotationOptions } from '../adapters/alpha-tab';

type Bounds = { x: number; y: number; w: number; h: number };
type Layout = { width: number; height: number; fragments: { x: number; y: number; width: number; height: number; svg: string }[]; beats: { nativeBeatId: string; occurrenceId: string; bounds: Bounds; cursorX: number }[] };
type AudioSnapshot = {
  state: string; positionQuarter: number; positionSeconds: number; durationSeconds: number;
  occurrenceId: string | null; error: string | null; activePerformedSoundIds: string[];
  activeSegments: { eventId: string; segmentId: string; occurrenceId: string }[];
};
export type AlphaTabFactories = {
  fontUrl: string;
  createAlphaTabScore: (score: ScoreV1, options: NotationOptions) => { projection: AdapterProjection; renderSvg(width: number, signal?: AbortSignal): Promise<Layout> };
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
        let display: NotationOptions = { fretMode: 'relative', ...DEFAULT_PREVIEW_LAYOUT, showFingerNumbers: false, showMeasureLabels: false, staves: 'both' };
        let requestedDisplay = display;
        const notation = factories.createAlphaTabScore(score, { title, ...display });
        const checkedProjection = (input: AdapterProjection) => {
          const projection = AdapterProjectionSchema.parse(input);
          if (projection.scoreRevision.id !== score.revision.id || projection.scoreRevision.digest !== score.revision.digest) throw new Error('The engraving belongs to another revision.');
          return projection;
        };
        const width = Math.max(790, container.clientWidth - 32);
        let rendered = { projection: checkedProjection(notation.projection), layout: await notation.renderSvg(width, abort.signal) };
        const content = document.createElement('div'); content.className = 'native-content';
        surface.append(content);
        let zoom = 1, follow = true, lastQuarter = 0;
        let latestSnapshot: AudioSnapshot | null = null;
        const size = () => {
          const { layout } = rendered;
          surface.style.width = `${layout.width * zoom}px`; surface.style.height = `${layout.height * zoom}px`;
          content.style.width = `${layout.width}px`; content.style.height = `${layout.height}px`;
          content.style.transform = `scale(${zoom})`;
        };
        const cursor = document.createElement('div'); cursor.className = 'native-cursor'; cursor.hidden = true;
        const installLayout = (next: typeof rendered) => {
          const projection = checkedProjection(next.projection), layout = next.layout;
          const children = document.createDocumentFragment();
          for (const fragment of layout.fragments) {
            const node = document.createElement('div'); node.className = 'native-fragment';
            Object.assign(node.style, { left: `${fragment.x}px`, top: `${fragment.y}px`, width: `${fragment.width}px`, height: `${fragment.height}px` });
            const svg = new DOMParser().parseFromString(fragment.svg, 'image/svg+xml');
            if (svg.querySelector('parsererror,script,foreignObject,iframe,image') || [...svg.querySelectorAll('*')].some(e => [...e.attributes].some(a => /^on/i.test(a.name) || (/(?:href|src)$/i.test(a.name) && !a.value.startsWith('#')) || (a.name === 'style' && /(?:url\(|javascript:|data:)/i.test(a.value))))) throw new Error('Unsafe content in score rendering.');
            node.append(svg.documentElement); children.append(node);
          }
          const printedOnsets = new Map<string, Layout['beats']>();
          for (const beat of layout.beats) {
            const key = `${beat.bounds.y}:${beat.cursorX}`, onset = printedOnsets.get(key);
            if (onset) onset.push(beat);
            else printedOnsets.set(key, [beat]);
          }
          const onsets = [...printedOnsets.values()].sort((a, b) => a[0]!.bounds.y - b[0]!.bounds.y || a[0]!.cursorX - b[0]!.cursorX);
          for (const [index, onset] of onsets.entries()) {
            const beat = onset[0]!, nativeBeatIds = new Set(onset.map(b => b.nativeBeatId));
            const mappings = projection.mapping.filter(m => nativeBeatIds.has(m.nativeBeatId) && m.nativeNoteId !== null);
            const mapping = mappings.find(m => score.sounds.find(s => s.id === m.eventId)?.role === 'melody') ?? mappings[0];
            if (!mapping) continue;
            const sound = score.sounds.find(s => s.id === mapping.eventId)!;
            const target = document.createElement('button'); target.className = 'native-note-target';
            const occurrenceIds = [...new Set(mappings.map(m => m.occurrenceId))];
            target.setAttribute('aria-label', `Inspect ${sound.role} ${sound.spelling.step}${sound.spelling.octave}, ${occurrenceIds.join(', ')}`);
            target.dataset.soundId = sound.id; target.dataset.occurrenceId = mapping.occurrenceId;
            target.dataset.occurrenceIds = occurrenceIds.join(' ');
            const previous = onsets[index - 1]?.[0], next = onsets[index + 1]?.[0];
            const left = previous?.bounds.y === beat.bounds.y ? (previous.cursorX + beat.cursorX) / 2 : Math.min(...onset.map(b => b.bounds.x));
            const right = next?.bounds.y === beat.bounds.y ? (beat.cursorX + next.cursorX) / 2 : Math.max(beat.cursorX + 10, ...onset.map(b => b.bounds.x + b.bounds.w));
            Object.assign(target.style, { left: `${left}px`, top: `${beat.bounds.y}px`, width: `${right - left}px`, height: `${Math.max(24, ...onset.map(b => b.bounds.h))}px` });
            target.addEventListener('click', () => {
              const current = score.occurrences.find(o => o.id === latestSnapshot?.occurrenceId);
              const occurrenceId = occurrenceIds.find(id => id === current?.id)
                ?? occurrenceIds.find(id => score.occurrences.find(o => o.id === id)!.pass === current?.pass)
                ?? occurrenceIds[0]!;
              const selected = mappings.find(m => m.eventId === mapping.eventId && m.occurrenceId === occurrenceId)!;
              target.dataset.occurrenceId = occurrenceId;
              onSelect(selected.eventId, occurrenceId);
              const occurrence = score.occurrences.find(o => o.id === occurrenceId)!;
              const written = score.bars.find(b => b.id === occurrence.writtenBarId)!;
              const segment = score.notation.find(s => s.id === selected.segmentId)!;
              audio!.seek(number(occurrence.start) + number(segment.start) - number(written.start));
            });
            children.append(target);
          }
          children.append(cursor); content.replaceChildren(children);
          rendered = { projection, layout }; size();
        };
        installLayout(rendered);
        audio = factories.createPlaybackController(score);
        container.replaceChildren(surface);
        const updateCursor = (snapshot: AudioSnapshot) => {
          const { projection, layout } = rendered;
          latestSnapshot = snapshot;
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
        };
        unsubscribe = audio.subscribe(updateCursor);
        let renderVersion = 0;
        const renderDisplay = async (options: typeof display) => {
          const version = ++renderVersion;
          requestedDisplay = options;
          let notation: ReturnType<AlphaTabFactories['createAlphaTabScore']>, next: Layout;
          try {
            notation = factories.createAlphaTabScore(score, { title, ...options });
            next = await notation.renderSvg(width, abort.signal);
          } catch (error) {
            if (version === renderVersion) requestedDisplay = display;
            throw error;
          }
          if (abort.signal.aborted || version !== renderVersion) return;
          const { projection, layout } = rendered;
          const top = container.scrollTop, left = container.scrollLeft;
          const anchor = layout.beats.find(b => (b.bounds.y + b.bounds.h) * zoom > top);
          const anchorMapping = anchor && projection.mapping.find(m => m.nativeBeatId === anchor.nativeBeatId && m.occurrenceId === anchor.occurrenceId);
          const offset = anchor ? top - anchor.bounds.y * zoom : 0;
          installLayout({ projection: notation.projection, layout: next });
          display = options;
          if (latestSnapshot) updateCursor(latestSnapshot);
          if (latestSnapshot?.state !== 'playing' || !follow) {
            const mapping = anchorMapping && rendered.projection.mapping.find(m => m.segmentId === anchorMapping.segmentId && m.occurrenceId === anchorMapping.occurrenceId);
            const beat = mapping && next.beats.find(b => b.nativeBeatId === mapping.nativeBeatId && b.occurrenceId === mapping.occurrenceId);
            container.scrollTop = beat ? beat.bounds.y * zoom + offset : top;
          }
          container.scrollLeft = left;
        };
        return {
          play: () => audio!.play(), pause: () => audio!.pause(), stop: () => audio!.stop(),
          seek: index => audio!.seek(number(score.occurrences[index]!.start)),
          setTempo: scale => audio!.setTempoScale(scale),
          setMuted: muted => { for (const role of ['melody', 'bass', 'harmony'] as const) audio!.setMuted(role, muted.includes(role)); },
          setSolo: solo => { for (const role of ['melody', 'bass', 'harmony'] as const) audio!.setSolo(role, solo.includes(role)); },
          setFollow: enabled => { follow = enabled; },
          setZoom: scale => {
            const top = container.scrollTop / zoom, left = container.scrollLeft / zoom;
            zoom = scale; size(); container.scrollTop = top * zoom; container.scrollLeft = left * zoom;
            if (latestSnapshot) updateCursor(latestSnapshot);
          },
          setFretMode: fretMode => renderDisplay({ ...requestedDisplay, fretMode }),
          setLayout: options => renderDisplay({ ...requestedDisplay, ...options }),
          setFingerNumbers: showFingerNumbers => renderDisplay({ ...requestedDisplay, showFingerNumbers }),
          setMeasureLabels: showMeasureLabels => renderDisplay({ ...requestedDisplay, showMeasureLabels }),
          setStaves: staves => renderDisplay({ ...requestedDisplay, staves }),
          setLyrics: lyrics => {
            if (requestedDisplay.lyrics === lyrics) return Promise.resolve();
            const { lyrics: _previous, ...options } = requestedDisplay;
            return renderDisplay(lyrics ? { ...options, lyrics } : options);
          },
          setLoop: range => audio!.setLoop(range ? { startQuarter: number(score.occurrences[range.from]!.start), endQuarter: number(score.occurrences[range.to]!.start) + number(score.occurrences[range.to]!.length) } : null),
          dispose() { abort.abort(); unsubscribe(); void audio!.dispose(); surface.remove(); document.fonts.delete(font); },
        };
      } catch (error) {
        abort.abort(); unsubscribe(); void audio?.dispose(); surface.remove(); document.fonts.delete(font); throw error;
      }
    },
  };
}

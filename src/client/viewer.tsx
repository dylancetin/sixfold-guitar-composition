import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { z } from 'zod';
import { ScoreV1Schema, verifyRevisionDigest } from '../domain';
import type { ScoreV1 } from '../domain';
import { LibraryResponseSchema, PublishedManifestSchema } from '../server/published-schema';
import type { LibraryEntry, PublishedManifest } from '../server/published-schema';
import { DEFAULT_PREVIEW_LAYOUT, loadViewerAdapter } from './browser-port';
import type { FretMode, PlaybackSnapshot, PreviewLayout, Role, ScoreController } from './browser-port';
import { ArrangementDownloads } from './downloads';
import { pdfLayoutQuery } from '../adapters/pdf-settings';
import { useSourceLyrics } from './lyrics';

const roles: Role[] = ['melody', 'bass', 'harmony'];
const initial: PlaybackSnapshot = { status: 'stopped', quarter: 0, occurrenceIndex: 0, seconds: 0, durationSeconds: 0, activePerformedSoundIds: [] };
const fraction = (q: { n: number; d: number }) => q.d === 1 ? `${q.n}` : `${q.n}/${q.d}`;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const date = (value: string) => new Date(value).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const base = (id: string) => `/arrangements/${encodeURIComponent(id)}`;
async function json<T>(path: string, schema: z.ZodType<T>, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(data);
    throw new Error(error.success ? error.data.error : 'This published arrangement could not be opened.');
  }
  return schema.parse(data);
}
function Mark() {
  return <svg viewBox="0 0 40 44" aria-hidden="true"><path d="M7 3v38m5-38v38m5-38v38m5-38v38m5-38v38m5-38v38" /><circle cx="19.5" cy="22" r="10" /></svg>;
}
function Icon({ name }: { name: 'play' | 'pause' | 'stop' | 'download' | 'loop' | 'back' | 'expand' | 'collapse' }) {
  const paths = { play: 'M8 5l11 7-11 7z', pause: 'M8 5v14M16 5v14', stop: 'M6 6h12v12H6z', download: 'M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5', loop: 'M5 8h13l-4-4m4 4-4 4M19 16H6l4 4m-4-4 4-4', back: 'M19 12H5m6-6-6 6 6 6', expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', collapse: 'M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5' };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function Header() {
  return <header className="masthead"><a className="brand" href="/" aria-label="Sixfold arrangement library"><Mark /><span>sixfold<small>Acoustic arrangements</small></span></a><a className="library-link" href="/">The library</a><span className="header-caption">One guitar. All the music that matters.</span></header>;
}
function ReviewLabel({ manifest }: { manifest: PublishedManifest }) {
  return <span className={`review-label ${manifest.status === 'musically-reviewed' ? 'reviewed' : ''}`}>{manifest.status === 'musically-reviewed' ? 'Musician reviewed' : 'Unreviewed draft'}</span>;
}
function Library() {
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [unavailable, setUnavailable] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    void json('/api/arrangements', LibraryResponseSchema, abort.signal).then(data => { setEntries(data.arrangements); setUnavailable(data.unavailableCount); }).catch(error => { if (!abort.signal.aborted) setError(String(error instanceof Error ? error.message : error)); });
    return () => abort.abort();
  }, []);
  return <main className="library-page" id="library-root" tabIndex={-1}>
    <div className="library-intro"><span className="collection-mark">The listening shelf</span><h1>Arranged for one guitar.</h1><p>Published scores, a little space to listen, and the files to take to your music stand.</p></div>
    {error && <div className="error-message" role="alert">{error}</div>}
    {!entries && !error && <div className="loading-state" role="status">Opening the arrangement library…</div>}
    {entries?.length === 0 && <section className="empty-library"><div className="shelf-strings" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} />)}</div><h2>Your arrangements will live here.</h2><p>Request a song arrangement in this project’s chat. When it’s published, the score, player, PDF and MIDI links will appear here.</p><span>No creation tools or account needed on this site.</span></section>}
    {entries && entries.length > 0 && <section className="library-collection" aria-label="Published arrangements"><div className="collection-heading"><h2>Published arrangements</h2><span>{entries.length} {entries.length === 1 ? 'score' : 'scores'}</span></div>{entries.map((entry, index) => <article className="arrangement-row" key={entry.manifest.id}>
      <span className="shelf-number">{String(index + 1).padStart(2, '0')}</span><div className="arrangement-summary"><div className="row-review"><ReviewLabel manifest={entry.manifest} /><span>{date(entry.manifest.createdAt)}</span></div><h3><a href={base(entry.manifest.id)}>{entry.manifest.title}</a></h3><p><span>{entry.summary.difficulty}</span><span>Capo {entry.summary.capo}</span><span>{entry.summary.performedMeasures} performed measures</span></p><a className="open-score" href={base(entry.manifest.id)}>Open score & player <span aria-hidden="true">↗</span></a></div><div className="library-downloads"><a href={`${base(entry.manifest.id)}/arrangement.pdf`} download><Icon name="download" />PDF</a><a href={`${base(entry.manifest.id)}/arrangement.mid`} download><Icon name="download" />MIDI</a></div>
    </article>)}</section>}
    {unavailable > 0 && <p className="unavailable-note">{unavailable} incomplete or invalid {unavailable === 1 ? 'publication is' : 'publications are'} hidden. Ask in project chat for a corrected link.</p>}
    <footer className="library-footer"><span>Made in project chat. Kept here for playing.</span><span>Standard tuning, sounding pitches preserved.</span></footer>
  </main>;
}

type Publication = { manifest: PublishedManifest; score: ScoreV1; notes: string };
function Arrangement({ id }: { id: string }) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    const abort = new AbortController(); setPublication(null); setLoadError('');
    void (async () => {
      const [manifest, score, notesResponse] = await Promise.all([
        json(`${base(id)}/manifest.json`, PublishedManifestSchema, abort.signal),
        json(`${base(id)}/score.json`, ScoreV1Schema, abort.signal),
        fetch(`${base(id)}/notes.md`, { signal: abort.signal }),
      ]);
      if (!notesResponse.ok) throw new Error('The published arrangement notes could not be read.');
      if (manifest.id !== id || manifest.revision.id !== score.revision.id || manifest.revision.digest !== score.revision.digest) throw new Error('The published score does not match its manifest. No replacement score is shown.');
      if (globalThis.crypto?.subtle && !await verifyRevisionDigest(score)) throw new Error('The published score digest is invalid.');
      const notes = await notesResponse.text();
      if (!abort.signal.aborted) setPublication({ manifest, score, notes });
    })().catch(error => { if (!abort.signal.aborted) setLoadError(error instanceof Error ? error.message : 'This arrangement could not be opened.'); });
    return () => abort.abort();
  }, [id]);
  if (loadError) return <main className="viewer-error"><a className="back-link" href="/"><Icon name="back" />All arrangements</a><h1>This score couldn’t be opened.</h1><p role="alert">{loadError}</p><p>Check the published link from project chat. Your library has not changed.</p></main>;
  if (!publication) return <main className="loading-state" role="status">Opening the published score…</main>;
  return <PublishedScore key={publication.manifest.revision.digest} publication={publication} />;
}

function PublishedScore({ publication: { manifest, score, notes } }: { publication: Publication }) {
  const panel = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const controller = useRef<ScoreController | null>(null);
  const [ready, setReady] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [audioError, setAudioError] = useState('');
  const [snapshot, setSnapshot] = useState(initial);
  const [muted, setMuted] = useState<Role[]>([]);
  const [solo, setSolo] = useState<Role[]>([]);
  const [tempo, setTempo] = useState(score.preferences.tempoScale);
  const [loop, setLoop] = useState(false);
  const [loopFrom, setLoopFrom] = useState(0);
  const [loopTo, setLoopTo] = useState(score.occurrences.length - 1);
  const [follow, setFollow] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState<PreviewLayout>(DEFAULT_PREVIEW_LAYOUT);
  const [fretMode, setFretMode] = useState<FretMode>('relative');
  const [showFingerNumbers, setShowFingerNumbers] = useState(false);
  const [showMeasureLabels, setShowMeasureLabels] = useState(false);
  const [tabOnly, setTabOnly] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);
  const lyrics = useSourceLyrics(manifest.id, score);
  const [changingDisplay, setChangingDisplay] = useState(false);
  const [displayError, setDisplayError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const isFullscreen = fullscreen || expanded;
  const focusFullscreenButton = () => panel.current?.querySelector<HTMLButtonElement>('.fullscreen-button:not([hidden])')?.focus();
  const [selected, setSelected] = useState<{ id: string; occurrenceId: string } | null>(null);
  useEffect(() => { document.title = `${manifest.title} — Sixfold`; return () => { document.title = 'Sixfold — Acoustic arrangements'; }; }, [manifest.title]);
  useEffect(() => {
    let disposed = false;
    void loadViewerAdapter().then(adapter => adapter.mount({ container: viewport.current!, score, title: manifest.title, onCursor: next => { if (!disposed) setSnapshot(next); }, onSelect: (id, occurrenceId) => setSelected({ id, occurrenceId }), onError: setAudioError })).then(next => {
      if (disposed) next.dispose(); else { controller.current = next; setReady(true); }
    }).catch(error => { if (!disposed) setRenderError(error instanceof Error ? error.message : 'The score renderer could not be loaded.'); });
    return () => { disposed = true; controller.current?.dispose(); controller.current = null; };
  }, [score, manifest.title]);
  useEffect(() => controller.current?.setMuted(muted), [muted, ready]);
  useEffect(() => controller.current?.setSolo(solo), [solo, ready]);
  useEffect(() => controller.current?.setTempo(tempo), [tempo, ready]);
  useEffect(() => controller.current?.setFollow(follow), [follow, ready]);
  useEffect(() => controller.current?.setZoom(zoom), [zoom, ready]);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    void controller.current?.setLyrics(showLyrics && lyrics.status === 'ready' && lyrics.lyrics.syllables.length ? lyrics.lyrics : undefined).catch(() => {
      if (!disposed) setDisplayError('Lyrics could not be laid out. The score and playback remain available.');
    });
    return () => { disposed = true; };
  }, [lyrics, showLyrics, ready]);
  useEffect(() => {
    const changed = () => { setFullscreen(document.fullscreenElement === panel.current); };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); focusFullscreenButton(); };
  }, [expanded]);
  useEffect(() => { try { controller.current?.setLoop(loop ? { from: loopFrom, to: loopTo } : null); } catch { setAudioError('This loop is too short to play. Choose a wider measure range.'); setLoop(false); } }, [loop, loopFrom, loopTo, ready]);
  const sound = score.sounds.find(s => s.id === selected?.id);
  const performed = score.performedSounds.find(p => p.soundId === selected?.id && p.occurrenceIds.includes(selected.occurrenceId));
  const relativePlacement = score.placements.find(p => p.id === performed?.placementId);
  const placement = relativePlacement && { ...relativePlacement, fret: relativePlacement.fret + (fretMode === 'absolute' ? score.instrument.capo : 0) };
  const currentOccurrence = score.occurrences[snapshot.occurrenceIndex]!;
  const currentBar = score.bars.find(b => b.id === currentOccurrence.writtenBarId)!;
  const activeRoleCounts = roles.map(role => ({ role, count: score.performedSounds.filter(p => score.sounds.find(s => s.id === p.soundId)?.role === role).length }));
  const label = (index: number) => { const occurrence = score.occurrences[index]!; return `${score.bars.find(b => b.id === occurrence.writtenBarId)!.number} / pass ${occurrence.pass}`; };
  const play = () => {
    setAudioError('');
    if (snapshot.status === 'playing') controller.current?.pause();
    else void controller.current?.play().catch(error => setAudioError(error instanceof Error ? error.message : 'Allow browser audio and press Play again.'));
  };
  const changeFrets = async (mode: FretMode) => {
    if (!controller.current) return;
    setChangingDisplay(true); setDisplayError('');
    try { await controller.current.setFretMode(mode); setFretMode(mode); }
    catch { setDisplayError('The TAB display could not be changed. Please try again.'); }
    finally { setChangingDisplay(false); }
  };
  const changeLayout = async (next: PreviewLayout) => {
    if (!controller.current) return;
    setChangingDisplay(true); setDisplayError('');
    try { await controller.current.setLayout(next); setLayout(next); }
    catch { setDisplayError('The preview layout could not be changed. Please try again.'); }
    finally { setChangingDisplay(false); }
  };
  const changeFingerNumbers = async (enabled: boolean) => {
    if (!controller.current) return;
    setChangingDisplay(true); setDisplayError('');
    try { await controller.current.setFingerNumbers(enabled); setShowFingerNumbers(enabled); }
    catch { setDisplayError('Finger numbers could not be changed. Please try again.'); }
    finally { setChangingDisplay(false); }
  };
  const changeMeasureLabels = async (enabled: boolean) => {
    if (!controller.current) return;
    setChangingDisplay(true); setDisplayError('');
    try { await controller.current.setMeasureLabels(enabled); setShowMeasureLabels(enabled); }
    catch { setDisplayError('Measure details could not be changed. Please try again.'); }
    finally { setChangingDisplay(false); }
  };
  const changeTabOnly = async (enabled: boolean) => {
    if (!controller.current) return;
    setChangingDisplay(true); setDisplayError('');
    try { await controller.current.setTabOnly(enabled); setTabOnly(enabled); }
    catch { setDisplayError('The notation display could not be changed. Please try again.'); }
    finally { setChangingDisplay(false); }
  };
  const toggleFullscreen = async () => {
    if (expanded) { setExpanded(false); return; }
    if (document.fullscreenElement === panel.current) {
      try { await document.exitFullscreen(); focusFullscreenButton(); }
      catch { setDisplayError('Use Escape to exit fullscreen.'); }
      return;
    }
    try {
      if (!panel.current?.requestFullscreen || !document.fullscreenEnabled) { setExpanded(true); return; }
      await panel.current.requestFullscreen();
    } catch { setExpanded(true); }
  };
  return <main className="arrangement-page">
    <a className="back-link" href="/"><Icon name="back" />All arrangements</a>
    <div className="song-heading"><div><div className="song-topline"><span>Solo acoustic guitar</span><ReviewLabel manifest={manifest} /></div><h1>{manifest.title}</h1><p className="song-description">The melody in front. Bass beneath it. Just enough harmony.</p></div><ArrangementDownloads score={score} title={manifest.title} icon={<Icon name="download" />} pdf={{ href: `${base(manifest.id)}/preview.pdf?${pdfLayoutQuery({ ...layout, scale: zoom, fretMode, showFingerNumbers, showMeasureLabels, tabOnly })}`, originalHref: `${base(manifest.id)}/arrangement.pdf`, disabled: !ready || changingDisplay }}><a className="button download-secondary" href={`${base(manifest.id)}/arrangement.mid`} download><Icon name="download" />MIDI</a></ArrangementDownloads></div>
    {!manifest.agent && score.planner.mode === 'deterministic-fallback' && <p className="publication-kind">Deterministic smoke publication. No model-authored arrangement or musician review is claimed.</p>}
    <div className="score-facts"><span className="difficulty">{score.preferences.difficulty}</span><span>Standard tuning <strong>E A D G B e</strong></span><span>{score.instrument.capo ? `Capo ${score.instrument.capo}` : 'No capo'} <small>{fretMode} TAB frets</small></span><span>{score.bars.length} written bars <small>{score.occurrences.length} performed measures</small></span><span>{score.preferences.transposition.mode === 'explicit' ? `Explicit transposition: ${score.preferences.transposition.semitones > 0 ? '+' : ''}${score.preferences.transposition.semitones} st` : 'Original concert pitches preserved'}</span></div>
    <div className="listening-workspace">
      <section ref={panel} className={`score-panel${expanded ? ' score-expanded' : ''}${controlsExpanded ? '' : ' score-controls-minimized'}`} data-spacing={layout.spacing} aria-label="Published score and playback">
        <div className="score-toolbar" id="preview-toolbar" hidden={!controlsExpanded}><span>Guitar <span className="toolbar-divider">/</span> {tabOnly ? 'TAB only' : 'Staff + TAB'}</span><div><label className="fret-control">TAB frets<select aria-label="TAB fret numbering" value={fretMode} disabled={!ready || changingDisplay} onChange={e => void changeFrets(e.target.value as FretMode)}><option value="relative">Relative to capo</option><option value="absolute">Absolute neck frets</option></select></label><label className="follow-control"><input type="checkbox" checked={follow} disabled={!ready} onChange={e => setFollow(e.target.checked)} />Follow score</label><button className="fullscreen-button" hidden={!controlsExpanded} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen preview'} aria-pressed={isFullscreen} onClick={() => void toggleFullscreen()}><Icon name={isFullscreen ? 'collapse' : 'expand'} /><span>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button></div>
          <div className="preview-layout-controls" role="group" aria-label="Preview layout">
            <label>Spacing<select aria-label="Preview spacing" value={layout.spacing} disabled={!ready || changingDisplay} onChange={e => void changeLayout({ ...layout, spacing: e.target.value as PreviewLayout['spacing'] })}><option value="normal">Normal</option><option value="compact">Compact</option><option value="tight">Tight</option></select></label>
            <label>Bars per row<select aria-label="Bars per row" value={layout.barsPerRow} disabled={!ready || changingDisplay} onChange={e => void changeLayout({ ...layout, barsPerRow: Number(e.target.value) })}>{[2, 3, 4].map(count => <option key={count} value={count}>{showLyrics && lyrics.status === 'ready' && lyrics.lyrics.syllables.length ? `Up to ${count}` : count}</option>)}</select></label>
            <label>Size<select aria-label="Notation size" value={zoom} disabled={!ready} onChange={e => setZoom(Number(e.target.value))}>{[.5, .65, .75, .85, 1, 1.25, 1.5].map(scale => <option key={scale} value={scale}>{Math.round(scale * 100)}%</option>)}</select></label>
            <label className="finger-control" title="Hide the standard-notation staff and show tablature with rhythm only"><input type="checkbox" role="switch" checked={tabOnly} disabled={!ready || changingDisplay} onChange={e => void changeTabOnly(e.target.checked)} />TAB only</label>
            <label className="finger-control" title={tabOnly ? 'Finger numbers are drawn beside staff notes. Turn off TAB only to see them.' : undefined}><input type="checkbox" role="switch" aria-describedby="finger-number-key" checked={showFingerNumbers && !tabOnly} disabled={!ready || changingDisplay || tabOnly} onChange={e => void changeFingerNumbers(e.target.checked)} />Finger numbers</label>
            <label className="finger-control" title="Show source-bar labels, plus occurrence and pass details in unfolded scores"><input type="checkbox" role="switch" checked={showMeasureLabels} disabled={!ready || changingDisplay} onChange={e => void changeMeasureLabels(e.target.checked)} />Measure details</label>
            <span className="preview-only-note">PDF uses this layout, without lyrics. MIDI &amp; MP3 unchanged.</span>
            <span id="finger-number-key" className={showFingerNumbers && !tabOnly ? 'finger-legend' : 'sr-only'}>Left hand: 0 open, 1 index, 2 middle, 3 ring, 4 little. Shown beside staff notes.</span>
          </div>
        </div>
        <div className="score-surface-shell" id="preview-lyrics"><div className="score-viewport" ref={viewport} aria-label={tabOnly ? 'Scrollable tablature' : 'Scrollable staff and tablature'} tabIndex={0} />{!ready && <div className={`score-loading ${renderError ? 'failed' : ''}`} role={renderError ? 'alert' : 'status'}><span className="paper-clef" aria-hidden="true">{'\uE050'}</span><p>{renderError || 'Laying out the published score…'}</p><small>{renderError ? 'PDF, MIDI and arrangement notes remain available below.' : 'Repeat notation where passes match. Playback follows every pass.'}</small></div>}</div>
        <div className="transport" id="transport"><div className="primary-transport"><button className="play-button" aria-label={snapshot.status === 'playing' ? 'Pause playback' : 'Play arrangement'} disabled={!ready} onClick={play}><Icon name={snapshot.status === 'playing' ? 'pause' : 'play'} /></button><button className="stop-button" id="preview-stop" hidden={!controlsExpanded} aria-label="Stop playback" disabled={!ready} onClick={() => controller.current?.stop()}><Icon name="stop" /></button><span className="time-readout">{clock(snapshot.seconds)}<small> / {clock(snapshot.durationSeconds)}</small></span><label className="finger-control lyrics-control" title="Show source lyrics in the preview only"><input type="checkbox" role="switch" aria-controls="preview-lyrics" aria-describedby="lyrics-preview-note" checked={showLyrics} onChange={e => setShowLyrics(e.target.checked)} />Lyrics</label><label className="practice-tempo" id="preview-tempo" hidden={!controlsExpanded}>Practice tempo<select aria-label="Practice tempo" disabled={!ready} value={tempo} onChange={e => setTempo(Number(e.target.value))}>{[...new Set([.5, .75, 1, 1.25, score.preferences.tempoScale])].sort((a, b) => a - b).map(scale => <option key={scale} value={scale}>{Math.round(scale * 100)}%</option>)}</select></label><div className="preview-chrome-actions"><button className="preview-controls-toggle" aria-label={controlsExpanded ? 'Minimize preview controls' : 'Restore preview controls'} aria-expanded={controlsExpanded} aria-controls="preview-toolbar preview-stop preview-tempo preview-seek preview-loop" onClick={() => setControlsExpanded(value => !value)}>{controlsExpanded ? 'Minimize' : 'Restore controls'}</button><button className="fullscreen-button" hidden={controlsExpanded} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen preview'} aria-pressed={isFullscreen} onClick={() => void toggleFullscreen()}><Icon name={isFullscreen ? 'collapse' : 'expand'} /><span>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button></div></div>
          <div className="seek-row" id="preview-seek" hidden={!controlsExpanded}><label htmlFor="measure-seek">Measure <strong>{currentBar.number}</strong> <span>/ pass {currentOccurrence.pass}</span></label><input id="measure-seek" aria-label="Seek performed measure" type="range" min="0" max={score.occurrences.length - 1} step="1" disabled={!ready} value={snapshot.occurrenceIndex} onChange={e => controller.current?.seek(Number(e.target.value))} /><select aria-label="Jump to measure" disabled={!ready} value={snapshot.occurrenceIndex} onChange={e => controller.current?.seek(Number(e.target.value))}>{score.occurrences.map((o, i) => <option key={o.id} value={i}>{label(i)}</option>)}</select></div>
          <div className="loop-row" id="preview-loop" hidden={!controlsExpanded}><button className={`loop-button ${loop ? 'enabled' : ''}`} disabled={!ready} aria-pressed={loop} onClick={() => setLoop(!loop)}><Icon name="loop" />Loop measures</button><select aria-label="Loop first measure" value={loopFrom} disabled={!ready} onChange={e => { const from = Number(e.target.value); setLoopFrom(from); if (from > loopTo) setLoopTo(from); }}>{score.occurrences.map((o, i) => <option key={o.id} value={i}>{label(i)}</option>)}</select><span>to</span><select aria-label="Loop last measure" value={loopTo} disabled={!ready} onChange={e => { const to = Number(e.target.value); setLoopTo(to); if (to < loopFrom) setLoopFrom(to); }}>{score.occurrences.map((o, i) => <option key={o.id} value={i}>{label(i)}</option>)}</select><span className="audio-tone">Synthetic plucked audio</span></div>
          {audioError && <p className="audio-error" role="alert">{audioError}</p>}
          {displayError && <p className="audio-error" role="alert">{displayError}</p>}
        </div>
        <p id="lyrics-preview-note" className="sr-only" role="status">{lyrics.status === 'loading' ? 'Loading synchronized lyrics.' : lyrics.status === 'unavailable' ? 'Verified lyrics unavailable. Score playback is unaffected.' : lyrics.lyrics.syllables.length ? 'Lyrics aligned beneath the melody notation. Preview only, not included in downloads.' : 'No supported lyrics for the selected melody. Score playback is unaffected.'}</p>
      </section>
      <aside className="listening-sidebar">
        <section className="voice-mixer"><h2>Hear the parts</h2><p>Listen together, or make room for one voice.</p>{activeRoleCounts.map(({ role, count }) => <div className={`mixer-row ${role}`} key={role}><div><span className="voice-dot" /><strong>{role}</strong><small>{count} attacks</small></div><div className="mixer-buttons"><button aria-label={`Mute ${role}`} aria-pressed={muted.includes(role)} disabled={!ready || !count} onClick={() => setMuted(muted.includes(role) ? muted.filter(r => r !== role) : [...muted, role])}>M</button><button aria-label={`Solo ${role}`} aria-pressed={solo.includes(role)} disabled={!ready || !count} onClick={() => setSolo(solo.includes(role) ? solo.filter(r => r !== role) : [...solo, role])}>S</button></div></div>)}<span className="mixer-key">M = mute &nbsp; S = solo. Mute takes priority.</span></section>
        <section className="note-inspector"><h2>{sound ? 'Inside this note' : 'A closer listen'}</h2><label className="note-picker">Inspect a written note<select aria-label="Inspect a written note" value={selected?.id ?? ''} onChange={e => { const performed = score.performedSounds.find(p => p.soundId === e.target.value); setSelected(performed ? { id: performed.soundId, occurrenceId: performed.attackOccurrenceId } : null); }}><option value="">Choose a note, or click the score</option>{score.sounds.map(s => <option key={s.id} value={s.id}>{s.spelling.step}{s.spelling.alter === 1 ? '♯' : s.spelling.alter === -1 ? '♭' : ''}{s.spelling.octave} / {s.role} / {fraction(s.start)} q</option>)}</select></label>{sound && placement ? <><div className={`selected-pitch ${sound.role}`}>{sound.spelling.step}{sound.spelling.alter === 1 ? '♯' : sound.spelling.alter === -1 ? '♭' : ''}<span>{sound.spelling.octave}</span><small>{sound.role}</small></div><dl><dt>Sounding pitch</dt><dd>MIDI {sound.soundingMidi}</dd><dt>Written onset</dt><dd>{fraction(sound.start)} q</dd><dt>Held duration</dt><dd>{fraction(sound.duration)} q</dd><dt>String / fret</dt><dd>{6 - placement.stringIndex} / {placement.fret}</dd><dt>Finger</dt><dd>{placement.finger === 0 ? 'Open' : placement.finger}</dd><dt>Performance</dt><dd>{selected?.occurrenceId}</dd></dl><p className="source-note-id">Source: {sound.provenance.kind === 'source' ? sound.provenance.eventIds.join(', ') : sound.provenance.evidenceEventIds.join(', ')}</p></> : <p className="inspector-invitation">{tabOnly ? 'Click a TAB beat' : 'Click a staff note or TAB beat'} for sounding pitch, fingering and source identity. Nothing here edits the arrangement.</p>}</section>
        <section className="guitar-note"><h2>A note for the guitar</h2><p>{score.instrument.capo ? `Capo ${score.instrument.capo} preserves the sounding melody. ${fretMode === 'relative' ? 'TAB fret 0 is an open string above the capo.' : `TAB numbers count from the nut; fret ${score.instrument.capo} is an open string at the capo.`}` : 'No capo. Relative and absolute TAB numbers are the same; fret 0 is an open string.'}</p><p>PDF uses the preview spacing, bars per row, size, TAB numbering, TAB-only view, finger numbers and measure details. Lyrics appear only in the preview, not in downloads. Tempo appears at the start and when it changes. Every download includes the full arrangement; practice tempo, loops and muting do not change the files.</p></section>
      </aside>
    </div>
    <section className="arrangement-notes"><div className="notes-heading"><span>From the arrangement desk</span><h2>Notes for playing.</h2><p>{manifest.agent ? `Published from project chat / ${manifest.agent.model}` : 'Published arrangement rationale'}</p></div><div className="markdown-notes"><ReactMarkdown skipHtml components={{ a: ({ href, children }) => <a href={href?.startsWith('https://') ? href : undefined} rel="noreferrer" target="_blank">{children}</a>, img: ({ alt }) => <span>{alt}</span> }}>{notes}</ReactMarkdown></div></section>
    <section className="publication-details"><details><summary>Source, revision & arrangement changes</summary><div className="provenance-grid"><div><h3>Source & identity</h3><p><a href={manifest.sourceUrl} rel="noreferrer" target="_blank">Open the original song source</a></p><p>Published {date(manifest.createdAt)}. Status: {manifest.status}.</p><p>Revision <code>{manifest.revision.id}</code></p><p>Digest <code>{manifest.revision.digest}</code></p>{manifest.agent && <p>Agent task <code>{manifest.agent.taskId}</code></p>}</div><div><h3>What changed for the guitar</h3><p>{score.capoComparison.reason}</p><p>Key: {score.key.status === 'unknown' ? `not asserted — ${score.key.reason}` : `${score.key.mode}, ${score.key.certainty}`}</p><p>Ability profile {score.ability.id} / {score.ability.version}: {score.ability.calibration}. Software checks are not a human playability certification.</p><p>Core planning: {score.planner.mode === 'configured-llm' ? `${score.planner.provider} / ${score.planner.model}` : `deterministic fallback — ${score.planner.detail}`}</p></div></div><div className="change-list">{score.changes.length ? <details><summary>{score.changes.length} disclosed register moves, shortened sustains or omissions</summary><ul>{score.changes.map(change => <li key={change.id}><strong>{change.role} / {change.kind.replaceAll('-', ' ')}</strong> {change.reason} <small>Source: {change.sourceEventIds.join(', ')}</small></li>)}</ul></details> : <p>No register moves, omissions or shortened sustains are recorded.</p>}</div></details></section>
    <footer className="viewer-footer"><span>sixfold / acoustic arrangements</span><span>Requests and revisions belong in project chat.</span></footer>
  </main>;
}

export function App() {
  const match = /^\/arrangements\/([a-z0-9][a-z0-9_-]{0,159})\/?$/.exec(location.pathname);
  return <><a className="skip-link" href={match ? '#transport' : '#library-root'}>{match ? 'Skip to playback' : 'Skip to arrangements'}</a><Header />{match ? <Arrangement id={match[1]!} /> : <Library />}</>;
}

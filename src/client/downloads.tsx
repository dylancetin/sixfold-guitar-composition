import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ScoreV1 } from '../domain';

export function ArrangementDownloads({ score, title, children, icon }: { score: ScoreV1; title: string; children: ReactNode; icon: ReactNode }) {
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const filename = `${title.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 100) || 'arrangement'}-preview.mp3`;
  useEffect(() => () => { request.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  const download = async () => {
    if (request.current) return;
    const abort = new AbortController(); request.current = abort;
    setBusy(true); setError(''); setStatus('Rendering audio…');
    try {
      const { createPreviewMp3 } = await import('./mp3-download');
      abort.signal.throwIfAborted();
      const blob = await createPreviewMp3(score, abort.signal, setStatus);
      abort.signal.throwIfAborted();
      objectUrl.current = URL.createObjectURL(blob); setUrl(objectUrl.current);
      setStatus('MP3 ready. Use Download MP3 to save another copy.');
      const link = document.createElement('a'); link.href = objectUrl.current; link.download = filename;
      document.body.append(link); link.click(); link.remove();
    } catch (cause) {
      if (!abort.signal.aborted) { setStatus(''); setError(cause instanceof Error ? cause.message : 'MP3 download failed. Try again, or download MIDI instead.'); }
    } finally {
      if (!abort.signal.aborted) { request.current = null; setBusy(false); }
    }
  };
  return <div className="download-group">
    <div className="download-actions">{children}{url
      ? <a className="button download-secondary" href={url} download={filename}>{icon}Download MP3</a>
      : <button className="button download-secondary" disabled={busy} aria-busy={busy} onClick={() => void download()}>{icon}{busy ? 'Preparing MP3…' : 'Download MP3'}</button>}
    </div>
    <p className="download-note">MP3: synthetic preview, all parts at published tempo.</p>
    <p className="download-status" role="status">{status}</p>
    {error && <p className="download-error" role="alert">{error}</p>}
  </div>;
}

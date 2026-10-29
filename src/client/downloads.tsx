import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ScoreV1 } from '../domain';

export function ArrangementDownloads({ score, title, children, icon, pdf }: { score: ScoreV1; title: string; children: ReactNode; icon: ReactNode; pdf: { href: string; originalHref: string; disabled: boolean } }) {
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const pdfRequest = useRef<AbortController | null>(null);
  const pdfObjectUrl = useRef('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [pdfError, setPdfError] = useState('');
  const safeTitle = title.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 100) || 'arrangement';
  const filename = `${safeTitle}-preview.mp3`;
  useEffect(() => () => { request.current?.abort(); pdfRequest.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); if (pdfObjectUrl.current) URL.revokeObjectURL(pdfObjectUrl.current); }, []);
  const downloadPdf = async () => {
    if (pdfRequest.current) return;
    const abort = new AbortController(); pdfRequest.current = abort;
    setPdfBusy(true); setPdfError(''); setPdfStatus('Preparing PDF with the selected preview layout…');
    try {
      const { fetchPreviewPdf } = await import('./pdf-download');
      const blob = await fetchPreviewPdf(pdf.href, AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]));
      abort.signal.throwIfAborted();
      if (pdfObjectUrl.current) URL.revokeObjectURL(pdfObjectUrl.current);
      pdfObjectUrl.current = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = pdfObjectUrl.current; link.download = `${safeTitle}-preview-layout.pdf`;
      document.body.append(link); link.click(); link.remove();
      setPdfStatus('PDF downloaded with the selected preview layout.');
    } catch (cause) {
      if (!abort.signal.aborted) { setPdfStatus(''); setPdfError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'PDF export timed out. Try again, or use the Original PDF.'); }
    } finally {
      if (!abort.signal.aborted) { pdfRequest.current = null; setPdfBusy(false); }
    }
  };
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
    <div className="download-actions"><button className="button download-primary" disabled={pdf.disabled || pdfBusy} aria-busy={pdfBusy} title="Download PDF using the current preview layout" onClick={() => void downloadPdf()}>{icon}{pdfBusy ? 'Preparing PDF…' : 'PDF score'}</button>{children}{url
      ? <a className="button download-secondary" href={url} download={filename}>{icon}Download MP3</a>
      : <button className="button download-secondary" disabled={busy} aria-busy={busy} onClick={() => void download()}>{icon}{busy ? 'Preparing MP3…' : 'Download MP3'}</button>}
    </div>
    <p className="download-note">PDF follows preview layout. <a href={pdf.originalHref} download>Original PDF</a></p>
    <p className="download-note">MP3: synthetic preview, all parts at published tempo.</p>
    <p className="download-status" role="status">{pdfStatus}</p>
    {pdfError && <p className="download-error" role="alert">{pdfError}</p>}
    <p className="download-status" role="status">{status}</p>
    {error && <p className="download-error" role="alert">{error}</p>}
  </div>;
}

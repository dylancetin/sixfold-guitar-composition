export async function fetchPreviewPdf(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error : 'PDF download failed. Try again, or use the Original PDF.');
  }
  if (response.headers.get('content-type')?.split(';')[0] !== 'application/pdf') throw new Error('The download was not a PDF. Use the Original PDF or try again.');
  const blob = await response.blob();
  if (await blob.slice(0, 5).text() !== '%PDF-') throw new Error('The PDF download was incomplete. Try again, or use the Original PDF.');
  signal.throwIfAborted();
  return blob;
}

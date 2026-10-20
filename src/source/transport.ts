// Page/CDN discovery and bounded streaming adapted from the read-only reference.
// See NOTICE.md for provenance and deliberate security differences.
import type { SourceManifest } from '../domain';
import { fail } from './common';

export const PAGE_HOSTS = ['www.songsterr.com', 'songsterr.com'] as const;
export const CDN_HOST = 'dqsljvtekg760.cloudfront.net';
const MAX_BYTES = 8 * 1024 * 1024;
const TOTAL_BYTES = 32 * 1024 * 1024;
export type ArtifactDescriptor = SourceManifest['artifacts'][number];
export type RawArtifact = { descriptor: ArtifactDescriptor; bytes: Uint8Array };
export type SourceFetch = (url: string, init: RequestInit) => Promise<Response>;
export type ArtifactSink = (artifact: RawArtifact) => Promise<void>;

/** Bounded ephemeral retention; API persistence should supply its own immutable blob sink. */
export class SourceArtifactStore {
  private readonly entries = new Map<string, Uint8Array>();
  private size = 0;
  constructor(private readonly maxBytes = 64 * 1024 * 1024) {}
  async put({ descriptor, bytes }: RawArtifact): Promise<void> {
    if (this.entries.has(descriptor.sha256)) return;
    if (bytes.byteLength > this.maxBytes) fail('Raw artifact exceeds local retention capacity.', 'unavailable');
    while (this.size + bytes.byteLength > this.maxBytes) {
      const first = this.entries.entries().next().value;
      if (!first) break;
      this.entries.delete(first[0]);
      this.size -= first[1].byteLength;
    }
    this.entries.set(descriptor.sha256, bytes.slice());
    this.size += bytes.byteLength;
  }
  get(sha256: string): Uint8Array | undefined { return this.entries.get(sha256)?.slice(); }
}

function allowed(url: URL, hosts: readonly string[]): boolean {
  return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password && !url.port && !url.search && !url.hash;
}

export function parseSongUrl(raw: string): { url: URL; songId: number } {
  if (raw.length > 2048 || /[\\\u0000-\u0020\u007f]/u.test(raw)) fail('Expected a public HTTPS Songsterr song URL.', 'invalid-input', 'invalid-input');
  let url: URL;
  try { url = new URL(raw); } catch { return fail('Malformed Songsterr URL.', 'invalid-input', 'invalid-input'); }
  // Never forward arbitrary queries, credentials, linked track choices, or fragments.
  url.search = '';
  url.hash = '';
  if (!allowed(url, PAGE_HOSTS)) fail('Only public HTTPS songsterr.com song pages without credentials/custom ports are allowed.', 'invalid-input', 'invalid-input');
  const match = /^\/a\/wsa\/[a-z0-9-]+-s([1-9]\d*)(?:t\d+)?\/?$/i.exec(url.pathname);
  const songId = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(songId) || songId > 2_147_483_647) fail('URL must identify one Songsterr song in /a/wsa/...-s<ID>.', 'invalid-input', 'invalid-input');
  return { url, songId };
}

export class Transport {
  private total = 0;
  readonly artifacts: ArtifactDescriptor[] = [];
  constructor(private readonly fetcher: SourceFetch, private readonly sink: ArtifactSink, private readonly signal: AbortSignal) {}

  async text(url: URL, hosts: readonly string[], id: string, mediaType: string): Promise<string> {
    const signal = AbortSignal.any([this.signal, AbortSignal.timeout(15_000)]);
    let current = url;
    for (let redirects = 0; redirects <= 3; redirects++) {
      signal.throwIfAborted();
      if (!allowed(current, hosts)) fail('Source redirect violates the public HTTPS host policy; no destination request made.', 'restricted', 'restricted-source');
      const response = await this.fetcher(current.href, { redirect: 'manual', credentials: 'omit', signal, headers: { Accept: mediaType, 'User-Agent': 'GuitarCompositionSource/1.0' } });
      if (response.url && (!allowed(new URL(response.url), hosts) || response.url !== current.href)) {
        await response.body?.cancel();
        fail('Source transport followed an unexpected redirect.', 'restricted', 'restricted-source');
      }
      if ([401, 403, 407, 429, 451].includes(response.status)) {
        await response.body?.cancel();
        fail(`Source access denied/restricted (HTTP ${response.status}); stopped without retry or alternate host. Supply an authorized structured file.`, 'restricted', 'restricted-source');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) fail('Source redirect has no destination.', 'unavailable');
        try { current = new URL(location, current); } catch { fail('Invalid source redirect.', 'restricted', 'restricted-source'); }
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); fail(`Public source unavailable (HTTP ${response.status}); no substitute score imported.`, 'unavailable'); }
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
      if (contentType && contentType !== mediaType && !(mediaType === 'application/json' && contentType === 'application/octet-stream')) {
        await response.body?.cancel(); fail('Unexpected source content type (possible restriction/interstitial).', 'restricted', 'restricted-source');
      }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); fail('Source exceeds the 8 MiB response bound.', 'unavailable'); }
      if (!response.body) fail('Source returned an empty body.', 'unavailable');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      const abort = () => { void reader.cancel(signal.reason).catch(() => {}); };
      signal.addEventListener('abort', abort, { once: true });
      try {
        while (true) {
          signal.throwIfAborted();
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          this.total += chunk.value.byteLength;
          if (length > MAX_BYTES || this.total > TOTAL_BYTES) { await reader.cancel(); fail('Source exceeds the 8 MiB response / 32 MiB import byte bound.', 'unavailable'); }
          chunks.push(chunk.value);
        }
        signal.throwIfAborted();
      } finally {
        signal.removeEventListener('abort', abort);
        if (signal.aborted) await reader.cancel(signal.reason).catch(() => {});
        reader.releaseLock();
      }
      if (!length) fail('Source returned an empty body.', 'unavailable');
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const descriptor = { id, sha256: [...hash].map((x) => x.toString(16).padStart(2, '0')).join(''), byteLength: length, mediaType };
      await this.sink({ descriptor, bytes: bytes.slice() });
      this.artifacts.push(descriptor);
      try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return fail('Source is not valid UTF-8.'); }
    }
    return fail('Source exceeded the three-redirect bound.', 'unavailable');
  }
}

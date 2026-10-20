import { PublishedFiles, PublicationUnavailable, publishedFiles } from './published-files';
import type { PublishedFilename } from './published-files';

const safeHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const json = (value: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(value, { status, headers: { ...safeHeaders, 'Cache-Control': 'no-store', ...extra } });
const types: Record<PublishedFilename, string> = { 'manifest.json': 'application/json; charset=utf-8', 'score.json': 'application/json; charset=utf-8', 'notes.md': 'text/plain; charset=utf-8', 'arrangement.pdf': 'application/pdf', 'arrangement.mid': 'audio/midi' };
export function createPublishedHandler(options: { arrangementsDirectory: string; frontendDirectory: string }) {
  const publications = new PublishedFiles(options.arrangementsDirectory);
  return async (request: Request): Promise<Response> => {
    const head = request.method === 'HEAD';
    if (request.method !== 'GET' && !head) return json({ error: 'This viewer is read-only. Request arrangements in project chat.' }, 405, { Allow: 'GET, HEAD' });
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/arrangements') {
        const library = await publications.library();
        return head ? new Response(null, { headers: { ...safeHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }) : json(library);
      }
      const match = /^\/arrangements\/([a-z0-9][a-z0-9_-]{0,159})(?:\/([^/]+))?\/?$/.exec(path);
      if (match) {
        const id = match[1]!;
        const filename = match[2];
        if (filename && !publishedFiles.includes(filename as PublishedFilename)) return json({ error: 'Not found' }, 404);
        if (filename) {
          const bundle = await publications.load(id);
          if (!bundle) return json({ error: 'Arrangement not found. Open the library or check the published link from project chat.' }, 404);
          const name = filename as PublishedFilename;
          const download = name === 'arrangement.pdf' || name === 'arrangement.mid';
          return new Response(head ? null : new Uint8Array(bundle.bytes[name]), { headers: {
            ...safeHeaders, 'Content-Type': types[name], 'Content-Length': String(bundle.bytes[name].length),
            'Cache-Control': 'public, max-age=31536000, immutable', ETag: `"${bundle.manifest.revision.digest}-${name}"`,
            ...(download ? { 'Content-Disposition': `attachment; filename="${id}.${name.endsWith('.pdf') ? 'pdf' : 'mid'}"` } : {}),
          } });
        }
      } else if (path !== '/' && !/^\/(assets|integrations)\/[a-zA-Z0-9._/-]+$/.test(path) && path !== '/favicon.svg') return json({ error: 'Not found' }, 404);
      if (path.includes('..') || path.includes('\\')) return json({ error: 'Not found' }, 404);
      const filename = path === '/' || match ? 'index.html' : path.slice(1);
      const file = Bun.file(`${options.frontendDirectory}/${filename}`);
      if (!await file.exists()) return json({ error: 'Viewer assets are not built. Run bun run build:client.' }, 503);
      return new Response(head ? null : file, { headers: { ...safeHeaders, 'Content-Type': filename === 'index.html' ? 'text/html; charset=utf-8' : file.type, 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' } });
    } catch (error) {
      if (error instanceof PublicationUnavailable) return json({ error: 'This published arrangement failed its integrity checks or is incomplete. Ask in project chat for a new published link. No replacement score is shown.' }, 409);
      console.error('Published viewer read failed:', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Published arrangements could not be read. Try the link again later.' }, 503);
    }
  };
}

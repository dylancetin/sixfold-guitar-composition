import { DigestSchema, RevisionSchema } from './schemas';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type RevisionDocument = { [key: string]: Json; revision: { id: string; parentId: string | null; digest: string } };

export function canonicalJson(value: Json): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError('Noncanonical JSON number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!(i in value)) throw new TypeError('Sparse JSON array');
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('Expected plain JSON');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`).join(',')}}`;
}

export async function contentDigest(value: Json): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function revisionDigest(value: RevisionDocument): Promise<string> {
  const { digest: _digest, ...identity } = RevisionSchema.parse(value.revision);
  return contentDigest({ ...value, revision: identity });
}

export async function verifyRevisionDigest(value: Parameters<typeof revisionDigest>[0]): Promise<boolean> {
  DigestSchema.parse(value.revision.digest);
  return value.revision.digest === await revisionDigest(value);
}

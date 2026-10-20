import { compare } from '../domain';
import type { ScoreV1, Sound, Rest } from '../domain';
import { digest } from './identity';

export function ordered<T extends Sound | Rest>(events: T[]): T[] {
  return [...events].sort((a, b) => compare(a.start, b.start) || a.id.localeCompare(b.id));
}
export function scopeDigest(score: ScoreV1, role: Sound['role']): string {
  const sounds = ordered(score.sounds.filter((e) => e.role === role));
  const rests = ordered(score.rests.filter((e) => e.role === role));
  if (role === 'melody') return digest({ sourceRevision: score.source.revision, selection: score.selection, transposition: score.preferences.transposition, sounds, rests });
  const changes = [...score.changes.filter((c) => c.role === role)].sort((a,b) => a.id.localeCompare(b.id));
  if (role === 'bass') return digest({ melodyScopeDigest: scopeDigest(score, 'melody'), sounds, rests, changes });
  return digest({ bassScopeDigest: scopeDigest(score, 'bass'), sounds, rests, changes });
}

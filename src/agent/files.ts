import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
export async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, 'utf8')); }

/** Local-only data stays ignored even before the integrator edits the root .gitignore. */
export async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (!(await lstat(path)).isDirectory() || (await lstat(path)).isSymbolicLink()) throw new Error('Local data root must be a real directory');
  try { await writeFile(join(path, '.gitignore'), '*\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (!hasCode(error, 'EEXIST')) throw error;
    const ignore = join(path, '.gitignore');
    if (!(await lstat(ignore)).isFile() || (await lstat(ignore)).isSymbolicLink() || await readFile(ignore, 'utf8') !== '*\n') throw new Error('Choose a dedicated local data root with its own ignore-all .gitignore; existing files were not changed');
  }
}

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

export async function durableWrite(path: string, bytes: Uint8Array): Promise<void> {
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
}

export async function syncDirectory(path: string): Promise<void> {
  const directory = await open(path, 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}

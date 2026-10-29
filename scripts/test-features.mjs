import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Root tests only. tools/export-proof has its own package/dependency boundary.
// Playwright workflows run separately against an explicitly retained preview.
function tests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : tests(path);
    return /\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
const files = tests('tests').sort();
if (!files.length) throw new Error('No root test files found');
const result = spawnSync('bun', ['test', ...files], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;

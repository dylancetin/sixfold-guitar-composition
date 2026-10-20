import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const required = [
  'package.json', 'bun.lock', 'tsconfig.json',
  'src/domain/index.ts', 'src/domain/rational.ts', 'src/domain/schemas.ts',
  'src/source/index.ts', 'tests/source/source.test.ts', 'tests/source/tsconfig.json',
  'src/engine/index.ts', 'src/engine/form.ts', 'src/engine/arrange.ts', 'src/engine/validator.ts',
  'tests/engine/form.test.ts', 'tests/engine/arrange.test.ts', 'tests/engine/validator.test.ts', 'tests/engine/live.test.ts',
  'tests/fixtures/foundation.test.ts', 'tests/fixtures/oracles.test.ts',
  'docs/CONTRACT.md',
];
const missing = required.filter((path) => !existsSync(`${root}/${path}`));
const report = {
  scope: 'U03 foundation, U04 source and U05/U07/U08/U09 engine checks; not product acceptance',
  checkedAt: new Date().toISOString(),
  status: missing.length ? 'absent' : 'ready',
  missing,
  checks: [],
};

if (!missing.length) {
  const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));
  for (const script of ['typecheck', 'check:source', 'test', 'test:controls', 'build', 'build:engine']) {
    if (!pkg.scripts?.[script]) {
      report.checks.push({ command: `bun run ${script}`, exitCode: 1, stderr: 'Missing script' });
      continue;
    }
    const result = spawnSync('bun', ['run', script], { cwd: root, encoding: 'utf8' });
    report.checks.push({
      command: `bun run ${script}`,
      exitCode: result.status ?? 1,
      stdout: result.stdout,
      stderr: result.stderr || result.error?.message || '',
    });
  }
  report.status = report.checks.every((check) => check.exitCode === 0) ? 'passed' : 'failed';
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === 'passed' ? 0 : 1;

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { ScoreAdapter } from '../src/domain';
import { guitarValidator } from '../src/engine';
import { publishArrangement } from '../src/agent';
import { loadPreparedRun } from '../src/agent/prepare';

const usage = 'bun scripts/publish-arrangement.ts --run <prepared directory> --base-url <viewer origin> (--plan <plan.json> --delegation <receipt.json> | --baseline) [--store <.arrangements>] [--adapter-module <src/adapters/server.ts>]';

try {
  const { values } = parseArgs({ args: Bun.argv.slice(2), strict: true, options: {
    run: { type: 'string' }, 'base-url': { type: 'string' }, plan: { type: 'string' }, delegation: { type: 'string' },
    baseline: { type: 'boolean' }, store: { type: 'string' }, 'adapter-module': { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) { console.log(usage); process.exit(0); }
  if (!values.run || !values['base-url']) throw new Error(usage);
  // Export adapter is a local trusted module, not a model/provider/plugin fetched at runtime.
  const modulePath = resolve(values['adapter-module'] ?? 'src/adapters/server.ts');
  if (!await Bun.file(modulePath).exists()) throw new Error(`Canonical export adapter not integrated: ${modulePath}. No partial publication was installed. Integrate the independently verified adapter or pass its trusted local --adapter-module.`);
  const module = await import(pathToFileURL(modulePath).href);
  if (typeof module.createScoreAdapter !== 'function') throw new Error('Adapter module must export createScoreAdapter');
  const { run } = await loadPreparedRun(resolve(values.run));
  const scoreAdapter: ScoreAdapter = module.createScoreAdapter({ validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }), pdfTitle: run.title });
  if (!scoreAdapter || typeof scoreAdapter.project !== 'function' || typeof scoreAdapter.exportArtifact !== 'function') throw new Error('Adapter does not implement ScoreAdapter');
  const result = await publishArrangement({
    runDirectory: resolve(values.run), baseUrl: values['base-url'],
    ...(values.plan ? { planPath: resolve(values.plan) } : {}), ...(values.delegation ? { delegationPath: resolve(values.delegation) } : {}),
    ...(values.baseline ? { baseline: true } : {}), ...(values.store ? { storeRoot: resolve(values.store) } : {}),
  }, { scoreAdapter });
  console.log(JSON.stringify({ outcome: 'published', ...result, linkVerification: 'URLs constructed for the supplied viewer origin; orchestrator must HTTP-test viewer/PDF/MIDI before returning them to the user.' }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }

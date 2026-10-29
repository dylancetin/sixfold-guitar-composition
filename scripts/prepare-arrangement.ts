import { parseArgs } from 'node:util';
import { prepareArrangement } from '../src/agent';
import type { Preferences } from '../src/domain';

const usage = 'bun scripts/prepare-arrangement.ts --url <Songsterr URL> --difficulty beginner|intermediate|advanced --capo compare|0..12 [--title <title>] [--runs-root <local directory>] [--simplify-bends (explicit notated-pitch draft; bend motion omitted)]';

try {
  const { values } = parseArgs({ args: Bun.argv.slice(2), strict: true, options: {
    url: { type: 'string' }, difficulty: { type: 'string' }, capo: { type: 'string' }, title: { type: 'string' },
    'runs-root': { type: 'string' }, 'simplify-bends': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) { console.log(usage); process.exit(0); }
  if (!values.url || !values.difficulty || !['beginner', 'intermediate', 'advanced'].includes(values.difficulty) || !values.capo) throw new Error(usage);
  let capo: Preferences['capo'];
  if (values.capo === 'compare') capo = { mode: 'recommend', compare: [0, 2] };
  else if (/^(?:[0-9]|1[0-2])$/.test(values.capo)) capo = { mode: 'chosen', value: Number(values.capo) };
  else throw new Error('--capo must be compare or a fret 0..12');
  const result = await prepareArrangement({
    sourceUrl: values.url, difficulty: values.difficulty as Preferences['difficulty'], capo,
    ...(values['simplify-bends'] ? { simplifyBends: true } : {}),
    ...(values.title ? { title: values.title } : {}), ...(values['runs-root'] ? { runsRoot: values['runs-root'] } : {}),
  });
  console.log(JSON.stringify({ status: 'prepared-unapproved', ...result, next: 'Read brief.md/source.json/request.json; have the project musician subagent author plan.json, then publish with its factual delegation receipt. Or explicitly publish --baseline as deterministic fallback.' }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }

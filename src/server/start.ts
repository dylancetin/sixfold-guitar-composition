import { resolve } from 'node:path';
import { createPublishedHandler } from './published-http';

if (process.argv.includes('--study')) throw new Error('Study mode was removed. The viewer serves published arrangements only.');
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = Bun.serve({
  hostname: '0.0.0.0', port,
  fetch: createPublishedHandler({ arrangementsDirectory: resolve(process.env.ARRANGEMENTS_DIR ?? '.arrangements'), frontendDirectory: resolve('dist/client') }),
});
console.log(`Sixfold published arrangement viewer: ${server.url}`);

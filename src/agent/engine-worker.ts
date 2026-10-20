import { parentPort, workerData } from 'node:worker_threads';
import { guitarEngine } from '../engine';

if (!parentPort) throw new Error('Engine worker must run inside its bounded parent');
const { source, request, plan, provenance } = workerData;
parentPort.postMessage(guitarEngine.arrange(source, request, plan, provenance));

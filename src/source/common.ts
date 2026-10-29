import type { Diagnostic } from '../domain';

export type FailureStatus = 'invalid-input' | 'unsupported' | 'restricted' | 'unavailable';
export class SourceFailure extends Error {
  constructor(readonly status: FailureStatus, readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}
export function diagnostic(code: Diagnostic['code'], message: string, severity: Diagnostic['severity'] = 'warning', barIds: string[] = [], eventIds: string[] = []): Diagnostic {
  return { code, severity, message, barIds, eventIds, occurrenceIds: [] };
}
export function fail(message: string, status: FailureStatus = 'unsupported', code: Diagnostic['code'] = 'unsupported-construct', barIds: string[] = []): never {
  throw new SourceFailure(status, diagnostic(code, message, 'error', barIds));
}

export const PARSER_VERSION = '1.4.1';

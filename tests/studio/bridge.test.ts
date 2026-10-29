import { expect, test } from 'bun:test';
import { createAlphaTabBridge } from '../../src/client/alphatab-bridge';
import type { AlphaTabFactories } from '../../src/client/alphatab-bridge';
import { createAlphaTabScore } from '../../src/adapters';
import { study } from '../adapters/fixture';

class Element {
  children: Element[] = []; parent: Element | null = null;
  style: Record<string, string> = {}; dataset: Record<string, string> = {}; attributes: Record<string, string> = {};
  className = ''; hidden = false; scrollTop = 0; scrollLeft = 0; clientWidth = 900; clientHeight = 600;
  handlers = new Map<string, () => void>();
  constructor(readonly tag: string) {}
  append(...nodes: Element[]) {
    for (const node of nodes) {
      if (node.tag === 'fragment') { this.append(...[...node.children]); continue; }
      node.remove(); node.parent = this; this.children.push(node);
    }
  }
  replaceChildren(...nodes: Element[]) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  setAttribute(key: string, value: string) { this.attributes[key] = value; }
  addEventListener(key: string, callback: () => void) { this.handlers.set(key, callback); }
  all(): Element[] { return [this, ...this.children.flatMap(child => child.all())]; }
}

test('folded bridge resolves passes and replaces projection/geometry transactionally without replacing audio', async () => {
  const descriptors = new Map(['document', 'FontFace', 'DOMParser'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const globals = {
    document: { createElement: (tag: string) => new Element(tag), createDocumentFragment: () => new Element('fragment'), fonts: { add() {}, delete() {} } },
    FontFace: class { async load() { return this; } },
    DOMParser: class { parseFromString() { return { querySelector: () => null, querySelectorAll: () => [], documentElement: new Element('svg') }; } },
  };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  try {
    const { score } = await study(4), base = createAlphaTabScore(score).projection;
    const calls: Parameters<AlphaTabFactories['createAlphaTabScore']>[1][] = [];
    let audioCount = 0, generation = 0, hold = false, fail = false, stale = false;
    const pending: (() => void)[] = [];
    const seeks: number[] = [], selected: [string, string][] = [];
    type Snapshot = Parameters<Parameters<ReturnType<AlphaTabFactories['createPlaybackController']>['subscribe']>[0]>[0];
    let listener: (snapshot: Snapshot) => void = () => {};
    let snapshot: Snapshot = { state: 'paused', positionQuarter: 24, positionSeconds: 18, durationSeconds: 24, occurrenceId: 'o1-p4', error: null, activePerformedSoundIds: ['m0@o1-p4'], activeSegments: [{ eventId: 'm0', segmentId: 'n0', occurrenceId: 'o1-p4' }] };
    const emit = (occurrenceId: string | null, segmentId = 'n0') => {
      snapshot = { ...snapshot, occurrenceId, activeSegments: occurrenceId ? [{ eventId: segmentId === 'n0' ? 'm0' : 'm4', segmentId, occurrenceId }] : [] };
      listener(snapshot);
    };
    const factories: AlphaTabFactories = {
      fontUrl: '/fixture-font',
      createAlphaTabScore(_score, options) {
        calls.push(options); const id = ++generation;
        const projection = structuredClone(base);
        projection.mapping = projection.mapping.map(m => ({ ...m, nativeBeatId: `${id}-${m.nativeBeatId}` }));
        if (stale) { projection.scoreRevision.id = 'wrong-revision'; stale = false; }
        return { projection, async renderSvg() {
          if (fail) { fail = false; throw new Error('render failed'); }
          if (hold) await new Promise<void>(resolve => pending.push(resolve));
          const nativeBeatIds = [...new Set(projection.mapping.map(m => m.nativeBeatId))];
          return { width: 900, height: 500, fragments: [{ x: 0, y: 0, width: 900, height: 500, svg: '<svg/>' }], beats: projection.mapping.map(m => {
            const x = id * 30 + nativeBeatIds.indexOf(m.nativeBeatId) * 40;
            return { nativeBeatId: m.nativeBeatId, occurrenceId: m.occurrenceId, bounds: { x, y: 100, w: 24, h: 40 }, cursorX: x };
          }) };
        } };
      },
      createPlaybackController() {
        audioCount++;
        return {
          async play() {}, pause() {}, stop() {}, seek(quarter) { seeks.push(quarter); }, setTempoScale() {}, setMuted() {}, setSolo() {}, setLoop() {},
          subscribe(callback) { listener = callback; callback(snapshot); return () => {}; }, dispose() {},
        };
      },
    };
    const container = new Element('container');
    const controller = await createAlphaTabBridge(factories).mount({ container: container as unknown as HTMLElement, score, title: 'Fixture', onCursor() {}, onError(message) { throw new Error(message); }, onSelect: (event, occurrence) => selected.push([event, occurrence]) });
    expect(calls[0]).toMatchObject({ spacing: 'tight', barsPerRow: 4 });
    const targets = () => container.all().filter(e => e.className === 'native-note-target');
    const cursor = () => container.all().find(e => e.className === 'native-cursor')!;
    expect(targets()).toHaveLength(new Set(base.mapping.filter(m => m.nativeNoteId !== null).map(m => m.nativeBeatId)).size);
    const continuation = () => targets().find(e => e.dataset.soundId === 'm4' && e.dataset.occurrenceIds!.includes('o2-p1'))!;
    continuation().handlers.get('click')!();
    expect(selected.at(-1)).toEqual(['m4', 'o2-p4']); expect(seeks.at(-1)).toBe(28);
    emit('o2-p3', 'n4b'); continuation().handlers.get('click')!();
    expect(selected.at(-1)).toEqual(['m4', 'o2-p3']); expect(seeks.at(-1)).toBe(20);
    emit(null); continuation().handlers.get('click')!();
    expect(selected.at(-1)).toEqual(['m4', 'o2-p1']); expect(seeks.at(-1)).toBe(4);
    emit('o1-p4');
    await controller.setFingerNumbers(true);
    expect(calls.at(-1)).toMatchObject({ spacing: 'tight', barsPerRow: 4 });
    expect(audioCount).toBe(1); expect(cursor().hidden).toBe(false); expect(cursor().style.left).toBe('60px');
    hold = true;
    const older = controller.setLayout({ spacing: 'compact', barsPerRow: 3 });
    const newer = controller.setMeasureLabels(true);
    pending[1]!(); await newer;
    expect(cursor().style.left).toBe('120px');
    pending[0]!(); await older;
    expect(cursor().style.left).toBe('120px');
    hold = false; stale = true;
    await expect(controller.setFretMode('absolute')).rejects.toThrow('another revision');
    expect(cursor().style.left).toBe('120px');
    fail = true;
    await expect(controller.setFretMode('absolute')).rejects.toThrow('render failed');
    await controller.setLayout({ spacing: 'tight', barsPerRow: 4 });
    expect(calls.at(-1)).toMatchObject({ fretMode: 'relative', showFingerNumbers: true, showMeasureLabels: true });
    expect(audioCount).toBe(1); expect(cursor().hidden).toBe(false);
    controller.dispose();
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('printed onset targets merge simultaneous voices without covering later melody or losing bass-only onsets', async () => {
  const descriptors = new Map(['document', 'FontFace', 'DOMParser'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const globals = {
    document: { createElement: (tag: string) => new Element(tag), createDocumentFragment: () => new Element('fragment'), fonts: { add() {}, delete() {} } },
    FontFace: class { async load() { return this; } },
    DOMParser: class { parseFromString() { return { querySelector: () => null, querySelectorAll: () => [], documentElement: new Element('svg') }; } },
  };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  try {
    const { score } = await study(2), projection = createAlphaTabScore(score).projection;
    const printed = [
      { eventId: 'bass0', cursorX: 40, bounds: { x: 20, y: 100, w: 180, h: 36 } },
      { eventId: 'm0', cursorX: 40, bounds: { x: 30, y: 100, w: 28, h: 36 } },
      { eventId: 'm1', cursorX: 80, bounds: { x: 70, y: 100, w: 24, h: 36 } },
      { eventId: 'bass1', cursorX: 180, bounds: { x: 170, y: 100, w: 50, h: 36 } },
    ];
    const seeks: number[] = [], selected: [string, string][] = [];
    const factories: AlphaTabFactories = {
      fontUrl: '/fixture-font',
      createAlphaTabScore() {
        return { projection, async renderSvg() {
          return { width: 900, height: 500, fragments: [], beats: printed.flatMap(point => projection.mapping.filter(m => m.eventId === point.eventId).map(m => ({ nativeBeatId: m.nativeBeatId, occurrenceId: m.occurrenceId, bounds: { ...point.bounds }, cursorX: point.cursorX }))) };
        } };
      },
      createPlaybackController() {
        return {
          async play() {}, pause() {}, stop() {}, seek(quarter) { seeks.push(quarter); }, setTempoScale() {}, setMuted() {}, setSolo() {}, setLoop() {},
          subscribe(callback) {
            callback({ state: 'paused', positionQuarter: 8, positionSeconds: 6, durationSeconds: 12, occurrenceId: 'o1-p2', error: null, activePerformedSoundIds: ['bass0@o1-p2'], activeSegments: [{ eventId: 'bass0', segmentId: 'nb0', occurrenceId: 'o1-p2' }] });
            return () => {};
          }, dispose() {},
        };
      },
    };
    const container = new Element('container');
    const controller = await createAlphaTabBridge(factories).mount({ container: container as unknown as HTMLElement, score, title: 'Fixture', onCursor() {}, onError(message) { throw new Error(message); }, onSelect: (event, occurrence) => selected.push([event, occurrence]) });
    const targets = container.all().filter(e => e.className === 'native-note-target');
    expect(targets).toHaveLength(3);
    const regions = targets.map(target => ({ target, left: parseFloat(target.style.left!), right: parseFloat(target.style.left!) + parseFloat(target.style.width!) })).sort((a, b) => a.left - b.left);
    for (let i = 1; i < regions.length; i++) expect(regions[i - 1]!.right).toBeLessThanOrEqual(regions[i]!.left);
    const clickAt = (x: number) => {
      const hits = regions.filter(region => region.left <= x && x < region.right);
      expect(hits).toHaveLength(1);
      hits[0]!.target.handlers.get('click')!();
      return hits[0]!.target;
    };
    const melody = clickAt(40);
    expect(melody.dataset.soundId).toBe('m0');
    expect(melody.dataset.occurrenceIds).toBe('o1-p1 o1-p2');
    expect(selected.at(-1)).toEqual(['m0', 'o1-p2']); expect(seeks.at(-1)).toBe(8);
    clickAt(80);
    expect(selected.at(-1)).toEqual(['m1', 'o1-p2']); expect(seeks.at(-1)).toBe(9);
    clickAt(180);
    expect(selected.at(-1)).toEqual(['bass1', 'o2-p2']); expect(seeks.at(-1)).toBe(12);
    const cursor = container.all().find(e => e.className === 'native-cursor')!;
    expect(cursor.hidden).toBe(false); expect(cursor.style.left).toBe('40px'); expect(cursor.style.width).toBe('180px');
    controller.dispose();
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

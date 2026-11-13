import { afterEach, describe, expect, it, vi } from 'vitest';

// stt/debug.ts touches `window` when imported; give the Node test run one.
vi.hoisted(() => {
  (globalThis as any).window ??= globalThis;
});

import { GlassBridgeSource } from '../stt/sources/glass-bridge';

type Listener = (event: unknown) => void;

function installBridge() {
  const listeners: Listener[] = [];
  const bridge = {
    rawBridge: { audioControl: async () => true },
    onEvent: (cb: Listener) => listeners.push(cb),
  };
  (globalThis as any).__evenBridge = bridge;
  return (audioPcm: Uint8Array) => listeners.forEach((cb) => cb({ audioEvent: { audioPcm } }));
}

afterEach(() => {
  delete (globalThis as any).__evenBridge;
});

describe('GlassBridgeSource', () => {
  it('converts glasses PCM chunks to floats at 16 kHz', async () => {
    const emit = installBridge();
    const source = new GlassBridgeSource();
    const received: [number[], number][] = [];
    source.onAudioData((pcm, rate) => received.push([Array.from(pcm), rate]));
    await source.start();
    emit(new Uint8Array([0x00, 0x40, 0x00, 0xc0])); // 16384, -16384
    expect(received).toEqual([[[0.5, -0.5], 16000]]);
    source.dispose();
  });

  it('does not throw on a chunk with an odd byte count', async () => {
    const emit = installBridge();
    const source = new GlassBridgeSource();
    const received: number[][] = [];
    source.onAudioData((pcm) => received.push(Array.from(pcm)));
    await source.start();
    expect(() => emit(new Uint8Array([0x00, 0x40, 0x7f]))).not.toThrow();
    expect(received).toEqual([[0.5]]);
    source.dispose();
  });
});

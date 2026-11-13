import { describe, expect, it } from 'vitest';
import { float32ToPcm16, float32ToWav, pcm16ToFloat32, uint8ToPcm16 } from '../stt/audio/pcm-utils';

/** Little-endian bytes for the given 16-bit samples. */
function le16(...samples: number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((s, i) => view.setInt16(i * 2, s, true));
  return bytes;
}

describe('uint8ToPcm16', () => {
  it('reads little-endian samples without copying', () => {
    const bytes = le16(1, -2, 32767, -32768);
    const pcm = uint8ToPcm16(bytes);
    expect(Array.from(pcm)).toEqual([1, -2, 32767, -32768]);
    expect(pcm.buffer).toBe(bytes.buffer);
  });

  it('accepts a view that starts at an odd byte offset', () => {
    const backing = new Uint8Array(1 + 4);
    backing.set(le16(7, -7), 1);
    const view = backing.subarray(1);
    expect(view.byteOffset).toBe(1);
    expect(Array.from(uint8ToPcm16(view))).toEqual([7, -7]);
  });

  it('ignores a trailing odd byte', () => {
    const bytes = new Uint8Array([...le16(5, 6), 0xff]);
    expect(Array.from(uint8ToPcm16(bytes))).toEqual([5, 6]);
  });

  it('handles odd offset and odd length together', () => {
    const backing = new Uint8Array([0xaa, ...le16(3), 0xbb]);
    expect(Array.from(uint8ToPcm16(backing.subarray(1)))).toEqual([3]);
  });

  it('returns an empty array for empty input', () => {
    expect(uint8ToPcm16(new Uint8Array()).length).toBe(0);
  });
});

describe('pcm16ToFloat32 / float32ToPcm16', () => {
  it('maps the 16-bit range onto [-1, 1)', () => {
    const f = pcm16ToFloat32(new Int16Array([0, 16384, -32768, 32767]));
    expect(Array.from(f)).toEqual([0, 0.5, -1, 32767 / 32768]);
  });

  it('clamps out-of-range floats', () => {
    expect(Array.from(float32ToPcm16(new Float32Array([2, -2, 1, -1, 0])))).toEqual([32767, -32768, 32767, -32768, 0]);
  });
});

describe('float32ToWav', () => {
  it('writes a 44-byte PCM header followed by the samples', async () => {
    const blob = float32ToWav(new Float32Array([0, 0.5, -0.5]), 16000);
    expect(blob.type).toBe('audio/wav');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const ascii = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
    expect(bytes.length).toBe(44 + 6);
    expect(ascii(0)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 6);
    expect(ascii(8)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(28, true)).toBe(32000);
    expect(ascii(36)).toBe('data');
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(16383);
  });
});

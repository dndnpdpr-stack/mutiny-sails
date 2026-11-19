import { Rng } from '../../src/engine/rng';

describe('Rng', () => {
  it('same seed gives same sequence', () => {
    const a = new Rng(42), b = new Rng(42);
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    expect(sa).toEqual(sb);
  });
  it('different seed gives different sequence', () => {
    const a = new Rng(1), b = new Rng(2);
    expect(Array.from({ length: 10 }, () => a.next())).not.toEqual(Array.from({ length: 10 }, () => b.next()));
  });
  it('int stays in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
  it('shuffle preserves elements', () => {
    const r = new Rng(3);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = r.shuffle([...arr]);
    expect([...out].sort()).toEqual(arr);
  });
});

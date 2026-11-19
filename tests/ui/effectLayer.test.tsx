import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectLayer } from '../../src/ui/anim/EffectLayer';
import type { Effect } from '../../src/ui/anim/effects';

const fly = (at: number, from: any = 'deck', to: any = 'hand'): Effect => ({ kind: 'fly', from, to, card: null, at, ms: 450 });

function Anchors() {
  return (
    <>
      <div data-anchor="deck" />
      <div data-anchor="hand" />
      <div data-anchor="seat:1" />
    </>
  );
}

function setup(effects: Effect[], speed: 1 | 2 = 1, batchKey = 1) {
  const ui = (e: Effect[], s: 1 | 2, k: number) => (
    <>
      <Anchors />
      <EffectLayer effects={e} speed={s} batchKey={k} />
    </>
  );
  const r = render(ui(effects, speed, batchKey));
  return { ...r, again: (e: Effect[], s: 1 | 2, k: number) => r.rerender(ui(e, s, k)) };
}

const count = (c: HTMLElement, kind: string) => c.querySelectorAll(`[data-effect="${kind}"]`).length;

describe('EffectLayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('draws a fly effect at at=0', () => {
    const { container } = setup([fly(0)]);
    act(() => { vi.advanceTimersByTime(0); });
    expect(count(container, 'fly')).toBe(1);
  });

  it('delays by at, halved at speed 2', () => {
    const a = setup([fly(240)]);
    act(() => { vi.advanceTimersByTime(0); });
    expect(count(a.container, 'fly')).toBe(0);
    act(() => { vi.advanceTimersByTime(240); });
    expect(count(a.container, 'fly')).toBe(1);
    a.unmount();

    const b = setup([fly(240)], 2);
    act(() => { vi.advanceTimersByTime(119); });
    expect(count(b.container, 'fly')).toBe(0);
    act(() => { vi.advanceTimersByTime(1); });
    expect(count(b.container, 'fly')).toBe(1);
  });

  it('removes an effect after at+ms', () => {
    const { container } = setup([fly(0)]);
    act(() => { vi.advanceTimersByTime(0); });
    expect(count(container, 'fly')).toBe(1);
    act(() => { vi.advanceTimersByTime(450); });
    expect(count(container, 'fly')).toBe(0);
  });

  it('skips fly without anchors', () => {
    const { container } = setup([fly(0, 'deck', 'discard')]);
    act(() => { vi.advanceTimersByTime(10); });
    expect(count(container, 'fly')).toBe(0);
  });

  it('draws float text with tone class', () => {
    const { container } = setup([{ kind: 'float', seat: 1, text: '-1', tone: 'damage', at: 0, ms: 600 }]);
    act(() => { vi.advanceTimersByTime(0); });
    const el = container.querySelector('[data-effect="float"]')!;
    expect(el.textContent).toBe('-1');
    expect(el.classList.contains('damage')).toBe(true);
  });

  it('clears previous batch when batchKey changes', () => {
    const { container, again } = setup([fly(0)]);
    act(() => { vi.advanceTimersByTime(0); });
    expect(count(container, 'fly')).toBe(1);
    again([], 1, 2);
    act(() => { vi.advanceTimersByTime(0); });
    expect(count(container, 'fly')).toBe(0);
  });
});

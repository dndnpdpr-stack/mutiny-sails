import { renderHook, act } from '@testing-library/react';
import { useAnimatedView } from '../../src/ui/anim/useAnimatedView';
import type { GameEvent, PlayerView } from '../../src/engine/types';

function view(events: GameEvent[], extra: Partial<PlayerView> = {}): PlayerView {
  return {
    you: 0, myRole: 'rebel', myHand: [], seats: [], current: 0, pending: null, hints: [],
    deckCount: 10, discardTop: null, distances: {}, myRange: 1, abilityUsed: false, events, winner: null, seaEventsOn: false, seaEvent: null, ...extra,
  };
}
const dmg = (seq: number): GameEvent => ({ type: 'damage', seat: 1, amount: 1, source: 0, seq });
/** n damage events starting at seq `from` */
const dmgs = (from: number, n: number) => Array.from({ length: n }, (_, i) => dmg(from + i));
const props = (latest: PlayerView | null, enabled = true) => ({ latest, enabled });

function setup(first: PlayerView | null) {
  return renderHook(({ latest, enabled }) => useAnimatedView(latest, { enabled }), { initialProps: props(first) });
}

describe('useAnimatedView', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the first view immediately without effects', () => {
    const v = view([dmg(1)]);
    const { result } = setup(v);
    expect(result.current.shown).toBe(v);
    expect(result.current.effects).toEqual([]);
  });

  it('jumps straight to the first table view when the draft just ended', () => {
    const seat = (character: string | null) => ({ seat: 0, name: 'a', character, hp: 0, maxHp: 0, alive: true, handCount: 0, equipment: [], role: null, isAi: false });
    const drafting = view([], { seats: [seat(null)] as any });
    const table = view([dmg(1), dmg(2)], { seats: [seat('tom')] as any });
    const { result, rerender } = setup(drafting);
    rerender(props(table));
    expect(result.current.shown).toBe(table);
    expect(result.current.effects).toEqual([]);
  });

  it('holds the old view while effects play, then swaps', () => {
    const v1 = view([dmg(1)]);
    const v2 = view([dmg(1), dmg(2)]);
    const { result, rerender } = setup(v1);
    rerender(props(v2));
    expect(result.current.shown).toBe(v1);
    expect(result.current.effects).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(599); });
    expect(result.current.shown).toBe(v1);
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current.shown).toBe(v2);
    expect(result.current.effects).toEqual([]);
    expect(result.current.batchKey).toBeGreaterThan(0);
  });

  it('double speed mode plays even a short batch at 2x', () => {
    const v1 = view([dmg(1)]);
    const v2 = view([dmg(1), dmg(2)]);
    const { result, rerender } = renderHook(({ latest }) => useAnimatedView(latest, { enabled: true, minSpeed: 2 }), { initialProps: { latest: v1 } });
    rerender({ latest: v2 });
    expect(result.current.speed).toBe(2);
    act(() => { vi.advanceTimersByTime(301); });
    expect(result.current.shown).toBe(v2);
  });

  it('changes batchKey when a batch with effects starts, and again for the next batch', () => {
    const { result, rerender } = setup(view([]));
    const k0 = result.current.batchKey;
    rerender(props(view([dmg(1)])));
    expect(result.current.effects).toHaveLength(2);
    const k1 = result.current.batchKey;
    expect(k1).not.toBe(k0);
    act(() => { vi.advanceTimersByTime(601); });
    const kEnd = result.current.batchKey;
    expect(result.current.effects).toEqual([]);
    rerender(props(view([dmg(1), dmg(2)])));
    expect(result.current.effects).toHaveLength(2);
    const k2 = result.current.batchKey;
    expect(k2).not.toBe(k1);
    expect(k2).not.toBe(kEnd);
  });

  it('gives back-to-back batches different keys without an empty state between them', () => {
    const { result, rerender } = setup(view([]));
    rerender(props(view([dmg(1)])));
    const k1 = result.current.batchKey;
    rerender(props(view([dmg(1), dmg(2)]))); // 대기열에 쌓임
    act(() => { vi.advanceTimersByTime(601); });
    expect(result.current.effects).toHaveLength(2);
    expect(result.current.batchKey).not.toBe(k1);
  });

  it('enabled=false swaps immediately', () => {
    const v1 = view([dmg(1)]);
    const v2 = view([dmg(1), dmg(2)]);
    const { result, rerender } = setup(v1);
    rerender(props(v2, false));
    expect(result.current.shown).toBe(v2);
    expect(result.current.effects).toEqual([]);
  });

  it('view without new visible effects swaps immediately', () => {
    const v1 = view([dmg(1)]);
    const v2 = view([dmg(1)], { deckCount: 5 });
    const { result, rerender } = setup(v1);
    rerender(props(v2));
    expect(result.current.shown).toBe(v2);
  });

  it('catch-up: 10 back-to-back animated views end on the 10th, shown immediately', () => {
    const { result, rerender } = setup(view([]));
    let last = view([]);
    for (let i = 0; i < 10; i++) {
      last = view(dmgs(1 + i * 5, 5)); // ~1080ms each
      rerender(props(last));
    }
    expect(result.current.shown).toBe(last);
    expect(result.current.effects).toEqual([]);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(result.current.shown).toBe(last);
    expect(result.current.effects).toEqual([]);
  });

  it('animates normally again after the quiet period', () => {
    const { result, rerender } = setup(view([]));
    let seq = 1;
    let last = view([]);
    for (let i = 0; i < 6; i++) {
      last = view(dmgs(seq, 5));
      seq += 5;
      rerender(props(last));
    }
    expect(result.current.shown).toBe(last);
    act(() => { vi.advanceTimersByTime(700); });
    const next = view([...last.events, ...dmgs(seq, 1)]);
    rerender(props(next));
    expect(result.current.shown).toBe(last);
    expect(result.current.effects).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(700); });
    expect(result.current.shown).toBe(next);
  });

  it('speeds up to 2x between 1500 and 3000ms', () => {
    const v0 = view([]);
    const v1 = view(dmgs(1, 5)); // ~1080
    const v2 = view(dmgs(1, 10)); // another ~1080 -> ~2160 backlog
    const { result, rerender } = setup(v0);
    rerender(props(v1));
    expect(result.current.speed).toBe(1);
    rerender(props(v2));
    expect(result.current.speed).toBe(2);
    expect(result.current.shown).toBe(v0);
    act(() => { vi.advanceTimersByTime(560); });
    expect(result.current.shown).toBe(v1);
  });

  it('still reaches the final state with winner after queued views', () => {
    const v0 = view([]);
    const v1 = view([dmg(1)]);
    const v2 = view([dmg(1), dmg(2)], { winner: 'rebels' });
    const { result, rerender } = setup(v0);
    rerender(props(v1));
    rerender(props(v2));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.shown!.winner).toBe('rebels');
  });

  it('detects a new game (seq went backwards) and resets', () => {
    const v1 = view([dmg(1)]);
    const old = view([dmg(50)]);
    const { result, rerender } = setup(v1);
    rerender(props(old));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.shown).toBe(old);
    const fresh = view([
      { type: 'turnStart', seat: 0, seq: 1 },
      { type: 'turnStart', seat: 0, seq: 2 },
      { type: 'turnStart', seat: 0, seq: 3 },
    ]);
    rerender(props(fresh));
    expect(result.current.shown).toBe(fresh);
    expect(result.current.effects).toEqual([]);
    const next = view([...fresh.events, dmg(4)]);
    rerender(props(next));
    expect(result.current.shown).toBe(fresh);
    expect(result.current.effects.length).toBe(2);
  });

  it('latest=null clears and pending timers do nothing', () => {
    const v1 = view([dmg(1)]);
    const v2 = view([dmg(1), dmg(2)]);
    const { result, rerender } = setup(v1);
    rerender(props(v2));
    rerender(props(null));
    expect(result.current.shown).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.shown).toBeNull();
  });
});

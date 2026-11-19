import { renderHook, act } from '@testing-library/react';
import { useAnimatedView } from '../../src/ui/anim/useAnimatedView';
import type { GameEvent, PlayerView } from '../../src/engine/types';

function view(events: GameEvent[], extra: Partial<PlayerView> = {}): PlayerView {
  return {
    you: 0, myRole: 'rebel', myHand: [], seats: [], current: 0, pending: null, hints: [],
    deckCount: 10, discardTop: null, distances: {}, myRange: 1, events, winner: null, ...extra,
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
    expect(result.current.batchKey).toBe(1);
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

  it('drops the queue and jumps to the latest when backlog > 3000ms', () => {
    const first = view([]);
    const { result, rerender } = setup(first);
    let last = first;
    let seq = 1;
    for (let i = 0; i < 10; i++) {
      last = view(dmgs(seq, 5)); // ~1080ms each
      seq += 5;
      rerender(props(last));
      if (result.current.shown === last) break;
    }
    expect(result.current.shown).toBe(last);
    expect(result.current.effects).toEqual([]);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(result.current.shown).toBe(last);
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

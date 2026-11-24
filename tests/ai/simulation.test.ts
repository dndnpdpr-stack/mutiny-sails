import { AiMemory } from '../../src/ai/memory';
import { decide, fallbackAction } from '../../src/ai/decide';
import { Game } from '../../src/engine/Game';
import { Rng } from '../../src/engine/rng';
import { buildView } from '../../src/host/view';

function playOut(seed: number, extras = false, level: 'easy' | 'normal' | 'hard' = 'normal') {
  const n = 4 + (seed % 6);
  const game = new Game({ seed, names: Array.from({ length: n }, (_, i) => `P${i}`), seaEvents: extras, expansionCards: extras });
  game.start();
  const mems = game.seats.map(() => new AiMemory());
  const rng = new Rng(seed * 7 + 1);
  let steps = 0;
  let rejected = 0;
  while (game.winner === null && steps < 3000) {
    const p = game.pending();
    if (!p) throw new Error(`no pending at seed ${seed}`);
    const view = buildView(game, p.seat, () => true);
    const action = decide(view, mems[p.seat], rng, level);
    if (!action) throw new Error(`no action at seed ${seed}`);
    const r = game.apply(p.seat, action);
    if (!r.ok) {
      rejected++;
      game.apply(p.seat, fallbackAction(view)!);
    }
    steps++;
  }
  return { winner: game.winner, steps, rejected };
}

describe('AI simulation', () => {
  it('300 games all finish with few rejected actions', () => {
    const tally: Record<string, number> = {};
    let steps = 0;
    let rejected = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = playOut(seed);
      expect(r.winner, `seed ${seed}`).not.toBeNull();
      tally[r.winner!] = (tally[r.winner!] ?? 0) + 1;
      steps += r.steps;
      rejected += r.rejected;
    }
    console.log('winners', tally, 'steps', steps, 'rejected', rejected);
    expect(rejected / steps).toBeLessThan(0.01);
  }, 120000);

  it('every difficulty finishes its games (no stalemate)', () => {
    for (const level of ['easy', 'hard'] as const) {
      for (let seed = 1; seed <= 100; seed++) expect(playOut(seed, true, level).winner, `${level} seed ${seed}`).not.toBeNull();
    }
  }, 120000);

  it('300 games with sea events and expansion cards all finish with few rejected actions', () => {
    let steps = 0;
    let rejected = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = playOut(seed, true);
      expect(r.winner, `seed ${seed}`).not.toBeNull();
      steps += r.steps;
      rejected += r.rejected;
    }
    console.log('extras steps', steps, 'rejected', rejected);
    expect(rejected / steps).toBeLessThan(0.01);
  }, 120000);
});

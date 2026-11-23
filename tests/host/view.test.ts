import { Game } from '../../src/engine/Game';
import type { CharacterId } from '../../src/engine/types';
import { buildView } from '../../src/host/view';
import { makeGame, startPastRoles } from '../engine/helpers';

const noAi = () => false;

describe('buildView', () => {
  it('hides roles except captain and the dead', () => {
    const g = makeGame(5);
    g.start();
    g.kill(2, null);
    const v = buildView(g, 1, noAi);
    expect(v.myRole).toBe('rebel');
    expect(v.seats[0].role).toBe('captain');
    expect(v.seats[2].role).toBe('rebel');
    expect(v.seats[3].role).toBeNull();
    expect(v.seats[4].role).toBeNull();
  });

  it('never leaks other hands', () => {
    const g = makeGame(5);
    g.start();
    for (const seat of [0, 1, 2, 3, 4]) {
      const json = JSON.stringify(buildView(g, seat, noAi));
      for (const other of g.seats) {
        if (other.seat === seat) continue;
        for (const c of other.hand) expect(json).not.toContain(`"${c.id}"`);
      }
    }
  });

  it('reports abilityUsed only for the current seat', () => {
    const g = makeGame(5);
    g.start();
    g.abilityUsedThisTurn = true;
    expect(buildView(g, g.current, noAi).abilityUsed).toBe(true);
    expect(buildView(g, (g.current + 1) % 5, noAi).abilityUsed).toBe(false);
    g.abilityUsedThisTurn = false;
    expect(buildView(g, g.current, noAi).abilityUsed).toBe(false);
  });

  it('shows my hand, counts, distances and hints', () => {
    const g = makeGame(5);
    g.start();
    const v = buildView(g, 0, noAi);
    expect(v.myHand.length).toBe(7);
    expect(v.seats[1].handCount).toBe(4);
    expect(v.distances[2]).toBe(2);
    expect(v.myRange).toBe(1);
    expect(v.pending).toEqual({ kind: 'turn', seat: 0 });
    expect(v.hints.length).toBeGreaterThan(0);
    expect(buildView(g, 1, noAi).hints).toEqual([]);
  });

  it('private events are only in the owner view', () => {
    const g = makeGame(5, { characters: ['margo', 'derrick', 'hanna', 'orso', 'bruno'] });
    g.start();
    g.apply(0, { type: 'chooseSeat', target: 1 });
    expect(buildView(g, 0, noAi).events.some((e) => e.type === 'peek')).toBe(true);
    expect(buildView(g, 1, noAi).events.some((e) => e.type === 'peek')).toBe(false);
    expect(buildView(g, 0, noAi).events.some((e) => e.type === 'drawCards')).toBe(true);
    expect(buildView(g, 2, noAi).events.some((e) => e.type === 'drawCards')).toBe(false);
  });

  it('reveals every role when the game is over', () => {
    const g = makeGame(5);
    g.start();
    g.kill(0, 3);
    const v = buildView(g, 1, noAi);
    expect(v.winner).toBe('rebels');
    expect(v.seats.every((s) => s.role !== null)).toBe(true);
  });
});

describe('buildView draft', () => {
  it('masks unchosen characters and hides options from non-choosers', () => {
    const g = new Game({ seed: 3, names: ['A', 'B', 'C', 'D'] });
    startPastRoles(g);
    const p = g.pending();
    expect(p?.kind).toBe('chooseCharacter');
    const captain = p!.seat;
    const mine = buildView(g, captain, noAi);
    expect(mine.pending?.kind === 'chooseCharacter' && mine.pending.options.length).toBe(3);
    expect(mine.seats.every((s) => s.character === null)).toBe(true);
    const other = (captain + 1) % 4;
    const theirs = buildView(g, other, noAi);
    expect(theirs.pending?.kind === 'chooseCharacter' && theirs.pending.options).toEqual([]);
    const opt = (mine.pending as { options: CharacterId[] }).options[0];
    g.apply(captain, { type: 'chooseCharacter', character: opt });
    const after = buildView(g, other, noAi);
    expect(after.seats[captain].character).toBe(opt);
    expect(after.seats[other].character).toBeNull();
  });
});

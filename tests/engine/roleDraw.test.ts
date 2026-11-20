import { Game } from '../../src/engine/Game';
import { defaultActionFor } from '../../src/engine/defaults';
import type { PendingView, Role } from '../../src/engine/types';
import { buildView } from '../../src/host/view';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
const noAi = () => false;

function drawAll(g: Game) {
  while (g.pending()?.kind === 'drawRole') {
    const p = g.pending() as Extract<PendingView, { kind: 'drawRole' }>;
    expect(g.apply(p.seat, { type: 'drawRole', slot: p.slots[0] }).ok).toBe(true);
  }
}

describe('role draw', () => {
  it('starts with seat 0 choosing among all face-down slots', () => {
    const g = new Game({ seed: 4, names: names(5) });
    g.start();
    expect(g.pending()).toEqual({ kind: 'drawRole', seat: 0, slots: [0, 1, 2, 3, 4] });
  });

  it('goes clockwise and removes taken slots', () => {
    const g = new Game({ seed: 4, names: names(5) });
    g.start();
    g.apply(0, { type: 'drawRole', slot: 2 });
    expect(g.pending()).toEqual({ kind: 'drawRole', seat: 1, slots: [0, 1, 3, 4] });
    g.apply(1, { type: 'drawRole', slot: 0 });
    expect(g.pending()).toEqual({ kind: 'drawRole', seat: 2, slots: [1, 3, 4] });
  });

  it('rejects a taken slot, an unknown slot, and other actions', () => {
    const g = new Game({ seed: 4, names: names(5) });
    g.start();
    g.apply(0, { type: 'drawRole', slot: 2 });
    expect(g.apply(1, { type: 'drawRole', slot: 2 }).ok).toBe(false);
    expect(g.apply(1, { type: 'drawRole', slot: 9 }).ok).toBe(false);
    expect(g.apply(1, { type: 'endTurn' }).ok).toBe(false);
    expect(g.pending()).toEqual({ kind: 'drawRole', seat: 1, slots: [0, 1, 3, 4] });
  });

  it.each([4, 5, 6, 7])('%i players: roles match the table, then the character draft starts from the captain', (n) => {
    const g = new Game({ seed: 11, names: names(n) });
    g.start();
    drawAll(g);
    const roles = g.seats.map((s) => s.role).sort();
    const table: Record<number, Role[]> = {
      4: ['captain', 'spy', 'rebel', 'rebel'],
      5: ['captain', 'spy', 'rebel', 'rebel', 'loyalist'],
      6: ['captain', 'spy', 'rebel', 'rebel', 'loyalist', 'rebel'],
      7: ['captain', 'spy', 'rebel', 'rebel', 'loyalist', 'rebel', 'loyalist'],
    };
    expect(roles).toEqual([...table[n]].sort());
    expect(g.pending()).toMatchObject({ kind: 'chooseCharacter', seat: g.captainSeat() });
  });

  it('the drawn role is private except the captain, which everyone sees', () => {
    const g = new Game({ seed: 4, names: names(5) });
    g.start();
    drawAll(g);
    const drawn = g.events.filter((e) => e.type === 'roleDrawn');
    for (const s of g.seats) {
      const mine = drawn.filter((e) => e.type === 'roleDrawn' && e.seat === s.seat);
      for (const other of g.seats) {
        const visible = mine.filter((e) => !e.visibleTo || e.visibleTo.includes(other.seat));
        expect(visible).toHaveLength(1);
        const role = visible[0].type === 'roleDrawn' ? visible[0].role : undefined;
        if (other.seat === s.seat || s.role === 'captain') expect(role).toBe(s.role);
        else expect(role).toBeNull();
      }
    }
  });

  it('views hide undrawn roles, including my own until I draw', () => {
    const g = new Game({ seed: 4, names: names(5) });
    g.start();
    expect(buildView(g, 2, noAi).myRole).toBeNull();
    expect(buildView(g, 2, noAi).seats.every((s) => s.role === null)).toBe(true);
    g.apply(0, { type: 'drawRole', slot: 0 });
    g.apply(1, { type: 'drawRole', slot: 1 });
    g.apply(2, { type: 'drawRole', slot: 2 });
    const v = buildView(g, 2, noAi);
    expect(v.myRole).toBe(g.seats[2].role);
    expect(v.seats[3].role).toBeNull();
  });

  it('the default action draws the first remaining slot', () => {
    const g = new Game({ seed: 4, names: names(5) });
    g.start();
    const p = g.pending()!;
    expect(defaultActionFor(g, p)).toEqual({ type: 'drawRole', slot: 0 });
    expect(g.apply(p.seat, defaultActionFor(g, p)).ok).toBe(true);
  });

  it('forced roles skip the draw', () => {
    const g = new Game({ seed: 4, names: names(4), roles: ['captain', 'spy', 'rebel', 'rebel'] });
    g.start();
    expect(g.pending()?.kind).toBe('chooseCharacter');
  });

  it('can start the draw from a chosen seat and continue clockwise', () => {
    const g = new Game({ seed: 4, names: names(5), firstRoleDrawer: 3 });
    g.start();
    const order: number[] = [];
    for (let p = g.pending(); p?.kind === 'drawRole'; p = g.pending()) {
      order.push(p.seat);
      g.apply(p.seat, { type: 'drawRole', slot: p.slots[0] });
    }
    expect(order).toEqual([3, 4, 0, 1, 2]);
  });
});

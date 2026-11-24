import { Game } from '../../src/engine/Game';
import { buildView } from '../../src/host/view';
import type { Role } from '../../src/engine/types';
import { DEFAULT_CHARS, giveHand, passUntil, setHand, startPastRoles } from './helpers';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
const CHARS9 = [...DEFAULT_CHARS, 'gordon', 'luca'] as const;

function drawn(n: number, seed = 3) {
  const g = new Game({ seed, names: names(n), characters: [...CHARS9].slice(0, n) });
  startPastRoles(g);
  return g;
}
const count = (g: Game, role: Role) => g.seats.filter((s) => s.role === role).length;

describe('expansion roles (8-9 players)', () => {
  it('8 players: captain, spy, 3 rebels (one double agent), 2 loyalists (one navigator), a bounty hunter', () => {
    const g = drawn(8);
    expect([count(g, 'captain'), count(g, 'spy'), count(g, 'rebel'), count(g, 'loyalist'), count(g, 'hunter')]).toEqual([1, 1, 3, 2, 1]);
    expect(g.seats.filter((s) => s.special === 'doubleAgent').map((s) => s.role)).toEqual(['rebel']);
    expect(g.seats.filter((s) => s.special === 'navigator').map((s) => s.role)).toEqual(['loyalist']);
  });

  it('9 players adds a third loyalist', () => {
    const g = drawn(9);
    expect([count(g, 'captain'), count(g, 'spy'), count(g, 'rebel'), count(g, 'loyalist'), count(g, 'hunter')]).toEqual([1, 1, 3, 3, 1]);
  });

  it('7 players or fewer have no expansion roles', () => {
    for (const n of [4, 5, 6, 7]) {
      const g = drawn(n);
      expect(count(g, 'hunter')).toBe(0);
      expect(g.seats.some((s) => s.special)).toBe(false);
    }
  });

  it('accepts 9 players but not 10', () => {
    expect(() => new Game({ seed: 1, names: names(10) })).toThrow();
  });

  it('the drawer learns their own special role', () => {
    const g = drawn(8);
    const nav = g.seats.find((s) => s.special === 'navigator')!;
    expect(buildView(g, nav.seat, () => true).mySpecial).toBe('navigator');
    const other = g.seats.find((s) => s.role === 'spy')!;
    expect(buildView(g, other.seat, () => true).mySpecial).toBeNull();
  });
});

// 강제 역할: 0 선장, 1 반란(이중 첩자), 2 반란, 3 첩자, 4 충성(항해사), 5 반란, 6 충성, 7 사냥꾼
const ROLES8: Role[] = ['captain', 'rebel', 'rebel', 'spy', 'loyalist', 'rebel', 'loyalist', 'hunter'];
const SPECIALS8 = [null, 'doubleAgent', null, null, 'navigator', null, null, null] as const;
function forced(extra: { bountyTarget?: number } = {}) {
  const g = new Game({ seed: 5, names: names(8), roles: ROLES8, specials: [...SPECIALS8], characters: [...CHARS9].slice(0, 8), expansionCards: true, ...extra });
  g.start();
  return g;
}

describe('navigator', () => {
  it('starts knowing exactly one rebel, with their true role', () => {
    const g = forced();
    const v = buildView(g, 4, () => true);
    const known = v.seats.filter((s) => s.seat !== 4 && s.seat !== 0 && s.role !== null);
    expect(known).toHaveLength(1);
    expect(known[0].role).toBe('rebel');
  });
});

describe('double agent', () => {
  it('a parrot tattle shows them as a loyalist, but their true role shows once they fall', () => {
    const g = forced();
    const [tattle] = setHand(g, 0, ['parrotTattle']);
    g.apply(0, { type: 'playCard', cardId: tattle.id, target: 1 });
    expect(buildView(g, 0, () => true).seats[1].role).toBe('loyalist');
    g.kill(1, null);
    expect(buildView(g, 0, () => true).seats[1].role).toBe('rebel');
    expect(buildView(g, 0, () => true).seats[1].special).toBe('doubleAgent');
  });

  it('tattling an ordinary rebel tells the truth', () => {
    const g = forced();
    const [tattle] = setHand(g, 0, ['parrotTattle']);
    g.apply(0, { type: 'playCard', cardId: tattle.id, target: 2 });
    expect(buildView(g, 0, () => true).seats[2].role).toBe('rebel');
  });
});

describe('bounty hunter', () => {
  it('gets a secret target that is not the captain or themselves, seen only by the hunter', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = new Game({ seed, names: names(8), roles: ROLES8, specials: [...SPECIALS8], characters: [...CHARS9].slice(0, 8) });
      g.start();
      const b = buildView(g, 7, () => true).myBounty!;
      expect(b.state).toBe('open');
      expect([0, 7]).not.toContain(b.target);
      expect(buildView(g, 2, () => true).myBounty).toBeNull();
    }
  });

  it('wins alongside the winners after knocking out the target personally and surviving', () => {
    const g = forced({ bountyTarget: 6 });
    g.kill(6, 7);
    expect(buildView(g, 7, () => true).myBounty!.state).toBe('claimed');
    for (const s of [1, 2, 3, 5]) g.kill(s, 0); // 반란·첩자 전멸 → 선장 편 승리
    expect(g.winner).toBe('captainTeam');
    expect(g.bountyWon).toBe(true);
    expect(buildView(g, 2, () => true).bountyWon).toBe(true);
  });

  it('loses the bounty if someone else knocks out the target', () => {
    const g = forced({ bountyTarget: 6 });
    g.kill(6, 2);
    expect(buildView(g, 7, () => true).myBounty!.state).toBe('lost');
    for (const s of [1, 2, 3, 5]) g.kill(s, 0);
    expect(g.bountyWon).toBe(false);
  });

  it('does not win if knocked out after claiming', () => {
    const g = forced({ bountyTarget: 6 });
    g.kill(6, 7);
    g.kill(7, 0);
    for (const s of [1, 2, 3, 5]) g.kill(s, 0);
    expect(g.bountyWon).toBe(false);
  });

  it('a living hunter does not stop the captain side from winning', () => {
    const g = forced({ bountyTarget: 6 });
    for (const s of [1, 2, 3, 5]) g.kill(s, 0);
    expect(g.winner).toBe('captainTeam');
  });
});

void giveHand;
void passUntil;

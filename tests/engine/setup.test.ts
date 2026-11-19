import { Game } from '../../src/engine/Game';
import type { Role } from '../../src/engine/types';
import { defaultActionFor } from '../../src/engine/defaults';
import { makeGame } from './helpers';

/** 캐릭터 뽑기를 기본 행동으로 끝낸다 */
function finishDraft(g: Game) {
  g.start();
  while (g.pending()?.kind === 'chooseCharacter') g.apply(g.pending()!.seat, defaultActionFor(g, g.pending()!));
}

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
const count = (roles: Role[], r: Role) => roles.filter((x) => x === r).length;

describe('game setup', () => {
  it.each([
    [4, 1, 0, 2, 1],
    [5, 1, 1, 2, 1],
    [6, 1, 1, 3, 1],
    [7, 1, 2, 3, 1],
  ])('%i players role distribution', (n, cap, loy, reb, spy) => {
    const g = new Game({ seed: 5, names: names(n) });
    const roles = g.seats.map((s) => s.role);
    expect(count(roles, 'captain')).toBe(cap);
    expect(count(roles, 'loyalist')).toBe(loy);
    expect(count(roles, 'rebel')).toBe(reb);
    expect(count(roles, 'spy')).toBe(spy);
  });

  it('captain has +1 hp and hands equal hp', () => {
    const g = new Game({ seed: 9, names: names(6) });
    finishDraft(g);
    const cap = g.seats[g.captainSeat()];
    expect(cap.maxHp).toBe(cap.character.maxHp + 1);
    for (const s of g.seats) {
      expect(s.hand.length).toBe(s.hp + (s.seat === g.captainSeat() ? 2 : 0)); // 선장은 첫 턴 뽑기 2장
      expect(s.hp).toBe(s.maxHp);
    }
    const handSum = g.seats.reduce((a, s) => a + s.hand.length, 0);
    expect(g.deck.length).toBe(80 - handSum);
  });

  it('captain moves first', () => {
    const g = new Game({ seed: 3, names: names(5) });
    expect(g.current).toBe(g.captainSeat());
  });

  it('assigns unique characters', () => {
    const g = new Game({ seed: 3, names: names(7) });
    finishDraft(g);
    expect(new Set(g.seats.map((s) => s.character.id)).size).toBe(7);
  });

  it('same seed reproduces the setup', () => {
    const a = new Game({ seed: 77, names: names(5) });
    const b = new Game({ seed: 77, names: names(5) });
    const snap = (g: Game) => g.seats.map((s) => [s.role, s.character.id, s.hand.map((c) => c.id)]);
    expect(snap(a)).toEqual(snap(b));
  });

  it('draw refills from discard and never throws when both run out', () => {
    const g = makeGame(4);
    const five = g.deck.splice(0, 5);
    g.deck.length = 0;
    g.discard.push(...five);
    expect(g.draw(3).length).toBe(3);
    expect(g.draw(10).length).toBe(2);
    expect(g.draw(1).length).toBe(0);
  });
});

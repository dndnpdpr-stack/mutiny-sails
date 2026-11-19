import type { CharacterId } from '../../src/engine/types';
import { distance } from '../../src/engine/rules';
import { giveEquip, ids, makeGame, passTurn, passUntil, pull, setHand, stackTop } from './helpers';

/** 0번 자리에 지정한 캐릭터, 나머지는 능력이 끼어들지 않는 캐릭터 */
function withChar(c0: CharacterId, start = true) {
  const rest: CharacterId[] = (['derrick', 'hanna', 'orso', 'bruno', 'tom'] as CharacterId[]).filter((x) => x !== c0).slice(0, 4);
  const g = makeGame(5, { characters: [c0, ...rest] });
  if (start) g.start();
  return g;
}

describe('characters', () => {
  it('tom heals 2 with rum, capped at max', () => {
    const g = withChar('tom'); // 선장 maxHp 5
    const [r1, r2] = setHand(g, 0, ['rum', 'rum']);
    g.seats[0].hp = 2;
    g.apply(0, { type: 'playCard', cardId: r1.id });
    expect(g.seats[0].hp).toBe(4);
    g.apply(0, { type: 'playCard', cardId: r2.id });
    expect(g.seats[0].hp).toBe(5);
  });

  it('tom needs fewer rums when dying', () => {
    const g = makeGame(5, { characters: ['derrick', 'tom', 'hanna', 'orso', 'bruno'] });
    g.start();
    const [duel] = setHand(g, 0, ['duel']);
    setHand(g, 1, ['rum']);
    g.seats[1].hp = 1;
    g.apply(0, { type: 'playCard', cardId: duel.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.pending()).toEqual({ kind: 'dying', seat: 1, need: 1 });
    g.apply(1, { type: 'respond', cardIds: [g.seats[1].hand[0].id] });
    expect(g.seats[1].hp).toBe(2);
  });

  it('margo peeks at a random card before drawing, privately', () => {
    const g = withChar('margo');
    expect(g.pending()).toEqual({ kind: 'peekTarget', seat: 0 });
    expect(g.seats[0].hand.length).toBe(4);
    expect(g.apply(0, { type: 'chooseSeat', target: 0 }).ok).toBe(false);
    g.apply(0, { type: 'chooseSeat', target: 2 });
    const peek = g.events.find((e) => e.type === 'peek');
    expect(peek).toMatchObject({ seat: 0, target: 2, visibleTo: [0] });
    if (peek?.type === 'peek') expect(ids(g.seats[2].hand)).toContain(peek.card.id);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
    expect(g.seats[0].hand.length).toBe(6);
  });

  it('lou may take the first draw from the discard pile', () => {
    const g = withChar('lou', false);
    const top = pull(g, 'rum');
    g.discard.push(top);
    g.start();
    expect(g.pending()).toEqual({ kind: 'drawSource', seat: 0 });
    g.apply(0, { type: 'chooseDrawSource', fromDiscard: true });
    expect(ids(g.seats[0].hand)).toContain(top.id);
    expect(g.seats[0].hand.length).toBe(5 + 2);
  });

  it('lou is not asked when the discard pile is empty', () => {
    const g = withChar('lou');
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });

  it('derrick fires a cannonade with two slashes once per turn', () => {
    const g = withChar('derrick');
    const [a, b, c, d, e] = setHand(g, 0, ['slash', 'slash', 'slash', 'slash', 'slash']);
    expect(g.apply(0, { type: 'useAbility', cardIds: [a.id] }).ok).toBe(false);
    expect(g.apply(0, { type: 'useAbility', cardIds: [a.id, b.id] }).ok).toBe(true);
    for (const s of [1, 2, 3, 4]) {
      expect(g.pending()).toEqual({ kind: 'respondAttack', seat: s, attacker: 0, source: 'cannonade' });
      g.apply(s, { type: 'respond', cardIds: [] });
    }
    expect(g.apply(0, { type: 'useAbility', cardIds: [c.id, d.id] }).ok).toBe(false);
    expect(g.apply(0, { type: 'playCard', cardId: e.id, target: 1 }).ok).toBe(true);
  });

  it('orso keeps hp+2 cards without discarding', () => {
    const g = makeGame(5); // 3번 = 오르소 hp5
    g.start();
    passUntil(g, 3);
    expect(g.seats[3].hand.length).toBe(7);
    g.apply(3, { type: 'endTurn' });
    expect(g.pending()).toEqual({ kind: 'turn', seat: 4 });
  });

  it('nico steals a card after a slash hits', () => {
    const g = withChar('nico');
    const [slash] = setHand(g, 0, ['slash']);
    setHand(g, 1, ['rum', 'rum']);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.seats[1].hand.length).toBe(1);
    expect(g.seats[0].hand.length).toBe(1);
  });

  it('hanna is harder to reach with 3 cards in front', () => {
    const g = withChar('hanna');
    giveEquip(g, 0, 'pistol');
    giveEquip(g, 0, 'barrel');
    const before = distance(g, 2, 0);
    giveEquip(g, 0, 'spyglass');
    expect(distance(g, 2, 0)).toBe(before + 1);
  });

  it('sila flips two cards and picks one for judgment', () => {
    const g = makeGame(5, { characters: ['derrick', 'sila', 'hanna', 'orso', 'bruno'] });
    g.start();
    giveEquip(g, 1, 'powderKeg');
    const [, heart] = stackTop(g, [
      { kind: 'rum', suit: 'spades', rank: 5 },
      { kind: 'rum', suit: 'hearts', rank: 5 },
    ]);
    passTurn(g);
    const p = g.pending();
    expect(p?.kind).toBe('judgeChoice');
    if (p?.kind !== 'judgeChoice') return;
    expect(p.options.length).toBe(2);
    g.apply(1, { type: 'chooseCard', cardId: heart.id });
    expect(g.seats[1].hp).toBe(3);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 1 });
  });

  it('bibi passes the keg to anyone without judging', () => {
    const g = makeGame(5, { characters: ['derrick', 'bibi', 'hanna', 'orso', 'bruno'] });
    g.start();
    const keg = giveEquip(g, 1, 'powderKeg');
    passTurn(g);
    expect(g.pending()).toEqual({ kind: 'passKeg', seat: 1 });
    expect(g.apply(1, { type: 'chooseSeat', target: 1 }).ok).toBe(false);
    g.apply(1, { type: 'chooseSeat', target: 3 });
    expect(ids(g.seats[3].equipment)).toContain(keg.id);
    expect(g.events.some((e) => e.type === 'judge')).toBe(false);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 1 });
  });

  it('bruno forces duel opponents to throw two slashes', () => {
    const g = makeGame(5); // 1번 = 브루노
    g.start();
    const [duel] = setHand(g, 0, ['duel']);
    const [s] = setHand(g, 1, ['slash']);
    g.apply(0, { type: 'playCard', cardId: duel.id, target: 1 });
    expect(g.pending()).toEqual({ kind: 'respondDuel', seat: 1, opponent: 0, required: 1 });
    g.apply(1, { type: 'respond', cardIds: [s.id] });
    expect(g.pending()).toEqual({ kind: 'respondDuel', seat: 0, opponent: 1, required: 2 });
  });
});

import type { Game } from '../../src/engine/Game';
import { giveEquip, ids, makeGame, passTurn, setHand, stackTop } from './helpers';

/** 5명: 0 선장(데릭 hp5), 1 반란(브루노 4), 2 반란(한나 4), 3 첩자(오르소 5), 4 충성(톰 4) */
function started(): Game {
  const g = makeGame(5);
  g.start();
  return g;
}

describe('weapons and equipment', () => {
  it('new weapon replaces the old one', () => {
    const g = started();
    const [pistol, musket] = setHand(g, 0, ['pistol', 'musket']);
    g.apply(0, { type: 'playCard', cardId: pistol.id });
    g.apply(0, { type: 'playCard', cardId: musket.id });
    expect(ids(g.seats[0].equipment)).toEqual([musket.id]);
    expect(ids(g.discard)).toContain(pistol.id);
  });

  it('rejects a duplicate of the same equipment', () => {
    const g = started();
    giveEquip(g, 0, 'dinghy');
    const [boat] = setHand(g, 0, ['dinghy']);
    expect(g.apply(0, { type: 'playCard', cardId: boat.id }).ok).toBe(false);
  });

  it('twin pistols allow unlimited slashes', () => {
    const g = started();
    giveEquip(g, 0, 'twinPistols');
    const slashes = setHand(g, 0, ['slash', 'slash', 'slash']);
    const targets = [1, 4, 1];
    slashes.forEach((s, i) => {
      expect(g.apply(0, { type: 'playCard', cardId: s.id, target: targets[i] }).ok).toBe(true);
      g.apply(targets[i], { type: 'respond', cardIds: [] });
    });
    expect(g.seats[1].hp).toBe(2);
  });
});

describe('barrel', () => {
  it('heart judgment dodges without asking', () => {
    const g = started();
    giveEquip(g, 1, 'barrel');
    const [slash] = setHand(g, 0, ['slash']);
    stackTop(g, [{ kind: 'rum', suit: 'hearts' }]);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
    expect(g.seats[1].hp).toBe(4);
    expect(g.events.find((e) => e.type === 'judge')).toMatchObject({ seat: 1, success: true, reason: 'barrel' });
  });
  it('failed judgment still lets the target dodge', () => {
    const g = started();
    giveEquip(g, 1, 'barrel');
    const [slash] = setHand(g, 0, ['slash']);
    stackTop(g, [{ kind: 'rum', suit: 'clubs' }]);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    expect(g.pending()).toEqual({ kind: 'respondAttack', seat: 1, attacker: 0, source: 'slash' });
  });
});

describe('powder keg', () => {
  it('explodes on spade 2-9 for 3 damage', () => {
    const g = started();
    const keg = giveEquip(g, 1, 'powderKeg');
    stackTop(g, [{ kind: 'rum', suit: 'spades', rank: 5 }]);
    passTurn(g);
    expect(g.seats[1].hp).toBe(1);
    expect(ids(g.seats[1].equipment)).not.toContain(keg.id);
    expect(ids(g.discard)).toContain(keg.id);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 1 });
  });
  it('otherwise passes to the next player', () => {
    const g = started();
    const keg = giveEquip(g, 1, 'powderKeg');
    stackTop(g, [{ kind: 'rum', suit: 'spades', rank: 10 }]);
    passTurn(g);
    expect(g.seats[1].hp).toBe(4);
    expect(ids(g.seats[2].equipment)).toContain(keg.id);
  });
  it('can be played on yourself', () => {
    const g = started();
    const [keg] = setHand(g, 0, ['powderKeg']);
    expect(g.apply(0, { type: 'playCard', cardId: keg.id }).ok).toBe(true);
    expect(ids(g.seats[0].equipment)).toContain(keg.id);
  });
  it('explosion death has no killer and no reward; turn moves on', () => {
    const g = started();
    giveEquip(g, 1, 'powderKeg');
    setHand(g, 1, []);
    g.seats[1].hp = 3;
    stackTop(g, [{ kind: 'rum', suit: 'spades', rank: 5 }]);
    g.apply(0, { type: 'endTurn' });
    const p = g.pending();
    if (p?.kind === 'discardExcess') g.apply(0, { type: 'discard', cardIds: g.seats[0].hand.slice(0, p.count).map((c) => c.id) });
    const handsBefore = g.seats.map((s) => s.hand.length);
    expect(g.pending()).toEqual({ kind: 'dying', seat: 1, need: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.seats[1].alive).toBe(false);
    expect(g.events.find((e) => e.type === 'death')).toMatchObject({ seat: 1, killer: null });
    expect(g.current).toBe(2);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 2 });
    // 2번은 자기 턴에 2장 뽑음, 나머지는 그대로
    expect(g.seats[0].hand.length).toBe(handsBefore[0]);
    expect(g.seats[3].hand.length).toBe(handsBefore[3]);
  });
});

describe('brig', () => {
  it('cannot target the captain or yourself', () => {
    const g = started();
    const [brig] = setHand(g, 0, ['brig']);
    expect(g.apply(0, { type: 'playCard', cardId: brig.id, target: 0 }).ok).toBe(false);
    passTurn(g);
    const [brig2] = setHand(g, 1, ['brig']);
    expect(g.apply(1, { type: 'playCard', cardId: brig2.id, target: 0 }).ok).toBe(false);
  });
  it('failed judgment skips the turn and discards the brig', () => {
    const g = started();
    const [brig] = setHand(g, 0, ['brig']);
    expect(g.apply(0, { type: 'playCard', cardId: brig.id, target: 1 }).ok).toBe(true);
    expect(ids(g.seats[1].equipment)).toContain(brig.id);
    stackTop(g, [{ kind: 'rum', suit: 'diamonds' }]);
    passTurn(g);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 2 });
    expect(ids(g.discard)).toContain(brig.id);
  });
  it('heart judgment frees the prisoner', () => {
    const g = started();
    const [brig] = setHand(g, 0, ['brig']);
    g.apply(0, { type: 'playCard', cardId: brig.id, target: 1 });
    stackTop(g, [{ kind: 'rum', suit: 'hearts' }]);
    passTurn(g);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 1 });
    expect(ids(g.seats[1].equipment)).not.toContain(brig.id);
  });
  it('keg is judged before brig', () => {
    const g = started();
    giveEquip(g, 1, 'powderKeg');
    giveEquip(g, 1, 'brig');
    stackTop(g, [{ kind: 'rum', suit: 'hearts' }, { kind: 'rum', suit: 'hearts' }]);
    passTurn(g);
    expect(g.events.filter((e) => e.type === 'judge').map((e) => (e.type === 'judge' ? e.reason : ''))).toEqual(['powderKeg', 'brig']);
  });
});

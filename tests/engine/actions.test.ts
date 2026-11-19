import type { Game } from '../../src/engine/Game';
import type { PendingView } from '../../src/engine/types';
import { giveEquip, ids, makeGame, setHand } from './helpers';

/** 5명: 0 선장(데릭 hp5), 1 반란(브루노 4), 2 반란(한나 4), 3 첩자(오르소 5), 4 충성(톰 4) */
function started(): Game {
  const g = makeGame(5);
  g.start();
  return g;
}

const seatOf = (p: PendingView | null) => p?.seat;

describe('cannonade', () => {
  it('asks everyone else in seat order; dodge avoids damage', () => {
    const g = started();
    const [cannon] = setHand(g, 0, ['cannonade']);
    const [dodge] = setHand(g, 2, ['dodge']);
    g.apply(0, { type: 'playCard', cardId: cannon.id });
    const order: number[] = [];
    for (let i = 0; i < 4; i++) {
      const p = g.pending()!;
      expect(p.kind).toBe('respondAttack');
      order.push(p.seat);
      g.apply(p.seat, { type: 'respond', cardIds: p.seat === 2 ? [dodge.id] : [] });
    }
    expect(order).toEqual([1, 2, 3, 4]);
    expect(g.seats.map((s) => s.hp)).toEqual([5, 3, 4, 4, 3]);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });
  it('does not count as a slash', () => {
    const g = started();
    const [cannon, slash] = setHand(g, 0, ['cannonade', 'slash']);
    g.apply(0, { type: 'playCard', cardId: cannon.id });
    for (let i = 0; i < 4; i++) g.apply(seatOf(g.pending())!, { type: 'respond', cardIds: [] });
    expect(g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 }).ok).toBe(true);
  });
});

describe('brawl', () => {
  it('slash avoids damage', () => {
    const g = started();
    const [brawl] = setHand(g, 0, ['brawl']);
    const [s1] = setHand(g, 1, ['slash']);
    g.apply(0, { type: 'playCard', cardId: brawl.id });
    expect(g.pending()).toEqual({ kind: 'respondBrawl', seat: 1, attacker: 0 });
    g.apply(1, { type: 'respond', cardIds: [s1.id] });
    for (let i = 0; i < 3; i++) g.apply(seatOf(g.pending())!, { type: 'respond', cardIds: [] });
    expect(g.seats.map((s) => s.hp)).toEqual([5, 4, 3, 4, 3]);
  });
});

describe('duel', () => {
  it('target answers first, then actor; whoever declines loses 1', () => {
    const g = started();
    const [duel] = setHand(g, 0, ['duel']);
    const [t] = setHand(g, 3, ['slash']);
    g.apply(0, { type: 'playCard', cardId: duel.id, target: 3 });
    expect(g.pending()).toEqual({ kind: 'respondDuel', seat: 3, opponent: 0, required: 1 });
    g.apply(3, { type: 'respond', cardIds: [t.id] });
    expect(g.pending()).toEqual({ kind: 'respondDuel', seat: 0, opponent: 3, required: 1 });
    g.apply(0, { type: 'respond', cardIds: [] });
    expect(g.seats[0].hp).toBe(4);
    expect(g.events.filter((e) => e.type === 'damage').at(-1)).toMatchObject({ seat: 0, source: 3 });
  });
  it('ignores distance', () => {
    const g = started();
    const [duel] = setHand(g, 0, ['duel']);
    expect(g.apply(0, { type: 'playCard', cardId: duel.id, target: 2 }).ok).toBe(true);
  });
});

describe('pickpocket', () => {
  it('only at distance 1', () => {
    const g = started();
    const [pp] = setHand(g, 0, ['pickpocket']);
    expect(g.apply(0, { type: 'playCard', cardId: pp.id, target: 2 }).ok).toBe(false);
  });
  it('takes a chosen equipment card', () => {
    const g = started();
    const [pp] = setHand(g, 0, ['pickpocket']);
    const gun = giveEquip(g, 1, 'pistol');
    expect(g.apply(0, { type: 'playCard', cardId: pp.id, target: 1, targetCardId: gun.id }).ok).toBe(true);
    expect(ids(g.seats[0].hand)).toContain(gun.id);
    expect(g.seats[1].equipment.length).toBe(0);
  });
  it('takes a random hand card when no card chosen', () => {
    const g = started();
    const [pp] = setHand(g, 0, ['pickpocket']);
    setHand(g, 1, ['dodge', 'rum']);
    g.apply(0, { type: 'playCard', cardId: pp.id, target: 1 });
    expect(g.seats[1].hand.length).toBe(1);
    expect(g.seats[0].hand.length).toBe(1);
  });
  it('rejects a target with nothing to take', () => {
    const g = started();
    const [pp] = setHand(g, 0, ['pickpocket']);
    setHand(g, 1, []);
    expect(g.apply(0, { type: 'playCard', cardId: pp.id, target: 1 }).ok).toBe(false);
  });
});

describe('cut rope', () => {
  it('discards from any distance', () => {
    const g = started();
    const [cut] = setHand(g, 0, ['cutRope']);
    const gun = giveEquip(g, 2, 'pistol');
    expect(g.apply(0, { type: 'playCard', cardId: cut.id, target: 2, targetCardId: gun.id }).ok).toBe(true);
    expect(g.seats[2].equipment.length).toBe(0);
    expect(ids(g.discard)).toContain(gun.id);
  });
  it('rejects a target with no cards', () => {
    const g = started();
    const [cut] = setHand(g, 0, ['cutRope']);
    setHand(g, 2, []);
    expect(g.apply(0, { type: 'playCard', cardId: cut.id, target: 2 }).ok).toBe(false);
  });
});

describe('draw cards', () => {
  it('supply ship nets +1, merchant raid nets +2', () => {
    const g = started();
    const [ship, raid] = setHand(g, 0, ['supplyShip', 'merchantRaid']);
    g.apply(0, { type: 'playCard', cardId: ship.id });
    expect(g.seats[0].hand.length).toBe(1 + 2);
    g.apply(0, { type: 'playCard', cardId: raid.id });
    expect(g.seats[0].hand.length).toBe(2 + 3);
  });
  it('merchant raid with empty deck and discard draws nothing', () => {
    const g = started();
    const [raid] = setHand(g, 0, ['merchantRaid']);
    g.deck.length = 0;
    g.discard.length = 0;
    expect(g.apply(0, { type: 'playCard', cardId: raid.id }).ok).toBe(true);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });
});

describe('feast', () => {
  it('heals the hurt by 1 up to max', () => {
    const g = started();
    const [feast] = setHand(g, 0, ['feast']);
    g.seats[1].hp = 2;
    g.apply(0, { type: 'playCard', cardId: feast.id });
    expect(g.seats.map((s) => s.hp)).toEqual([5, 3, 4, 5, 4]);
  });
});

describe('loot', () => {
  it('reveals one per living player and everyone picks once', () => {
    const g = started();
    const [loot] = setHand(g, 0, ['loot']);
    const before = g.seats.map((s) => s.hand.length);
    g.apply(0, { type: 'playCard', cardId: loot.id });
    const first = g.pending()!;
    expect(first.kind).toBe('loot');
    if (first.kind !== 'loot') return;
    expect(first.revealed.length).toBe(5);
    expect(first.seat).toBe(0);
    for (let i = 0; i < 4; i++) {
      const p = g.pending()!;
      if (p.kind !== 'loot') throw new Error('expected loot');
      g.apply(p.seat, { type: 'chooseCard', cardId: p.revealed[0].id });
    }
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
    const after = g.seats.map((s) => s.hand.length);
    expect(after).toEqual([before[0] - 1 + 1, before[1] + 1, before[2] + 1, before[3] + 1, before[4] + 1]);
  });
  it('with only 2 cards left reveals 2 and stops', () => {
    const g = started();
    const [loot] = setHand(g, 0, ['loot']);
    g.discard.length = 0;
    g.deck.splice(0, g.deck.length - 1); // 덱 1장 + 방금 버린 전리품 분배 1장 = 2장
    g.apply(0, { type: 'playCard', cardId: loot.id });
    const p = g.pending()!;
    if (p.kind !== 'loot') throw new Error('expected loot');
    expect(p.revealed.length).toBe(2);
    g.apply(0, { type: 'chooseCard', cardId: p.revealed[0].id });
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });
});

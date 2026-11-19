import type { Game } from '../../src/engine/Game';
import { ids, makeGame, setHand } from './helpers';

/** 5명: 0 선장(데릭 hp5), 1 반란(브루노 4), 2 반란(한나 4), 3 첩자(오르소 5), 4 충성(톰 4) */
function started(): Game {
  const g = makeGame(5);
  g.start();
  return g;
}

function snapshot(g: Game) {
  return { events: g.events.length, hands: g.seats.map((s) => ids(s.hand)), hp: g.seats.map((s) => s.hp) };
}

describe('turn flow', () => {
  it('captain draws 2 at turn start and waits for a turn action', () => {
    const g = started();
    expect(g.seats[0].hand.length).toBe(5 + 2);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });

  it('slash answered by dodge deals no damage and discards both', () => {
    const g = started();
    const [slash] = setHand(g, 0, ['slash']);
    const [dodge] = setHand(g, 1, ['dodge']);
    expect(g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 })).toEqual({ ok: true });
    expect(g.pending()).toEqual({ kind: 'respondAttack', seat: 1, attacker: 0, source: 'slash' });
    expect(g.apply(1, { type: 'respond', cardIds: [dodge.id] })).toEqual({ ok: true });
    expect(g.seats[1].hp).toBe(4);
    expect(ids(g.discard)).toEqual(expect.arrayContaining([slash.id, dodge.id]));
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });

  it('slash taken loses 1 hp with attacker as source', () => {
    const g = started();
    const [slash] = setHand(g, 0, ['slash']);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.seats[1].hp).toBe(3);
    expect(g.events.at(-1)).toMatchObject({ type: 'damage', seat: 1, amount: 1, source: 0 });
  });

  it('only one slash per turn', () => {
    const g = started();
    const [a, b] = setHand(g, 0, ['slash', 'slash']);
    g.apply(0, { type: 'playCard', cardId: a.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    const r = g.apply(0, { type: 'playCard', cardId: b.id, target: 4 });
    expect(r.ok).toBe(false);
    expect(ids(g.seats[0].hand)).toContain(b.id);
  });

  it('rejects slash out of range', () => {
    const g = started();
    const [slash] = setHand(g, 0, ['slash']);
    expect(g.apply(0, { type: 'playCard', cardId: slash.id, target: 2 }).ok).toBe(false);
  });

  describe('illegal actions leave state unchanged', () => {
    it('play out of turn', () => {
      const g = started();
      const [slash] = setHand(g, 1, ['slash']);
      const before = snapshot(g);
      expect(g.apply(1, { type: 'playCard', cardId: slash.id, target: 0 }).ok).toBe(false);
      expect(snapshot(g)).toEqual(before);
    });
    it('attacker ends turn while target must respond', () => {
      const g = started();
      const [slash] = setHand(g, 0, ['slash']);
      g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
      const before = snapshot(g);
      expect(g.apply(0, { type: 'endTurn' }).ok).toBe(false);
      expect(snapshot(g)).toEqual(before);
    });
    it('card not in hand', () => {
      const g = started();
      setHand(g, 0, ['slash']);
      const other = g.seats[1].hand[0];
      const before = snapshot(g);
      expect(g.apply(0, { type: 'playCard', cardId: other.id, target: 1 }).ok).toBe(false);
      expect(snapshot(g)).toEqual(before);
    });
    it('same respond sent twice', () => {
      const g = started();
      const [slash] = setHand(g, 0, ['slash']);
      g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
      expect(g.apply(1, { type: 'respond', cardIds: [] }).ok).toBe(true);
      const before = snapshot(g);
      expect(g.apply(1, { type: 'respond', cardIds: [] }).ok).toBe(false);
      expect(snapshot(g)).toEqual(before);
    });
  });

  it('rum heals only when hurt and not with two players left', () => {
    const g = started();
    const [rum] = setHand(g, 0, ['rum']);
    expect(g.apply(0, { type: 'playCard', cardId: rum.id }).ok).toBe(false);
    g.seats[0].hp = 3;
    expect(g.apply(0, { type: 'playCard', cardId: rum.id }).ok).toBe(true);
    expect(g.seats[0].hp).toBe(4);
    const [rum2] = setHand(g, 0, ['rum']);
    for (const s of [2, 3, 4]) g.seats[s].alive = false;
    expect(g.apply(0, { type: 'playCard', cardId: rum2.id }).ok).toBe(false);
  });

  it('end turn with too many cards asks to discard, then next seat plays', () => {
    const g = started();
    g.seats[0].hp = 4;
    setHand(g, 0, ['slash', 'slash', 'dodge', 'dodge', 'rum', 'rum']);
    g.apply(0, { type: 'endTurn' });
    expect(g.pending()).toEqual({ kind: 'discardExcess', seat: 0, count: 2 });
    const two = g.seats[0].hand.slice(0, 2).map((c) => c.id);
    expect(g.apply(0, { type: 'discard', cardIds: [two[0]] }).ok).toBe(false);
    expect(g.apply(0, { type: 'discard', cardIds: two }).ok).toBe(true);
    expect(g.seats[0].hand.length).toBe(4);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 1 });
    expect(g.current).toBe(1);
  });

  it('dying player can drink rum to survive', () => {
    const g = started();
    const [slash] = setHand(g, 0, ['slash']);
    const [rum] = setHand(g, 1, ['rum']);
    g.seats[1].hp = 1;
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.pending()).toEqual({ kind: 'dying', seat: 1, need: 1 });
    expect(g.apply(1, { type: 'respond', cardIds: [rum.id] }).ok).toBe(true);
    expect(g.seats[1].hp).toBe(1);
    expect(g.seats[1].alive).toBe(true);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });

  it('dying player without rum goes down', () => {
    const g = started();
    const [slash] = setHand(g, 0, ['slash']);
    setHand(g, 1, []);
    g.seats[1].hp = 1;
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.seats[1].alive).toBe(false);
  });
});

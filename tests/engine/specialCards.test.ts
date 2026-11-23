import type { Game } from '../../src/engine/Game';
import { Rng } from '../../src/engine/rng';
import { buildDeckSpec } from '../../src/engine/cards/deck';
import { CARD_CATALOG } from '../../src/engine/cards/catalog';
import { buildView } from '../../src/host/view';
import { defaultActionFor } from '../../src/engine/defaults';
import { giveEquip, ids, makeGame, setHand, stackTop } from './helpers';

const noAi = () => false;
const NEW = ['parrotTattle', 'treasureMap', 'diceWager', 'fireShip', 'walkPlank', 'leatherCoat', 'harpoon', 'compass', 'luckyCoin', 'blackFlag'] as const;

/** 5명: 0 선장(데릭 hp5), 1 반란(브루노 4), 2 반란(한나 4), 3 첩자(오르소 5), 4 충성(톰 4) */
function started(): Game {
  const g = makeGame(5, { expansionCards: true });
  g.start();
  return g;
}

describe('expansion deck', () => {
  it('is off by default and leaves the base deck unchanged', () => {
    const base = buildDeckSpec(new Rng(7));
    expect(base).toHaveLength(80);
    expect(base.some((c) => (NEW as readonly string[]).includes(c.kind))).toBe(false);
    expect(buildDeckSpec(new Rng(7), false)).toEqual(base);
  });

  it('adds 16 cards for 96 in all, with every new kind at its count', () => {
    const deck = buildDeckSpec(new Rng(7), true);
    expect(deck).toHaveLength(96);
    expect(new Set(deck.map((c) => c.id)).size).toBe(96);
    for (const k of NEW) {
      expect(CARD_CATALOG[k].expansion).toBe(true);
      expect(deck.filter((c) => c.kind === k)).toHaveLength(CARD_CATALOG[k].count);
    }
    expect(NEW.reduce((n, k) => n + CARD_CATALOG[k].count, 0)).toBe(16);
  });

  it('the game uses the expansion deck when asked', () => {
    expect(makeGame(4, { expansionCards: true }).deck.length + 4 * 0).toBeGreaterThan(makeGame(4).deck.length);
  });
});

describe('parrot tattle', () => {
  it('shows me (only me) the role of a non-captain', () => {
    const g = started();
    const [card] = setHand(g, 4, []).concat(setHand(g, 0, ['parrotTattle']));
    expect(g.apply(0, { type: 'playCard', cardId: card.id, target: 3 }).ok).toBe(true);
    expect(buildView(g, 0, noAi).seats[3].role).toBe('spy');
    expect(buildView(g, 1, noAi).seats[3].role).toBeNull();
    const ev = g.events.find((e) => e.type === 'roleRevealed');
    expect(ev).toMatchObject({ seat: 0, target: 3, role: 'spy', visibleTo: [0] });
  });

  it('cannot target the captain', () => {
    const g = started();
    g.apply(0, { type: 'endTurn' });
    const p = g.pending();
    if (p?.kind === 'discardExcess') g.apply(0, defaultActionFor(g, p));
    const [card] = setHand(g, 1, ['parrotTattle']);
    expect(g.apply(1, { type: 'playCard', cardId: card.id, target: 0 }).ok).toBe(false);
  });
});

describe('treasure map', () => {
  it('lets me privately keep one of the top 3 and discards the rest', () => {
    const g = started();
    const [map] = setHand(g, 0, ['treasureMap']);
    const top = stackTop(g, [{ kind: 'rum' }, { kind: 'dodge' }, { kind: 'duel' }]);
    g.apply(0, { type: 'playCard', cardId: map.id });
    expect(g.pending()).toMatchObject({ kind: 'treasureMap', seat: 0 });
    expect(buildView(g, 1, noAi).pending).toEqual({ kind: 'treasureMap', seat: 0, revealed: [] });
    expect(g.apply(0, { type: 'chooseCard', cardId: 'nope' }).ok).toBe(false);
    expect(g.apply(0, { type: 'chooseCard', cardId: top[1].id }).ok).toBe(true);
    expect(ids(g.seats[0].hand)).toEqual([top[1].id]);
    expect(ids(g.discard)).toEqual(expect.arrayContaining([top[0].id, top[2].id]));
    // 버린 2장도 나만 안다
    expect(g.events.filter((e) => e.type === 'discardCards' && e.seat === 0).every((e) => e.visibleTo?.length === 1 && e.visibleTo[0] === 0)).toBe(true);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });

  it('the default action keeps the first card', () => {
    const g = started();
    const [map] = setHand(g, 0, ['treasureMap']);
    g.apply(0, { type: 'playCard', cardId: map.id });
    const p = g.pending()!;
    expect(g.apply(0, defaultActionFor(g, p)).ok).toBe(true);
  });
});

describe('dice wager', () => {
  it('the higher flip takes a random hand card from the other', () => {
    const g = started();
    const [wager] = setHand(g, 0, ['diceWager']);
    const [rum] = setHand(g, 1, ['rum']);
    stackTop(g, [{ kind: 'slash', rank: 12 }, { kind: 'slash', rank: 3 }]);
    g.apply(0, { type: 'playCard', cardId: wager.id, target: 1 });
    expect(ids(g.seats[0].hand)).toEqual([rum.id]);
    expect(g.seats[1].hand).toHaveLength(0);
    expect(g.events.find((e) => e.type === 'wager')).toMatchObject({ seat: 0, target: 1 });
  });

  it('a loss gives the target one of my cards; a tie does nothing', () => {
    const g = started();
    const [wager, dodge] = setHand(g, 0, ['diceWager', 'dodge']);
    setHand(g, 1, []);
    stackTop(g, [{ kind: 'slash', rank: 2 }, { kind: 'slash', rank: 9 }]);
    g.apply(0, { type: 'playCard', cardId: wager.id, target: 1 });
    expect(ids(g.seats[1].hand)).toEqual([dodge.id]);

    const [w2, keep] = setHand(g, 0, ['diceWager', 'rum']);
    stackTop(g, [{ kind: 'slash', rank: 5 }, { kind: 'slash', rank: 5 }]);
    g.apply(0, { type: 'playCard', cardId: w2.id, target: 1 });
    expect(ids(g.seats[0].hand)).toEqual([keep.id]);
  });
});

describe('fire ship', () => {
  it('attacks the target and its neighbours except me', () => {
    const g = started();
    const [fire] = setHand(g, 0, ['fireShip']);
    for (const s of [1, 2, 3, 4]) setHand(g, s, []);
    // 0번 사거리 1: 1번(이웃 0, 2) → 1, 2만
    expect(g.apply(0, { type: 'playCard', cardId: fire.id, target: 1 }).ok).toBe(true);
    expect(g.pending()).toMatchObject({ kind: 'respondAttack', seat: 1, source: 'fireShip' });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.pending()).toMatchObject({ kind: 'respondAttack', seat: 2, source: 'fireShip' });
    g.apply(2, { type: 'respond', cardIds: [] });
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
    expect([g.seats[1].hp, g.seats[2].hp, g.seats[4].hp]).toEqual([3, 3, 4]);
  });

  it('needs the target in range', () => {
    const g = started();
    const [fire] = setHand(g, 0, ['fireShip']);
    expect(g.apply(0, { type: 'playCard', cardId: fire.id, target: 2 }).ok).toBe(false);
  });
});

describe('walk the plank', () => {
  it('whoever holds the most cards discards 2 of their choice', () => {
    const g = started();
    const [plank] = setHand(g, 0, ['walkPlank']);
    setHand(g, 1, ['slash', 'slash', 'rum']);
    setHand(g, 2, ['dodge']);
    setHand(g, 3, ['slash', 'dodge', 'duel']);
    setHand(g, 4, []);
    g.apply(0, { type: 'playCard', cardId: plank.id });
    expect(g.pending()).toEqual({ kind: 'discardExcess', seat: 1, count: 2 });
    g.apply(1, { type: 'discard', cardIds: ids(g.seats[1].hand.slice(0, 2)) });
    expect(g.pending()).toEqual({ kind: 'discardExcess', seat: 3, count: 2 });
    g.apply(3, { type: 'discard', cardIds: ids(g.seats[3].hand.slice(1)) });
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
    expect([g.seats[1].hand.length, g.seats[3].hand.length]).toEqual([1, 1]);
  });
});

describe('leather coat', () => {
  it('absorbs the hit when I do not dodge, then is discarded', () => {
    const g = started();
    const coat = giveEquip(g, 1, 'leatherCoat');
    const [slash] = setHand(g, 0, ['slash']);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.seats[1].hp).toBe(4);
    expect(g.seats[1].equipment).toHaveLength(0);
    expect(ids(g.discard)).toContain(coat.id);
    expect(g.events.find((e) => e.type === 'gearUsed')).toMatchObject({ seat: 1, card: { kind: 'leatherCoat' } });
  });
});

describe('harpoon', () => {
  it('is a range-2 weapon whose slash hit also discards a random hand card', () => {
    const g = started();
    giveEquip(g, 0, 'harpoon');
    const [slash] = setHand(g, 0, ['slash']);
    setHand(g, 2, ['rum']);
    expect(g.apply(0, { type: 'playCard', cardId: slash.id, target: 2 }).ok).toBe(true);
    g.apply(2, { type: 'respond', cardIds: [] });
    expect(g.seats[2].hp).toBe(3);
    expect(g.seats[2].hand).toHaveLength(0);
  });
});

describe('compass and lucky coin', () => {
  it('compass flips two cards for a judgment', () => {
    const g = started();
    giveEquip(g, 1, 'barrel');
    giveEquip(g, 1, 'compass');
    const [slash] = setHand(g, 0, ['slash']);
    stackTop(g, [{ suit: 'clubs' }, { suit: 'hearts' }]);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    expect(g.pending()).toMatchObject({ kind: 'judgeChoice', seat: 1, reason: 'barrel' });
  });

  it('lucky coin turns a bad judgment good and is discarded', () => {
    const g = started();
    giveEquip(g, 1, 'barrel');
    const coin = giveEquip(g, 1, 'luckyCoin');
    const [slash] = setHand(g, 0, ['slash']);
    stackTop(g, [{ suit: 'clubs' }]);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
    expect(ids(g.discard)).toContain(coin.id);
    expect(g.events.find((e) => e.type === 'judge')).toMatchObject({ seat: 1, success: true });
  });

  it('lucky coin stays when the judgment is already good', () => {
    const g = started();
    giveEquip(g, 1, 'barrel');
    giveEquip(g, 1, 'luckyCoin');
    const [slash] = setHand(g, 0, ['slash']);
    stackTop(g, [{ suit: 'hearts' }]);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    expect(g.seats[1].equipment.map((c) => c.kind)).toContain('luckyCoin');
  });
});

describe('black flag', () => {
  it('gives 2 extra cards for a kill', () => {
    const g = started();
    giveEquip(g, 0, 'blackFlag');
    setHand(g, 4, []);
    g.seats[4].hp = 1;
    const [slash] = setHand(g, 0, ['slash']);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 4 });
    g.apply(4, { type: 'respond', cardIds: [] });
    if (g.pending()?.kind === 'dying') g.apply(4, { type: 'respond', cardIds: [] });
    expect(g.seats[4].alive).toBe(false);
    // 선장이 충성 선원을 쓰러뜨리면 모두 버리지만 깃발 보상 2장은 그 뒤에 받는다
    expect(g.seats[0].hand).toHaveLength(2);
  });
});

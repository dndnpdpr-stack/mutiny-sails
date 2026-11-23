import type { CharacterId } from '../../src/engine/types';
import { slashLimit } from '../../src/engine/rules';
import { buildView } from '../../src/host/view';
import { defaultActionFor } from '../../src/engine/defaults';
import { giveEquip, ids, makeGame, setHand, stackTop } from './helpers';

const noAi = () => false;
/** 5명: 0 선장, 1 반란, 2 반란, 3 첩자, 4 충성. chars는 0번부터 */
function game(chars: CharacterId[]) {
  const all: CharacterId[] = [...chars, ...(['derrick', 'bruno', 'hanna', 'orso', 'tom'] as CharacterId[]).filter((c) => !chars.includes(c))].slice(0, 5);
  const g = makeGame(5, { characters: all, expansionCards: true });
  g.start();
  return g;
}

describe('dorothy', () => {
  it('spends a rum to heal someone else once per turn', () => {
    const g = game(['dorothy']);
    const [rum, rum2] = setHand(g, 0, ['rum', 'rum']);
    g.seats[1].hp = 2;
    g.seats[2].hp = 2;
    expect(g.apply(0, { type: 'useAbility', cardIds: [rum.id], target: 1 }).ok).toBe(true);
    expect(g.seats[1].hp).toBe(3);
    expect(ids(g.discard)).toContain(rum.id);
    expect(g.apply(0, { type: 'useAbility', cardIds: [rum2.id], target: 2 }).ok).toBe(false);
  });

  it('rejects a full-health target, a non-rum card and myself', () => {
    const g = game(['dorothy']);
    const [rum, slash] = setHand(g, 0, ['rum', 'slash']);
    g.seats[0].hp = 1;
    expect(g.apply(0, { type: 'useAbility', cardIds: [rum.id], target: 1 }).ok).toBe(false);
    g.seats[1].hp = 1;
    expect(g.apply(0, { type: 'useAbility', cardIds: [slash.id], target: 1 }).ok).toBe(false);
    expect(g.apply(0, { type: 'useAbility', cardIds: [rum.id], target: 0 }).ok).toBe(false);
  });
});

describe('ori', () => {
  it('looks at the top card before drawing and may send it to the bottom; others cannot see it', () => {
    const g = makeGame(5, { characters: ['ori', 'bruno', 'hanna', 'orso', 'tom'] });
    const top = g.deck.at(-1)!;
    g.start();
    expect(g.pending()).toEqual({ kind: 'fortune', seat: 0, card: top.toView() });
    expect(buildView(g, 1, noAi).pending).toEqual({ kind: 'fortune', seat: 0, card: null });
    expect(g.apply(0, { type: 'fortune', toBottom: true }).ok).toBe(true);
    expect(g.deck[0].id).toBe(top.id);
    expect(g.seats[0].hand.some((c) => c.id === top.id)).toBe(false);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 0 });
  });

  it('keeping it means drawing it', () => {
    const g = makeGame(5, { characters: ['ori', 'bruno', 'hanna', 'orso', 'tom'] });
    const top = g.deck.at(-1)!;
    g.start();
    expect(defaultActionFor(g, g.pending()!)).toEqual({ type: 'fortune', toBottom: false });
    g.apply(0, { type: 'fortune', toBottom: false });
    expect(g.seats[0].hand.some((c) => c.id === top.id)).toBe(true);
  });
});

describe('felix', () => {
  it('ignores cannonades without being asked', () => {
    const g = game(['derrick', 'felix']);
    const [cannon] = setHand(g, 0, ['cannonade']);
    g.apply(0, { type: 'playCard', cardId: cannon.id });
    while (g.pending()?.kind === 'respondAttack') {
      expect(g.pending()?.seat).not.toBe(1);
      g.apply(g.pending()!.seat, { type: 'respond', cardIds: [] });
    }
    expect(g.seats[1].hp).toBe(g.seats[1].maxHp);
  });
});

describe('tara', () => {
  it('draws one card at the end of a turn without slashes', () => {
    const g = game(['tara']);
    setHand(g, 0, []);
    g.apply(0, { type: 'endTurn' });
    expect(g.seats[0].hand).toHaveLength(1);
    expect(g.current).toBe(1);
  });

  it('draws nothing after slashing', () => {
    const g = game(['tara']);
    const [slash] = setHand(g, 0, ['slash']);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    g.apply(0, { type: 'endTurn' });
    expect(g.seats[0].hand).toHaveLength(0);
  });
});

describe('luca', () => {
  it('draws a card when his judgment shows clubs', () => {
    const g = game(['derrick', 'luca']);
    giveEquip(g, 1, 'barrel');
    setHand(g, 1, []);
    const [slash] = setHand(g, 0, ['slash']);
    stackTop(g, [{ suit: 'clubs' }]);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    expect(g.seats[1].hand).toHaveLength(1);
  });
});

describe('gordon', () => {
  it('a red judgment cancels a pickpocket', () => {
    const g = game(['derrick', 'gordon']);
    const [rum] = setHand(g, 1, ['rum']);
    const [pp] = setHand(g, 0, ['pickpocket']);
    stackTop(g, [{ suit: 'diamonds' }]);
    g.apply(0, { type: 'playCard', cardId: pp.id, target: 1 });
    expect(ids(g.seats[1].hand)).toEqual([rum.id]);
    expect(g.events.find((e) => e.type === 'judge')).toMatchObject({ seat: 1, reason: 'pickpocket', success: true });
  });

  it('a black judgment lets it through', () => {
    const g = game(['derrick', 'gordon']);
    setHand(g, 1, ['rum']);
    const [cut] = setHand(g, 0, ['cutRope']);
    stackTop(g, [{ suit: 'spades', rank: 11 }]);
    g.apply(0, { type: 'playCard', cardId: cut.id, target: 1 });
    expect(g.seats[1].hand).toHaveLength(0);
  });
});

describe('kiki', () => {
  it('discards a hand card to make anyone discard one equipment card, once per turn', () => {
    const g = game(['kiki']);
    const barrel = giveEquip(g, 2, 'barrel');
    const [junk, junk2] = setHand(g, 0, ['feast', 'brawl']);
    expect(g.apply(0, { type: 'useAbility', cardIds: [junk.id], target: 2, targetCardId: barrel.id }).ok).toBe(true);
    expect(g.seats[2].equipment).toHaveLength(0);
    expect(ids(g.discard)).toEqual(expect.arrayContaining([junk.id, barrel.id]));
    giveEquip(g, 3, 'dinghy');
    expect(g.apply(0, { type: 'useAbility', cardIds: [junk2.id], target: 3, targetCardId: g.seats[3].equipment[0].id }).ok).toBe(false);
  });

  it('needs an equipment card of the target', () => {
    const g = game(['kiki']);
    const [junk] = setHand(g, 0, ['feast']);
    expect(g.apply(0, { type: 'useAbility', cardIds: [junk.id], target: 2, targetCardId: 'nope' }).ok).toBe(false);
  });
});

describe('morgan', () => {
  it('may slash twice a turn at 2 hp or less', () => {
    const g = game(['morgan']);
    g.seats[0].hp = 3;
    expect(slashLimit(g, 0)).toBe(1);
    g.seats[0].hp = 2;
    expect(slashLimit(g, 0)).toBe(2);
  });
});

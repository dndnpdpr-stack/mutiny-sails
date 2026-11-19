import { playHints } from '../../src/engine/legal';
import { giveEquip, makeGame, setHand } from './helpers';

describe('playHints', () => {
  it('slash targets only living seats in range', () => {
    const g = makeGame(5);
    g.start();
    const [slash] = setHand(g, 0, ['slash']);
    g.seats[4].alive = false;
    const h = playHints(g, 0).find((x) => x.cardId === slash.id);
    expect(h?.targets).toEqual([1, 3]); // 4번이 빠져서 3번이 거리 1
  });
  it('no slash hint after the turn slash is used', () => {
    const g = makeGame(5);
    g.start();
    const [a, b] = setHand(g, 0, ['slash', 'slash']);
    g.apply(0, { type: 'playCard', cardId: a.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(playHints(g, 0).some((x) => x.cardId === b.id)).toBe(false);
  });
  it('no rum hint at full hp, untargeted hint when hurt', () => {
    const g = makeGame(5);
    g.start();
    const [rum] = setHand(g, 0, ['rum']);
    expect(playHints(g, 0).some((x) => x.cardId === rum.id)).toBe(false);
    g.seats[0].hp = 2;
    expect(playHints(g, 0).find((x) => x.cardId === rum.id)).toEqual({ cardId: rum.id, targets: null, targetCards: false });
  });
  it('pickpocket allows a target that only has equipment', () => {
    const g = makeGame(5);
    g.start();
    const [pp] = setHand(g, 0, ['pickpocket']);
    setHand(g, 1, []);
    giveEquip(g, 1, 'pistol');
    setHand(g, 4, []);
    const h = playHints(g, 0).find((x) => x.cardId === pp.id);
    expect(h).toEqual({ cardId: pp.id, targets: [1], targetCards: true });
  });
  it('empty when it is not your turn', () => {
    const g = makeGame(5);
    g.start();
    expect(playHints(g, 1)).toEqual([]);
  });
});

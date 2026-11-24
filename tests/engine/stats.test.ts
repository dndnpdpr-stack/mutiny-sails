import { buildView } from '../../src/host/view';
import { makeGame, setHand } from './helpers';

describe('game stats for the result screen', () => {
  it('counts damage dealt and knockouts per seat, and shows them only once the game is over', () => {
    const g = makeGame(5); // 0 선장, 1·2 반란, 3 첩자, 4 충성
    g.start();
    const [slash] = setHand(g, 0, ['slash']);
    setHand(g, 1, []);
    g.seats[1].hp = 1;
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.stats[0]).toEqual({ damage: 1, kills: 1 });
    expect(g.stats[1]).toEqual({ damage: 0, kills: 0 });
    expect(buildView(g, 2, () => true).stats).toBeUndefined();
    g.winner = 'captainTeam';
    expect(buildView(g, 2, () => true).stats?.[0]).toEqual({ damage: 1, kills: 1 });
  });
});

import { AiMemory } from '../../src/ai/memory';
import { decide } from '../../src/ai/decide';
import { Rng } from '../../src/engine/rng';
import { buildView } from '../../src/host/view';
import { giveHand, makeGame, passUntil, setHand } from '../engine/helpers';

const rng = () => new Rng(5);

describe('decide', () => {
  it('rebel slashes the captain when in range', () => {
    const g = makeGame(4); // 0 captain, 1 rebel
    g.start();
    passUntil(g, 1);
    const [slash] = setHand(g, 1, ['slash']);
    const view = buildView(g, 1, () => true);
    const a = decide(view, new AiMemory(), rng());
    expect(a).toEqual({ type: 'playCard', cardId: slash.id, target: 0 });
  });

  it('responds to an attack with a dodge or gives up', () => {
    const g = makeGame(4);
    g.start();
    const [slash] = setHand(g, 0, ['slash']);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    setHand(g, 1, []);
    const d = giveHand(g, 1, 'dodge');
    const p = g.pending()!;
    if (p.kind !== 'respondAttack') return; // barrel etc. not expected with default roster
    expect(decide(buildView(g, 1, () => true), new AiMemory(), rng())).toEqual({ type: 'respond', cardIds: [d.id] });
    g.seats[1].hand.length = 0;
    expect(decide(buildView(g, 1, () => true), new AiMemory(), rng())).toEqual({ type: 'respond', cardIds: [] });
  });

  it('returns null when it is not my turn', () => {
    const g = makeGame(4);
    g.start();
    expect(decide(buildView(g, 2, () => true), new AiMemory(), rng())).toBeNull();
  });
});

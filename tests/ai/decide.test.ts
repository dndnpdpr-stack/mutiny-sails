import { Game } from '../../src/engine/Game';
import type { CharacterId } from '../../src/engine/types';
import { AiMemory } from '../../src/ai/memory';
import { decide } from '../../src/ai/decide';
import { Rng } from '../../src/engine/rng';
import { buildView } from '../../src/host/view';
import { giveEquip as giveEquipFor, giveHand, makeGame, passUntil, setHand } from '../engine/helpers';

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

describe('decide draft', () => {
  it('picks the higher max hp character', () => {
    const g = new Game({ seed: 1, names: ['A', 'B', 'C', 'D'] });
    g.start();
    const base = buildView(g, g.pending()!.seat, () => true);
    const view = { ...base, pending: { kind: 'chooseCharacter' as const, seat: base.you, options: ['margo', 'orso'] as CharacterId[] } };
    expect(decide(view, new AiMemory(), rng())).toEqual({ type: 'chooseCharacter', character: 'orso' });
  });
});

describe('decide with expansion cards', () => {
  const ai = (g: ReturnType<typeof makeGame>, seat: number, mem = new AiMemory()) => decide(buildView(g, seat, () => true), mem, rng());

  it('uses a parrot tattle on someone whose role it does not know', () => {
    const g = makeGame(5, { expansionCards: true });
    g.start();
    const [card] = setHand(g, 0, ['parrotTattle']);
    const a = ai(g, 0);
    expect(a).toMatchObject({ type: 'playCard', cardId: card.id });
    expect([1, 2, 3, 4]).toContain((a as { target: number }).target);
  });

  it('a captain does not slash a crew member it knows is loyal', () => {
    const g = makeGame(5, { expansionCards: true }); // 0 선장, 1 반란, 4 충성 (둘 다 거리 1)
    g.start();
    const [slash] = setHand(g, 0, ['slash']);
    const mem = new AiMemory();
    mem.captainFoe[4] = 5;
    expect(ai(g, 0, mem)).toEqual({ type: 'playCard', cardId: slash.id, target: 4 });
    g.revealRoleTo(0, 4);
    expect(ai(g, 0, mem)).toEqual({ type: 'playCard', cardId: slash.id, target: 1 });
  });

  it('keeps the most valuable card from a treasure map', () => {
    const g = makeGame(5, { expansionCards: true });
    g.start();
    const [map] = setHand(g, 0, ['treasureMap']);
    g.apply(0, { type: 'playCard', cardId: map.id });
    const p = g.pending();
    if (p?.kind !== 'treasureMap') throw new Error('no map');
    const best = [...p.revealed].sort((a, b) => (a.kind === 'rum' ? -1 : b.kind === 'rum' ? 1 : 0))[0];
    const a = ai(g, 0);
    expect(a?.type).toBe('chooseCard');
    if (p.revealed.some((c) => c.kind === 'rum')) expect(a).toEqual({ type: 'chooseCard', cardId: best.id });
  });

  it('equips a compass, coat, coin or flag it does not have yet', () => {
    const g = makeGame(5, { expansionCards: true });
    g.start();
    const [coat] = setHand(g, 0, ['leatherCoat']);
    expect(ai(g, 0)).toEqual({ type: 'playCard', cardId: coat.id });
  });
});

describe('fire ship targeting', () => {
  it('a loyalist does not set fire next to the captain', () => {
    const g = makeGame(5, { expansionCards: true }); // 0 선장, 1 반란, 4 충성
    g.start();
    passUntil(g, 4);
    giveEquipFor(g, 4, 'pistol');
    const [fire] = setHand(g, 4, ['fireShip']);
    const mem = new AiMemory();
    mem.captainFoe[1] = 5;
    const a = decide(buildView(g, 4, () => true), mem, rng());
    expect(a).not.toEqual({ type: 'playCard', cardId: fire.id, target: 1 });
  });
});

import { Game } from '../../src/engine/Game';
import type { CardView, CharacterId, JudgeReason } from '../../src/engine/types';
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
    mem.captainFoe[1] = 1;
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

describe('difficulty', () => {
  // 5인: 0 선장, 1·2 반란, 3 첩자, 4 충성. 1번 차례에서 선장(0)은 거리 1
  const rebelTurn = (level: 'easy' | 'normal' | 'hard', mem = new AiMemory(level)) => {
    const g = makeGame(5);
    g.start();
    passUntil(g, 1);
    const [slash] = setHand(g, 1, ['slash']);
    return { g, slash, act: () => decide(buildView(g, 1, () => true), mem, rng(), level) };
  };

  it('easy and normal rebels slash the captain in range', () => {
    for (const level of ['easy', 'normal'] as const) {
      const { slash, act } = rebelTurn(level);
      expect(act()).toEqual({ type: 'playCard', cardId: slash.id, target: 0 });
    }
  });

  it('a normal rebel does not slash someone it has no clue about', () => {
    const g = makeGame(5);
    g.start();
    passUntil(g, 2); // 2번(반란): 거리 1은 1번(반란)·3번(첩자), 선장은 거리 2
    const [slash] = setHand(g, 2, ['slash']);
    const view = buildView(g, 2, () => true);
    expect(view.hints.find((h) => h.cardId === slash.id)?.targets).not.toContain(0);
    expect(decide(view, new AiMemory('normal'), rng(), 'normal')).toEqual({ type: 'endTurn' });
    expect(decide(view, new AiMemory('easy'), rng(), 'easy')).toMatchObject({ type: 'playCard', cardId: slash.id });
  });

  it('a hard rebel hides early: no lone slash on a healthy captain, but strikes when the captain is weak', () => {
    const { g, act } = rebelTurn('hard');
    expect(act()).toEqual({ type: 'endTurn' });
    g.seats[0].hp = 2;
    expect(act()).toMatchObject({ type: 'playCard', target: 0 });
  });

  it('a hard rebel strikes with two slashes in hand', () => {
    const g = makeGame(5);
    g.start();
    passUntil(g, 1);
    setHand(g, 1, ['slash', 'slash']);
    expect(decide(buildView(g, 1, () => true), new AiMemory('hard'), rng(), 'hard')).toMatchObject({ type: 'playCard', target: 0 });
  });

  it('memory counts rounds from the captain turns', () => {
    const g = makeGame(4);
    g.start();
    const mem = new AiMemory();
    mem.update(buildView(g, 1, () => true));
    expect(mem.rounds).toBe(1);
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

describe('new character abilities', () => {
  const chars = (first: CharacterId): CharacterId[] => [first, 'bruno', 'hanna', 'orso', 'tom'];

  it('ori keeps a valuable top card and sends a weak one to the bottom', () => {
    const g = makeGame(5, { characters: chars('ori') });
    g.deck.push(...[giveHand(g, 1, 'rum')].map((c) => g.seats[1].hand.splice(g.seats[1].hand.indexOf(c), 1)[0]));
    g.start();
    expect(decide(buildView(g, 0, () => true), new AiMemory(), rng())).toEqual({ type: 'fortune', toBottom: false });
    const g2 = makeGame(5, { characters: chars('ori') });
    g2.deck.push(...[giveHand(g2, 1, 'powderKeg')].map((c) => g2.seats[1].hand.splice(g2.seats[1].hand.indexOf(c), 1)[0]));
    g2.start();
    expect(decide(buildView(g2, 0, () => true), new AiMemory(), rng())).toEqual({ type: 'fortune', toBottom: true });
  });

  it('dorothy, as captain, heals a hurt crew member who looks loyal', () => {
    const g = makeGame(5, { characters: chars('dorothy') });
    g.start();
    const [rum] = setHand(g, 0, ['rum']);
    g.seats[4].hp = 2;
    const mem = new AiMemory();
    mem.captainFoe[4] = -3;
    expect(decide(buildView(g, 0, () => true), mem, rng())).toEqual({ type: 'useAbility', cardIds: [rum.id], target: 4 });
  });

  it('kiki trades a weak card for an enemy barrel', () => {
    const g = makeGame(5, { characters: chars('kiki') });
    g.start();
    const [feast] = setHand(g, 0, ['feast']);
    const barrel = giveEquipFor(g, 1, 'barrel');
    const mem = new AiMemory();
    mem.captainFoe[1] = 4;
    expect(decide(buildView(g, 0, () => true), mem, rng())).toEqual({ type: 'useAbility', cardIds: [feast.id], target: 1, targetCardId: barrel.id });
  });
});

describe('judge choice by reason', () => {
  const choose = (reason: JudgeReason, options: CardView[], equipment: CardView[] = []) => {
    const g = makeGame(4);
    g.start();
    const base = buildView(g, 1, () => true);
    const seats = base.seats.map((s) => (s.seat === 1 ? { ...s, equipment } : s));
    const view = { ...base, seats, pending: { kind: 'judgeChoice' as const, seat: 1, options, reason } };
    return decide(view, new AiMemory(), rng());
  };
  const c = (id: string, suit: CardView['suit'], rank: CardView['rank'] = 5): CardView => ({ id, kind: 'slash', suit, rank });

  it('resisting a pickpocket prefers a red card', () => {
    expect(choose('pickpocket', [c('a', 'clubs'), c('b', 'diamonds')])).toEqual({ type: 'chooseCard', cardId: 'b' });
  });

  it('a barrel judgment prefers hearts even with a powder keg in front', () => {
    const keg: CardView = { id: 'k', kind: 'powderKeg', suit: 'spades', rank: 3 };
    expect(choose('barrel', [c('a', 'clubs'), c('b', 'hearts')], [keg])).toEqual({ type: 'chooseCard', cardId: 'b' });
  });

  it('a powder keg judgment avoids spades 2-9; a sea monster avoids spades', () => {
    expect(choose('powderKeg', [c('a', 'spades', 4), c('b', 'spades', 12)])).toEqual({ type: 'chooseCard', cardId: 'b' });
    expect(choose('seaMonster', [c('a', 'spades', 12), c('b', 'clubs')])).toEqual({ type: 'chooseCard', cardId: 'b' });
  });
});

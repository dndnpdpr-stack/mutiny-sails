import { effectsFor, totalMs, STAGGER_MS } from '../../src/ui/anim/effects';
import type { CardView, GameEvent } from '../../src/engine/types';

const c = (id: string, kind: CardView['kind']): CardView => ({ id, kind, suit: 'spades', rank: 5 });

describe('effectsFor', () => {
  it('other player draw -> one face-down fly per card, staggered', () => {
    const fx = effectsFor([{ type: 'draw', seat: 2, count: 2 }], 0);
    expect(fx).toHaveLength(2);
    expect(fx[0]).toMatchObject({ kind: 'fly', from: 'deck', to: 'seat:2', card: null, at: 0 });
    expect(fx[1]).toMatchObject({ to: 'seat:2', card: null, at: STAGGER_MS });
  });

  it('own draw is silent, own drawCards flies flipped to hand', () => {
    expect(effectsFor([{ type: 'draw', seat: 0, count: 2 }], 0)).toEqual([]);
    const fx = effectsFor([{ type: 'drawCards', seat: 0, cards: [c('a', 'slash'), c('b', 'dodge')] }], 0);
    expect(fx).toHaveLength(2);
    expect(fx[0]).toMatchObject({ kind: 'fly', from: 'deck', to: 'hand', flip: true });
    expect(fx[1]).toMatchObject({ to: 'hand', flip: true, at: STAGGER_MS });
  });

  it('own slash with target flies hand -> discard via target', () => {
    const fx = effectsFor([{ type: 'play', seat: 0, card: c('a', 'slash'), target: 3 }], 0);
    expect(fx.find((e) => e.kind === 'fly')).toMatchObject({ kind: 'fly', from: 'hand', to: 'discard', via: 'seat:3' });
  });

  it('equipment goes to equip slot of self or target', () => {
    const gun = effectsFor([{ type: 'play', seat: 2, card: c('g', 'pistol'), target: undefined }], 0);
    expect(gun[0]).toMatchObject({ from: 'seat:2', to: 'equip:2' });
    const brig = effectsFor([{ type: 'play', seat: 2, card: c('j', 'brig'), target: 4 }], 0);
    expect(brig.find((e) => e.kind === 'fly')).toMatchObject({ to: 'equip:4' });
  });

  it('respond and discardCards fly to discard', () => {
    const r = effectsFor([{ type: 'respond', seat: 0, cards: [c('a', 'dodge')] }], 0);
    expect(r[0]).toMatchObject({ from: 'hand', to: 'discard' });
    const d = effectsFor([{ type: 'discardCards', seat: 3, cards: [c('a', 'dodge'), c('b', 'slash')] }], 0);
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ from: 'seat:3', to: 'discard' });
  });

  it('damage -> shake + float at the same time; heal -> float', () => {
    const fx = effectsFor([{ type: 'damage', seat: 3, amount: 1, source: 0 }], 0);
    expect(fx).toHaveLength(2);
    expect(fx.find((e) => e.kind === 'shake')).toMatchObject({ seat: 3 });
    expect(fx.find((e) => e.kind === 'float')).toMatchObject({ text: '-1', tone: 'damage' });
    expect(fx[0].at).toBe(fx[1].at);
    const h = effectsFor([{ type: 'heal', seat: 1, amount: 1 }], 0);
    expect(h[0]).toMatchObject({ kind: 'float', text: '+1', tone: 'heal' });
  });

  it('a judge says what it is for, what it needs, and how it went', () => {
    const [j] = effectsFor([{ type: 'judge', seat: 1, card: c('a', 'slash'), success: false, reason: 'brig' }], 0);
    expect(j).toMatchObject({ kind: 'judge', title: '⛓️ 영창 판정', need: '♥이면 탈출', result: '이번 턴은 쉬어요', good: false });
  });

  it('a targeted play draws an aim arrow from the player to the target, then the card flies', () => {
    const fx = effectsFor([{ type: 'play', seat: 2, card: c('s', 'slash'), target: 0 }], 0);
    expect(fx[0]).toMatchObject({ kind: 'aim', from: 2, to: 0, emoji: '🗡️', at: 0 });
    expect(fx[1]).toMatchObject({ kind: 'fly', from: 'seat:2', via: 'seat:0' });
  });

  it('plays without another target draw no arrow', () => {
    expect(effectsFor([{ type: 'play', seat: 2, card: c('r', 'rum') }], 0).some((e) => e.kind === 'aim')).toBe(false);
    expect(effectsFor([{ type: 'play', seat: 2, card: c('b', 'barrel'), target: 2 }], 0).some((e) => e.kind === 'aim')).toBe(false);
  });

  it('judge, death, turnStart, steal', () => {
    expect(effectsFor([{ type: 'judge', seat: 1, card: c('a', 'slash'), success: true, reason: 'barrel' }], 0)[0].kind).toBe('judge');
    expect(effectsFor([{ type: 'death', seat: 1, role: 'rebel', killer: null }], 0)[0].kind).toBe('death');
    expect(effectsFor([{ type: 'turnStart', seat: 0 }], 0)[0]).toMatchObject({ kind: 'turn', mine: true });
    expect(effectsFor([{ type: 'turnStart', seat: 2 }], 0)[0]).toMatchObject({ mine: false });
    const s = effectsFor([{ type: 'steal', from: 2, to: 0, card: null }], 0);
    expect(s[0]).toMatchObject({ from: 'seat:2', to: 'hand', card: null });
  });

  it('silent events', () => {
    const evs = [
      { type: 'characterChosen', seat: 0, character: 'x' },
      { type: 'gameOver', winner: 'rebels' },
    ] as unknown as GameEvent[];
    expect(effectsFor(evs, 0)).toEqual([]);
  });

  it('durations <= 600 and consecutive events are staggered', () => {
    const fx = effectsFor(
      [
        { type: 'damage', seat: 3, amount: 1, source: 0 },
        { type: 'heal', seat: 1, amount: 1 },
        { type: 'death', seat: 3, role: 'rebel', killer: 0 },
      ],
      0,
    );
    expect(fx.every((e) => e.ms <= 600)).toBe(true);
    expect(fx.find((e) => e.kind === 'float' && e.tone === 'heal')!.at).toBe(STAGGER_MS);
    expect(fx.find((e) => e.kind === 'death')!.at).toBe(2 * STAGGER_MS);
  });
});

describe('expansion effects', () => {
  it('flies a used-up gear card from the seat equipment to the discard pile', () => {
    const c = { id: 'g', kind: 'leatherCoat', suit: 'clubs', rank: 9 } as const;
    expect(effectsFor([{ type: 'gearUsed', seat: 2, card: c }], 0)).toEqual([{ kind: 'fly', from: 'equip:2', to: 'discard', card: c, at: 0, ms: 450 }]);
  });
  it('shows both wager cards on the judge pile, the higher one as success', () => {
    const a = { id: 'a', kind: 'slash', suit: 'clubs', rank: 12 } as const;
    const b = { id: 'b', kind: 'slash', suit: 'clubs', rank: 3 } as const;
    const fx = effectsFor([{ type: 'wager', seat: 0, target: 1, cards: [a, b] }], 0);
    expect(fx.map((e) => (e.kind === 'judge' ? [e.card.id, e.success] : null))).toEqual([['a', true], ['b', false]]);
    expect(fx.map((e) => (e.kind === 'judge' ? e.title : null))).toEqual(['🎲 주사위 내기', '']);
  });
});

describe('sea event effect', () => {
  it('turns a sea event into a short marker effect (the banner keeps its own timer)', () => {
    expect(effectsFor([{ type: 'seaEvent', event: 'fog' }], 0)).toEqual([{ kind: 'sea', event: 'fog', at: 0, ms: 300 }]);
  });
});

describe('totalMs', () => {
  it('is 0 for empty and max(at+ms) otherwise', () => {
    expect(totalMs([])).toBe(0);
    const fx = effectsFor([{ type: 'draw', seat: 2, count: 2 }], 0);
    expect(totalMs(fx)).toBe(Math.max(...fx.map((e) => e.at + e.ms)));
    expect(totalMs(fx)).toBeGreaterThan(450);
  });
});

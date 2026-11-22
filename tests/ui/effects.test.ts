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
    expect(fx[0]).toMatchObject({ kind: 'fly', from: 'hand', to: 'discard', via: 'seat:3' });
  });

  it('equipment goes to equip slot of self or target', () => {
    const gun = effectsFor([{ type: 'play', seat: 2, card: c('g', 'pistol'), target: undefined }], 0);
    expect(gun[0]).toMatchObject({ from: 'seat:2', to: 'equip:2' });
    const brig = effectsFor([{ type: 'play', seat: 2, card: c('j', 'brig'), target: 4 }], 0);
    expect(brig[0]).toMatchObject({ to: 'equip:4' });
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

import { Rng } from '../../src/engine/rng';
import { buildDeckSpec } from '../../src/engine/cards/deck';
import { CARD_CATALOG } from '../../src/engine/cards/catalog';
import type { CardKind } from '../../src/engine/types';

describe('buildDeckSpec', () => {
  const deck = buildDeckSpec(new Rng(1));
  it('has 82 unique cards', () => {
    expect(deck.length).toBe(82);
    expect(new Set(deck.map((c) => c.id)).size).toBe(82);
  });
  it('matches catalog counts', () => {
    const base = Object.values(CARD_CATALOG).filter((i) => !i.expansion);
    expect(base.reduce((s, i) => s + i.count, 0)).toBe(82);
    expect(CARD_CATALOG.rum.count).toBe(8);
    for (const { kind } of base) {
      expect(deck.filter((c) => c.kind === kind).length).toBe(CARD_CATALOG[kind].count);
    }
  });
  it('has 20 spades and hearts, 21 diamonds and clubs', () => {
    for (const s of ['spades', 'hearts'] as const) expect(deck.filter((c) => c.suit === s).length).toBe(20);
    for (const s of ['diamonds', 'clubs'] as const) expect(deck.filter((c) => c.suit === s).length).toBe(21);
  });
  it('has exactly 12 spades of rank 2-9', () => {
    expect(deck.filter((c) => c.suit === 'spades' && c.rank >= 2 && c.rank <= 9).length).toBe(12);
  });
  it('does not concentrate a kind in one suit', () => {
    for (const seed of [1, 2, 3, 99]) {
      const d = buildDeckSpec(new Rng(seed));
      for (const kind of Object.keys(CARD_CATALOG) as CardKind[]) {
        const cnt = CARD_CATALOG[kind].count;
        if (cnt < 4) continue;
        for (const s of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
          expect(d.filter((c) => c.kind === kind && c.suit === s).length).toBeLessThanOrEqual(cnt * 0.7);
        }
      }
    }
  });
});

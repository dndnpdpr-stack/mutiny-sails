import { formatEvent, roleName, winnerText } from '../../src/ui/format';
import type { GameEvent } from '../../src/engine/types';

const card = { id: 'c1', kind: 'slash', suit: 'spades', rank: 5 } as const;
const names = (s: number) => `P${s}`;

describe('format', () => {
  it('formats damage with name and amount', () => {
    const s = formatEvent({ type: 'damage', seat: 2, amount: 3, source: null }, names);
    expect(s).toContain('P2');
    expect(s).toContain('3');
  });

  it('produces non-empty text for every event type', () => {
    const events: GameEvent[] = [
      { type: 'turnStart', seat: 0 },
      { type: 'draw', seat: 0, count: 2 },
      { type: 'drawCards', seat: 0, cards: [card] },
      { type: 'play', seat: 0, card },
      { type: 'play', seat: 0, card, target: 1 },
      { type: 'respond', seat: 0, cards: [] },
      { type: 'damage', seat: 0, amount: 1, source: 1 },
      { type: 'heal', seat: 0, amount: 1 },
      { type: 'judge', seat: 0, card, success: true, reason: 'barrel' },
      { type: 'steal', from: 0, to: 1, card: null },
      { type: 'discardCards', seat: 0, cards: [card] },
      { type: 'peek', seat: 0, target: 1, card },
      { type: 'death', seat: 0, role: 'rebel', killer: null },
      { type: 'ability', seat: 0, character: 'tom' },
      { type: 'gameOver', winner: 'spy' },
    ];
    for (const e of events) expect(formatEvent(e, names)).not.toBe('');
    expect(roleName('spy')).toBe('첩자');
    expect(winnerText('rebels')).toContain('반란');
  });
});

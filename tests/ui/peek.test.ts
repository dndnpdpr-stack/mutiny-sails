import { latestPeek, peekMemos } from '../../src/ui/table/peek';
import type { CardView, GameEvent } from '../../src/engine/types';

const card = (id: string, kind: CardView['kind'] = 'slash'): CardView => ({ id, kind, suit: 'spades', rank: 5 });
const peek = (seq: number, seat: number, target: number, c: CardView): GameEvent => ({ seq, type: 'peek', seat, target, card: c, visibleTo: [seat] });

describe('peekMemos', () => {
  it('remembers the card I peeked per target', () => {
    expect(peekMemos([peek(1, 1, 3, card('c1'))], 1)).toEqual({ 3: card('c1') });
  });
  it('keeps only the latest peek per target', () => {
    expect(peekMemos([peek(1, 1, 3, card('c1')), peek(2, 1, 3, card('c2', 'rum'))], 1)).toEqual({ 3: card('c2', 'rum') });
  });
  it('ignores peeks by other seats', () => {
    expect(peekMemos([peek(1, 2, 3, card('c1'))], 1)).toEqual({});
  });
  it('forgets the card once it shows up in public (played, responded, discarded, stolen, judged)', () => {
    const c = card('c1');
    const leaving: GameEvent[] = [
      { seq: 2, type: 'play', seat: 3, card: c },
      { seq: 2, type: 'respond', seat: 3, cards: [c] },
      { seq: 2, type: 'discardCards', seat: 3, cards: [c] },
      { seq: 2, type: 'steal', from: 3, to: 0, card: c },
      { seq: 2, type: 'judge', seat: 3, card: c, success: true, reason: 'barrel' },
    ];
    for (const e of leaving) expect(peekMemos([peek(1, 1, 3, c), e], 1)).toEqual({});
  });
  it('forgets when the target goes down', () => {
    expect(peekMemos([peek(1, 1, 3, card('c1')), { seq: 2, type: 'death', seat: 3, role: 'rebel', killer: null }], 1)).toEqual({});
  });
});

describe('latestPeek', () => {
  it('returns my newest peek after the acknowledged seq', () => {
    const events = [peek(1, 1, 3, card('c1')), peek(5, 1, 2, card('c2'))];
    expect(latestPeek(events, 1, 0)).toEqual(events[1]);
    expect(latestPeek(events, 1, 5)).toBeNull();
    expect(latestPeek([peek(1, 2, 3, card('c1'))], 1, 0)).toBeNull();
  });
});

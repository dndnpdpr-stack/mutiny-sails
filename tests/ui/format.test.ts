import { formatEvent, roleName, winnerText } from '../../src/ui/format';
import type { GameEvent } from '../../src/engine/types';

const card = { id: 'c1', kind: 'slash', suit: 'spades', rank: 5 } as const;
const names = (s: number) => `P${s}`;

describe('format', () => {
  it('describes expansion card events', () => {
    expect(formatEvent({ type: 'roleRevealed', seat: 0, target: 2, role: 'spy' }, names)).toBe('🦜 P2의 역할은 첩자예요.');
    expect(formatEvent({ type: 'wager', seat: 0, target: 1, cards: [{ ...card, rank: 12 }, { ...card, rank: 3 }] }, names)).toBe('P0과(와) P1의 주사위 내기: Q 대 3');
    expect(formatEvent({ type: 'gearUsed', seat: 1, card: { ...card, kind: 'leatherCoat' } }, names)).toBe('P1의 가죽 코트가 효과를 내고 버려졌어요.');
    expect(formatEvent({ type: 'gearUsed', seat: 1, card: { ...card, kind: 'luckyCoin' } }, names)).toBe('P1의 행운의 동전이 효과를 내고 버려졌어요.');
  });

  it('names the sea event and the sea monster judgment', () => {
    expect(formatEvent({ type: 'seaEvent', event: 'storm' }, names)).toBe('바다 이벤트: 🌪️ 폭풍 — 모든 거리 +1');
    expect(formatEvent({ type: 'judge', seat: 1, card, success: false, reason: 'seaMonster' }, names)).toBe('P1의 바다 괴물 판정: 실패');
  });

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
      { type: 'characterChosen', seat: 0, character: 'tom' },
      { type: 'gameOver', winner: 'spy' },
    ];
    for (const e of events) expect(formatEvent(e, names)).not.toBe('');
    expect(roleName('spy')).toBe('첩자');
    expect(winnerText('rebels')).toContain('반란');
  });
});

describe('format draft', () => {
  it('announces a chosen character', () => {
    const s = formatEvent({ type: 'characterChosen', seat: 2, character: 'orso' }, names);
    expect(s).toContain('P2');
    expect(s).toContain('을(를) 골랐어요.');
  });
});

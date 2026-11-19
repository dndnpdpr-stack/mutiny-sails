import type { CardId, CardView, GameEvent, SeatId } from '../../engine/types';

type PeekEvent = Extract<GameEvent, { type: 'peek' }>;

/** 이 사건에서 공개적으로 드러난 카드 id들 (손을 떠났다는 뜻) */
function revealedIds(e: GameEvent): CardId[] {
  switch (e.type) {
    case 'play':
      return [e.card.id];
    case 'respond':
    case 'discardCards':
      return e.cards.map((c) => c.id);
    case 'steal':
      return e.card ? [e.card.id] : [];
    case 'judge':
      return [e.card.id];
    default:
      return [];
  }
}

/** 내가 엿본 카드 중 아직 그 사람 손에 있을 것으로 보이는 카드 (자리별 최신 1장) */
export function peekMemos(events: GameEvent[], you: SeatId): Record<SeatId, CardView> {
  const memo: Record<SeatId, CardView> = {};
  for (const e of events) {
    if (e.type === 'peek') {
      if (e.seat === you) memo[e.target] = e.card;
      continue;
    }
    if (e.type === 'death') {
      delete memo[e.seat];
      continue;
    }
    const gone = revealedIds(e);
    if (gone.length === 0) continue;
    for (const [seat, c] of Object.entries(memo)) if (gone.includes(c.id)) delete memo[Number(seat)];
  }
  return memo;
}

/** 확인하지 않은(ackSeq 이후) 내 최신 엿보기 */
export function latestPeek(events: GameEvent[], you: SeatId, ackSeq: number): PeekEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if ((e.seq ?? 0) <= ackSeq) return null;
    if (e.type === 'peek' && e.seat === you) return e;
  }
  return null;
}

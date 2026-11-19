import type { CardKind, CardView, Rank, Suit } from '../types';
import type { Rng } from '../rng';
import { CARD_CATALOG } from './catalog';

const ALL_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** 80칸의 (문양, 숫자) 슬롯. 문양마다 20칸, ♠ 2~9는 12칸. */
function slots(): Array<{ suit: Suit; rank: Rank }> {
  const out: Array<{ suit: Suit; rank: Rank }> = [];
  const spadeRanks: Rank[] = [...ALL_RANKS, 2, 3, 4, 5, 10, 11, 12];
  const otherRanks: Rank[] = [...ALL_RANKS, 2, 3, 4, 5, 6, 7, 8];
  for (const r of spadeRanks) out.push({ suit: 'spades', rank: r });
  for (const s of ['hearts', 'diamonds', 'clubs'] as const) for (const r of otherRanks) out.push({ suit: s, rank: r });
  return out;
}

function concentrated(deck: CardView[]): boolean {
  for (const info of Object.values(CARD_CATALOG)) {
    if (info.count < 4) continue;
    for (const s of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
      if (deck.filter((c) => c.kind === info.kind && c.suit === s).length > info.count * 0.7) return true;
    }
  }
  return false;
}

export function buildDeckSpec(rng: Rng): CardView[] {
  const kinds: CardKind[] = [];
  for (const info of Object.values(CARD_CATALOG)) for (let i = 0; i < info.count; i++) kinds.push(info.kind);
  const table = slots();
  for (;;) {
    rng.shuffle(kinds);
    const deck = table.map((s, i) => ({ id: `c${i}`, kind: kinds[i], suit: s.suit, rank: s.rank }));
    if (!concentrated(deck)) return deck;
  }
}

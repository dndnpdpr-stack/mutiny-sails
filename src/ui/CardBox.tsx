import type { CardView } from '../engine/types';
import { CARD_CATALOG } from '../engine/cards/catalog';

const SUIT: Record<CardView['suit'], string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const RANK: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function CardBox({ card, onClick, disabled, selected }: { card: CardView; onClick?: () => void; disabled?: boolean; selected?: boolean }) {
  const info = CARD_CATALOG[card.kind];
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <button
      type="button"
      className={`card ${info.category}${selected ? ' selected' : ''}`}
      title={info.text}
      disabled={disabled || !onClick}
      onClick={onClick}
    >
      <span className="card-emoji">{info.emoji}</span>
      <span className="card-name">{info.name}</span>
      <span className={`card-suit${red ? ' red' : ''}`}>
        {SUIT[card.suit]}
        {RANK[card.rank] ?? card.rank}
      </span>
    </button>
  );
}

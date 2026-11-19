import { motion } from 'framer-motion';
import { CARD_CATALOG } from '../../engine/cards/catalog';
import type { CardView, Suit } from '../../engine/types';

const SUIT_SYMBOL: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export function CardFace(p: {
  card: CardView;
  size?: 'md' | 'sm';
  dim?: boolean;
  raised?: boolean;
  selected?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  layoutId?: string;
}) {
  const info = CARD_CATALOG[p.card.kind];
  const red = p.card.suit === 'hearts' || p.card.suit === 'diamonds';
  const cls = [
    'pcard',
    info.category,
    p.size ?? 'md',
    p.dim ? 'dim' : '',
    p.raised ? 'raised' : '',
    p.selected ? 'selected' : '',
    p.highlight ? 'highlight' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <motion.button
      type="button"
      layoutId={p.layoutId}
      className={cls}
      aria-label={info.name}
      title={info.text}
      disabled={!p.onClick}
      onClick={p.onClick}
      whileHover={p.onClick ? { y: -6 } : undefined}
    >
      <span className="corner">
        <span className="rank">{rankLabel(p.card.rank)}</span>
        <span className={`suit${red ? ' red' : ''}`}>{SUIT_SYMBOL[p.card.suit]}</span>
      </span>
      <span className="emoji">{info.emoji}</span>
      <span className="name">{info.name}</span>
    </motion.button>
  );
}

export function CardBack(p: { size?: 'md' | 'sm' }) {
  return <motion.div className={`pcard back ${p.size ?? 'md'}`} aria-hidden="true" />;
}

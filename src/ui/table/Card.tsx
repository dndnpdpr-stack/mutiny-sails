import { createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { useLongPress } from './longPress';
import { CARD_CATALOG } from '../../engine/cards/catalog';
import type { CardView, Suit } from '../../engine/types';

const SUIT_SYMBOL: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

/** 게임판이 주는 "카드 설명 보기". 있으면 모든 카드가 우클릭·길게 누르기로 설명을 띄운다 */
export const CardInfoContext = createContext<((card: CardView) => void) | null>(null);

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
  const showInfo = useContext(CardInfoContext);
  const press = useLongPress(() => showInfo?.(p.card));
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
      disabled={!p.onClick && !showInfo}
      onClick={p.onClick}
      {...(showInfo ? press : {})}
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

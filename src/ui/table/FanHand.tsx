import { motion } from 'framer-motion';
import type { CardView } from '../../engine/types';
import { CardFace } from './Card';

/** 아래쪽 부채꼴 손패. 들림(raised)은 CSS가 아니라 framer의 y로 표현한다 */
export function FanHand(p: {
  cards: CardView[];
  canPlay: (id: string) => boolean;
  highlight: (id: string) => boolean;
  selectedId: string | null;
  onCardClick: (id: string) => void;
}) {
  const mid = (p.cards.length - 1) / 2;
  return (
    <div className="fan-hand" data-anchor="hand">
      {p.cards.map((c, i) => {
        const off = i - mid;
        const playable = p.canPlay(c.id);
        const selected = p.selectedId === c.id;
        return (
          <motion.div
            key={c.id}
            className="fan-slot"
            initial={false}
            animate={{ rotate: off * 4, y: Math.abs(off) * 4 + (selected ? -28 : playable ? -10 : 0) }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <CardFace
              card={c}
              dim={!playable}
              selected={selected}
              highlight={p.highlight(c.id)}
              onClick={() => {
                if (playable) p.onCardClick(c.id);
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

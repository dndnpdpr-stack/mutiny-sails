import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import type { CardView } from '../../engine/types';
import { CardFace } from './Card';

/** 이만큼 누르고 있으면 설명을 띄운다 */
export const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/** 우클릭(웹)이나 길게 누르기(터치)로 onLong을 부른다. 길게 누른 뒤 따라오는 클릭은 삼킨다 */
function useLongPress(onLong: (id: string) => void) {
  const s = useRef({ timer: undefined as ReturnType<typeof setTimeout> | undefined, x: 0, y: 0, fired: false });
  const clear = () => clearTimeout(s.current.timer);
  useEffect(() => clear, []);
  return (id: string) => ({
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      onLong(id);
    },
    onPointerDown: (e: PointerEvent) => {
      s.current.fired = false;
      clear();
      if (e.pointerType === 'mouse') return;
      s.current.x = e.clientX;
      s.current.y = e.clientY;
      s.current.timer = setTimeout(() => {
        s.current.fired = true;
        onLong(id);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (Math.hypot(e.clientX - s.current.x, e.clientY - s.current.y) > MOVE_TOLERANCE_PX) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClickCapture: (e: MouseEvent) => {
      if (!s.current.fired) return;
      s.current.fired = false;
      e.stopPropagation();
      e.preventDefault();
    },
  });
}

/** 아래쪽 부채꼴 손패. 들림(raised)은 CSS가 아니라 framer의 y로 표현한다 */
export function FanHand(p: {
  cards: CardView[];
  canPlay: (id: string) => boolean;
  highlight: (id: string) => boolean;
  selectedId: string | null;
  onCardClick: (id: string) => void;
  onCardInfo: (id: string) => void;
}) {
  const press = useLongPress(p.onCardInfo);
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
            {...press(c.id)}
          >
            <CardFace card={c} dim={!playable} selected={selected} highlight={p.highlight(c.id)} onClick={() => p.onCardClick(c.id)} />
          </motion.div>
        );
      })}
    </div>
  );
}

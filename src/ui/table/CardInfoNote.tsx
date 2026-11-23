import { CARD_CATALOG } from '../../engine/cards/catalog';
import type { CardView } from '../../engine/types';

/** 손패에서 고른 카드의 설명. 모달이 아니라서 떠 있는 동안에도 자리를 고를 수 있다 */
export function CardInfoNote(p: { card: CardView; onPlay: (() => void) | null }) {
  const info = CARD_CATALOG[p.card.kind];
  return (
    <div className="note card-info" role="dialog" aria-label="카드 설명">
      <b>
        {info.emoji} {info.name}
        {info.expansion && <span className="guide-tag">확장</span>}
      </b>
      <p>{info.text}</p>
      {p.onPlay && (
        <button type="button" onClick={p.onPlay}>
          내기
        </button>
      )}
    </div>
  );
}

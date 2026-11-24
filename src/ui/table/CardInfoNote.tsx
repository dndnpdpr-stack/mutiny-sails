import { CARD_CATALOG } from '../../engine/cards/catalog';
import type { CardView } from '../../engine/types';

/** 우클릭·길게 누르기로 띄우는 손패 카드 설명. 지금 바로 낼 수 있는 대상 없는 카드면 내기 버튼도 둔다 */
export function CardInfoNote(p: { card: CardView; onPlay: (() => void) | null; onClose: () => void }) {
  const info = CARD_CATALOG[p.card.kind];
  return (
    <div className="note card-info" role="dialog" aria-label="카드 설명">
      <b>
        {info.emoji} {info.name}
        {info.expansion && <span className="guide-tag">확장</span>}
      </b>
      <p>{info.text}</p>
      <div className="card-info-actions">
        {p.onPlay && (
          <button type="button" onClick={p.onPlay}>
            내기
          </button>
        )}
        <button type="button" onClick={p.onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

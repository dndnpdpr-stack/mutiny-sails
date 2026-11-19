import type { CardView } from '../../engine/types';
import { CardBack, CardFace } from './Card';

export function CenterPile(p: { deckCount: number; discardTop: CardView | null }) {
  return (
    <div className="center-pile">
      <div className="pile deck" data-anchor="deck">
        <CardBack />
        <span className="pile-count">{p.deckCount}</span>
      </div>
      <div className="pile discard" data-anchor="discard">
        {p.discardTop ? <CardFace card={p.discardTop} /> : <div className="pile-empty">버린 카드</div>}
      </div>
      <div className="pile judge" data-anchor="judge">
        <div className="pile-empty">판정</div>
      </div>
    </div>
  );
}

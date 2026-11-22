import type { CardView } from '../../engine/types';
import { SEA_EVENTS, type SeaEventId } from '../../engine/seaEvents';
import { CardBack, CardFace } from './Card';

/** 지금 펼쳐진 바다 이벤트 카드 */
function SeaEventCard({ event }: { event: SeaEventId | null }) {
  const info = event ? SEA_EVENTS[event] : null;
  return (
    <div className="pile sea" data-anchor="sea" data-testid="sea-event">
      {info ? (
        <div className={`sea-card sea-${event}`} title={`${info.name}: ${info.text}`}>
          <span className="sea-icon" aria-hidden="true">{info.icon}</span>
          <b className="sea-name">{info.name}</b>
          <span className="sea-text">{info.text}</span>
        </div>
      ) : (
        <div className="pile-empty">바다 이벤트</div>
      )}
    </div>
  );
}

export function CenterPile(p: { deckCount: number; discardTop: CardView | null; seaEventsOn?: boolean; seaEvent?: SeaEventId | null }) {
  return (
    <div className="center-pile">
      {p.seaEventsOn && <SeaEventCard event={p.seaEvent ?? null} />}
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

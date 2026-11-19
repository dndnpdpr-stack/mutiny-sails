import type { PlayerView } from '../engine/types';
import { CardBox } from './CardBox';

export function HandView({ view, selectedId, onCardClick }: { view: PlayerView; selectedId: string | null; onCardClick: (cardId: string) => void }) {
  const playable = new Set(view.hints.map((h) => h.cardId));
  return (
    <div className="hand">
      {view.myHand.map((c) => (
        <CardBox key={c.id} card={c} selected={selectedId === c.id} disabled={!playable.has(c.id)} onClick={() => onCardClick(c.id)} />
      ))}
    </div>
  );
}

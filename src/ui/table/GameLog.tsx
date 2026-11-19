import type { GameEvent, SeatId } from '../../engine/types';
import { formatEvent } from '../format';

export function GameLog(p: { events: GameEvent[]; name: (s: SeatId) => string }) {
  const recent = p.events.slice(-8);
  return (
    <div className="log panel">
      <h4>항해 일지</h4>
      <ul>
        {recent.map((e, i) => (
          <li key={e.seq ?? i}>{formatEvent(e, p.name)}</li>
        ))}
      </ul>
    </div>
  );
}

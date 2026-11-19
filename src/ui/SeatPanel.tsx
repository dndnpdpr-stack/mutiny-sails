import type { PlayerView, SeatId } from '../engine/types';
import { CHARACTER_INFO } from '../engine/characters/roster';
import { CardBox } from './CardBox';
import { roleName } from './format';

export function SeatPanel({
  view,
  seat,
  highlight,
  onClick,
}: {
  view: PlayerView;
  seat: SeatId;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const s = view.seats[seat];
  const ch = CHARACTER_INFO[s.character];
  const waiting = view.pending?.seat === seat;
  const classes = ['seat', s.alive ? '' : 'dead', view.current === seat ? 'current' : '', waiting ? 'waiting' : '', highlight ? 'highlight' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} data-testid="seat-panel" onClick={highlight ? onClick : undefined} role={highlight ? 'button' : undefined}>
      <div className="seat-name">
        {s.name} {s.isAi ? '🤖' : ''}
        {view.current === seat && <span className="badge">턴</span>}
        {waiting && view.current !== seat && <span className="badge">대기</span>}
      </div>
      <div className="seat-char" title={ch.text}>
        {ch.name}
      </div>
      <div className="seat-hp">{'♥'.repeat(Math.max(s.hp, 0)) + '♡'.repeat(Math.max(s.maxHp - s.hp, 0))}</div>
      <div>손패 {s.handCount}장{seat !== view.you && s.alive && view.distances[seat] !== undefined ? ` · 거리 ${view.distances[seat]}` : ''}</div>
      {s.role && <div className="seat-role">{roleName(s.role)}</div>}
      <div className="seat-equip">
        {s.equipment.map((c) => (
          <CardBox key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

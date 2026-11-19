import type { CSSProperties } from 'react';
import { CHARACTER_INFO } from '../../engine/characters/roster';
import type { SeatView } from '../../engine/types';
import { roleName } from '../format';
import { CardBack, CardFace } from './Card';
import { CHARACTER_FACE } from './CharacterCard';

export type SeatFx = 'shake' | 'dying' | 'turn-glow';

export function hearts(hp: number, maxHp: number): string {
  return '♥'.repeat(Math.max(hp, 0)) + '♡'.repeat(Math.max(maxHp - Math.max(hp, 0), 0));
}

export function OpponentPanel(p: {
  seat: SeatView;
  current: boolean;
  distance?: number;
  targetable: boolean;
  outOfRange: boolean;
  fx: SeatFx[];
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const s = p.seat;
  const ch = s.character ? CHARACTER_INFO[s.character] : null;
  const cls = [
    'opp',
    p.current ? 'current' : '',
    s.alive ? '' : 'dead',
    p.targetable ? 'targetable' : '',
    p.outOfRange ? 'out-of-range' : '',
    ...p.fx,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      style={p.style}
      data-testid="seat-panel"
      data-anchor={`seat:${s.seat}`}
      role={p.targetable ? 'button' : undefined}
      onClick={p.targetable ? p.onClick : undefined}
    >
      {s.role === 'captain' && <span className="crown" aria-label="선장">👑</span>}
      <div className="face">{s.character ? CHARACTER_FACE[s.character] : '❔'}</div>
      <div className="nm">
        {s.name}
        {s.isAi ? ' 🤖' : ''}
      </div>
      <div className="mini cname" title={ch?.text}>
        {ch?.name ?? '?'}
      </div>
      <div className="hp" aria-label={`체력 ${s.hp}/${s.maxHp}`}>{hearts(s.hp, s.maxHp)}</div>
      <div className="mini hand-count">
        <CardBack size="sm" />
        <span>×{s.handCount}</span>
      </div>
      <div className="equip-row" data-anchor={`equip:${s.seat}`}>
        {s.equipment.map((c) => (
          <CardFace key={c.id} card={c} size="sm" />
        ))}
      </div>
      {s.role && <div className="mini role">{roleName(s.role)}</div>}
      {s.alive && p.distance !== undefined && <div className="mini dist">거리 {p.distance}</div>}
    </div>
  );
}

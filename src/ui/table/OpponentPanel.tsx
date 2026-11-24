import type { CSSProperties } from 'react';
import { CHARACTER_INFO } from '../../engine/characters/roster';
import type { CardView, SeatView } from '../../engine/types';
import { CARD_CATALOG } from '../../engine/cards/catalog';
import { roleName } from '../format';
import { CardBack, CardFace } from './Card';
import { Portrait } from './Portrait';

export type SeatFx = 'shake' | 'dying' | 'turn-glow';

export function hearts(hp: number, maxHp: number): string {
  return '♥'.repeat(Math.max(hp, 0)) + '♡'.repeat(Math.max(maxHp - Math.max(hp, 0), 0));
}

/** 선장 자리 위에 걸치는 금색 리본 */
export function CaptainRibbon() {
  return <span className="captain-ribbon">👑 선장</span>;
}

export function OpponentPanel(p: {
  seat: SeatView;
  current: boolean;
  distance?: number;
  targetable: boolean;
  outOfRange: boolean;
  fx: SeatFx[];
  /** 마고 능력으로 엿본 카드 */
  peeked?: CardView | null;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const s = p.seat;
  const ch = s.character ? CHARACTER_INFO[s.character] : null;
  const cls = [
    'opp',
    p.current ? 'current' : '',
    s.role === 'captain' ? 'captain' : '',
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
      {s.role === 'captain' && <CaptainRibbon />}
      <div className="face"><Portrait id={s.character} variant="face" /></div>
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
      {p.peeked && (
        <div className="mini peek-memo" title="마고 능력으로 엿본 카드">
          👁 엿본 카드: {CARD_CATALOG[p.peeked.kind].name}
        </div>
      )}
      {s.role && s.role !== 'captain' && <div className="mini role">{roleName(s.role)}</div>}
      {s.alive && p.distance !== undefined && <div className="mini dist">거리 {p.distance}</div>}
    </div>
  );
}

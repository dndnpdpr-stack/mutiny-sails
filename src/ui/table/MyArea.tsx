import { CHARACTER_INFO } from '../../engine/characters/roster';
import { Portrait } from './Portrait';
import type { CardView, Role, SeatView } from '../../engine/types';
import { RoleCard } from './RoleCard';
import { CardFace } from './Card';
import { FanHand } from './FanHand';
import { hearts, type SeatFx } from './OpponentPanel';

export interface Spectate {
  fast: boolean;
  onToggleFast: () => void;
  onRestart: () => void;
}

export function MyArea(p: {
  me: SeatView;
  myRole: Role | null;
  myRange: number;
  current: boolean;
  fx: SeatFx[];
  hand: CardView[];
  canPlay: (id: string) => boolean;
  highlight: (id: string) => boolean;
  selectedId: string | null;
  onCardClick: (id: string) => void;
  onCardInfo: (id: string) => void;
  canEndTurn: boolean;
  onEndTurn: () => void;
  /** 직접 쓰는 능력이 없는 캐릭터면 null (데릭·도로시·키키만) */
  ability: { enabled: boolean; onUse: () => void } | null;
  spectate?: Spectate;
}) {
  const me = p.me;
  const ch = me.character ? CHARACTER_INFO[me.character] : null;
  const cls = ['me-info', 'panel', p.current ? 'current' : '', me.alive ? '' : 'dead', ...p.fx].filter(Boolean).join(' ');
  return (
    <div className="my-area">
      <div className="me-cards">
        <div className={cls} data-anchor={`seat:${me.seat}`}>
          <div className="face me-face">
            <Portrait id={me.character} variant="face" />
          </div>
          <div className="me-name">
            <b>{me.name}</b>
          </div>
          <div className="me-char">{ch?.name ?? '?'}</div>
          <div className="ability">{ch?.text ?? ''}</div>
          <div className="hp" aria-label={`체력 ${me.hp}/${me.maxHp}`}>
            {hearts(me.hp, me.maxHp)}
          </div>
          <div className="mini">사거리 {p.myRange}</div>
        </div>
        <RoleCard role={p.myRole} revealed={p.myRole !== null} size="sm" label="내 역할 카드" />
      </div>
      <div className="equip-row my-equip" data-anchor={`equip:${me.seat}`}>
        {me.equipment.map((c) => (
          <CardFace key={c.id} card={c} size="sm" />
        ))}
      </div>
      {me.alive ? (
        <FanHand cards={p.hand} canPlay={p.canPlay} highlight={p.highlight} selectedId={p.selectedId} onCardClick={p.onCardClick} onCardInfo={p.onCardInfo} />
      ) : (
        <div className="spectating" data-anchor="hand">
          <span>관전 중</span>
          {p.spectate && (
            <span className="spectate-controls">
              <button type="button" className={p.spectate.fast ? 'on' : ''} aria-pressed={p.spectate.fast} onClick={p.spectate.onToggleFast}>
                ⏩ 빨리 감기
              </button>
              <button type="button" onClick={p.spectate.onRestart}>
                새로 하기
              </button>
            </span>
          )}
        </div>
      )}
      <div className="actions">
        {p.ability && (
          <button type="button" disabled={!p.ability.enabled} onClick={p.ability.onUse}>
            능력 사용
          </button>
        )}
        <button type="button" className="end-turn" disabled={!p.canEndTurn} onClick={p.onEndTurn}>
          턴 종료
        </button>
      </div>
    </div>
  );
}

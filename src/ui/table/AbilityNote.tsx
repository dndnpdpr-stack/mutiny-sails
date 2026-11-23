import { useState } from 'react';
import type { Action, PlayerView } from '../../engine/types';
import { CardFace } from './Card';
import { Note } from './PromptNote';

/** 도로시: 럼주로 회복시킬 수 있는 다른 사람 */
export function dorothyTargets(view: PlayerView): number[] {
  return view.seats.filter((s) => s.alive && s.seat !== view.you && s.hp < s.maxHp).map((s) => s.seat);
}

/** 키키: 장비가 있는 살아있는 사람 */
export function kikiTargets(view: PlayerView): number[] {
  return view.seats.filter((s) => s.alive && s.equipment.length > 0).map((s) => s.seat);
}

/** 선의 도로시: 회복시킬 사람을 고른다 (럼주는 손패의 첫 장) */
export function DorothyNote(p: { view: PlayerView; send: (a: Action) => void; onClose: () => void }) {
  const rum = p.view.myHand.find((c) => c.kind === 'rum');
  return (
    <Note title="선의 도로시: 누구를 회복시킬까요?">
      {rum &&
        dorothyTargets(p.view).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => {
              p.send({ type: 'useAbility', cardIds: [rum.id], target: t });
              p.onClose();
            }}
          >
            {p.view.seats[t].name}
          </button>
        ))}
      <button type="button" onClick={p.onClose}>
        취소
      </button>
    </Note>
  );
}

/** 원숭이 조련사 키키: 버릴 손패 1장과 버리게 할 장비 1장을 고른다 */
export function KikiNote(p: { view: PlayerView; send: (a: Action) => void; onClose: () => void }) {
  const [mine, setMine] = useState<string | null>(null);
  const pick = (target: number, targetCardId: string) => {
    if (!mine) return;
    p.send({ type: 'useAbility', cardIds: [mine], target, targetCardId });
    p.onClose();
  };
  return (
    <Note title="원숭이 조련사 키키: 손패 1장을 버리고 장비 1장을 버리게 해요">
      <p>{mine ? '버리게 할 장비를 고르세요' : '먼저 버릴 손패를 고르세요'}</p>
      <div className="note-cards">
        {p.view.myHand.map((c) => (
          <CardFace key={c.id} card={c} size="sm" selected={mine === c.id} onClick={() => setMine(mine === c.id ? null : c.id)} />
        ))}
      </div>
      {kikiTargets(p.view).map((t) => (
        <div key={t} className="note-gear">
          <b>{p.view.seats[t].name}</b>
          <div className="note-cards">
            {p.view.seats[t].equipment.map((c) => (
              <CardFace key={c.id} card={c} size="sm" dim={!mine} onClick={() => pick(t, c.id)} />
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={p.onClose}>
        취소
      </button>
    </Note>
  );
}

import { useEffect, useState } from 'react';
import { CHARACTER_INFO } from '../../engine/characters/roster';
import type { Action, PlayerView } from '../../engine/types';
import { CharacterCard } from '../table/CharacterCard';
import { RoleCard } from '../table/RoleCard';

export function DraftScreen({ view, send }: { view: PlayerView; send: (a: Action) => void }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(true), []);

  const pending = view.pending?.kind === 'chooseCharacter' ? view.pending : null;
  const mine = pending && pending.seat === view.you ? pending : null;
  const me = view.seats[view.you];

  return (
    <div className="table-bg screen-center">
      <div className="scroll-panel draft">
        <RoleCard role={view.myRole} revealed={revealed} />
        {mine ? (
          <>
            <h3>캐릭터를 고르세요</h3>
            <div className="draft-options">
              {mine.options.map((id) => (
                <CharacterCard key={id} id={id} onClick={() => send({ type: 'chooseCharacter', character: id })} />
              ))}
            </div>
          </>
        ) : (
          <>
            <h3>다른 선원들이 캐릭터를 고르는 중…</h3>
            {me.character && <CharacterCard id={me.character} />}
            <ul className="draft-rows">
              {view.seats.map((s) => (
                <li key={s.seat}>
                  <span>{s.name}</span>{' '}
                  <span>{s.character ? CHARACTER_INFO[s.character].name : pending?.seat === s.seat ? '고르는 중' : '대기'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

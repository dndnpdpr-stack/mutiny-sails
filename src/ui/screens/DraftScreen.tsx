import { CHARACTER_INFO } from '../../engine/characters/roster';
import type { Action, PlayerView } from '../../engine/types';
import { CharacterCard } from '../table/CharacterCard';
import { RoleCard } from '../table/RoleCard';

/** 엎어 둔 역할 카드 펼침. 이미 뽑힌 자리에는 뽑은 사람 이름을 남긴다 */
function RoleSpread({ view, send }: { view: PlayerView; send: (a: Action) => void }) {
  const p = view.pending?.kind === 'drawRole' ? view.pending : null;
  const total = view.seats.length;
  const takenBy = new Map<number, string>();
  for (const e of view.events) if (e.type === 'roleDrawn') takenBy.set(e.slot, view.seats[e.seat].name);
  const mine = p && p.seat === view.you;
  return (
    <div className="role-spread">
      {Array.from({ length: total }, (_, slot) => {
        const free = p ? p.slots.includes(slot) : !takenBy.has(slot);
        if (!free) {
          return (
            <div key={slot} className="role-slot taken">
              <div className="pcard back sm" />
              <span>{takenBy.get(slot) ?? ''}</span>
            </div>
          );
        }
        return mine ? (
          <button key={slot} type="button" className="role-slot pick" aria-label={`역할 카드 ${slot + 1}번`} onClick={() => send({ type: 'drawRole', slot })}>
            <div className="pcard back md" />
          </button>
        ) : (
          <div key={slot} className="role-slot">
            <div className="pcard back md" />
          </div>
        );
      })}
    </div>
  );
}

export function DraftScreen({ view, send }: { view: PlayerView; send: (a: Action) => void }) {
  const p = view.pending;
  const me = view.seats[view.you];
  const captain = view.seats.find((s) => s.role === 'captain');
  const rolePhase = p?.kind === 'drawRole';
  const pick = p?.kind === 'chooseCharacter' && p.seat === view.you ? p : null;
  const choosing = p?.kind === 'chooseCharacter' ? p : null;

  return (
    <div className="table-bg screen-center">
      <div className="scroll-panel draft">
        <RoleCard role={view.myRole} special={view.mySpecial} revealed={view.myRole !== null} />
        {captain && <p className="captain-call">👑 선장은 {captain.name}</p>}

        {rolePhase ? (
          <>
            <h3>{p.seat === view.you ? '역할 카드를 뽑으세요' : `${view.seats[p.seat].name}이(가) 역할 카드를 고르는 중…`}</h3>
            <RoleSpread view={view} send={send} />
          </>
        ) : pick ? (
          <>
            <h3>캐릭터를 고르세요</h3>
            <div className="draft-options">
              {pick.options.map((id) => (
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
                  <span>{s.character ? CHARACTER_INFO[s.character].name : choosing?.seat === s.seat ? '고르는 중' : '대기'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

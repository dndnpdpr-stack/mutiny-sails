import { useEffect, useState } from 'react';
import type { Action, PlayerView, PlayHint, SeatId } from '../engine/types';
import { CHARACTER_INFO } from '../engine/characters/roster';
import { CardBox } from './CardBox';
import { HandView } from './HandView';
import { PromptDialog } from './PromptDialog';
import { SeatPanel } from './SeatPanel';
import { formatEvent, roleName } from './format';

export function GameScreen({ view, send, lastRejection }: { view: PlayerView; send: (a: Action) => void; lastRejection: string | null }) {
  const [selected, setSelected] = useState<PlayHint | null>(null);
  const [pickEquip, setPickEquip] = useState<{ cardId: string; target: SeatId } | null>(null);
  const me = view.seats[view.you];
  const myTurn = view.pending?.kind === 'turn' && view.pending.seat === view.you;
  const name = (s: SeatId) => view.seats[s].name;

  useEffect(() => {
    if (!myTurn) {
      setSelected(null);
      setPickEquip(null);
    }
  }, [myTurn, view.myHand.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null);
        setPickEquip(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCardClick = (cardId: string) => {
    if (selected?.cardId === cardId) return setSelected(null);
    const hint = view.hints.find((h) => h.cardId === cardId);
    if (!hint) return;
    setPickEquip(null);
    if (hint.targets === null) return send({ type: 'playCard', cardId });
    setSelected(hint);
  };

  const onSeatClick = (target: SeatId) => {
    if (!selected) return;
    if (selected.targetCards && view.seats[target].equipment.length > 0) {
      setPickEquip({ cardId: selected.cardId, target });
      return;
    }
    send({ type: 'playCard', cardId: selected.cardId, target });
    setSelected(null);
  };

  const slashes = view.myHand.filter((c) => c.kind === 'slash');
  const others = view.seats.filter((s) => s.seat !== view.you);
  const lastEvents = view.events.slice(-10);

  return (
    <div className="game">
      <div className="seats">
        {others.map((s) => (
          <SeatPanel
            key={s.seat}
            view={view}
            seat={s.seat}
            highlight={!!selected?.targets?.includes(s.seat)}
            onClick={() => onSeatClick(s.seat)}
          />
        ))}
      </div>

      <div className="table">
        <div>덱 {view.deckCount}장</div>
        <div className="discard">{view.discardTop ? <CardBox card={view.discardTop} /> : '버린 카드 없음'}</div>
        <ul className="log">
          {lastEvents.map((e, i) => (
            <li key={i}>{formatEvent(e, name)}</li>
          ))}
        </ul>
      </div>

      <div className="me">
        <div>
          <b>{me.name}</b> · {roleName(view.myRole)} · {(me.character ? CHARACTER_INFO[me.character].name : '?')} · 체력 {me.hp}/{me.maxHp} · 사거리 {view.myRange}
        </div>
        <div className="ability">{me.character ? CHARACTER_INFO[me.character].text : ''}</div>
        <div className="seat-equip">
          {me.equipment.map((c) => (
            <CardBox key={c.id} card={c} />
          ))}
        </div>
        {me.alive ? (
          <>
            <HandView view={view} selectedId={selected?.cardId ?? null} onCardClick={onCardClick} />
            {pickEquip && (
              <div className="choice">
                <button onClick={() => (send({ type: 'playCard', cardId: pickEquip.cardId, target: pickEquip.target }), setPickEquip(null), setSelected(null))}>
                  손패 무작위
                </button>
                {view.seats[pickEquip.target].equipment.map((c) => (
                  <CardBox
                    key={c.id}
                    card={c}
                    onClick={() => (send({ type: 'playCard', cardId: pickEquip.cardId, target: pickEquip.target, targetCardId: c.id }), setPickEquip(null), setSelected(null))}
                  />
                ))}
              </div>
            )}
            <div className="actions">
              <button disabled={!myTurn} onClick={() => send({ type: 'endTurn' })}>
                턴 종료
              </button>
              {me.character === 'derrick' && (
                <button disabled={!myTurn || slashes.length < 2} onClick={() => send({ type: 'useAbility', cardIds: slashes.slice(0, 2).map((c) => c.id) })}>
                  능력 사용
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="spectating">관전 중</div>
        )}
      </div>

      <PromptDialog view={view} send={send} />
      {lastRejection && <div className="toast">{lastRejection}</div>}
    </div>
  );
}

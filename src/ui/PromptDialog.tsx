import { useState, type ReactNode } from 'react';
import type { Action, PlayerView } from '../engine/types';
import { CardBox } from './CardBox';

export function PromptDialog({ view, send }: { view: PlayerView; send: (a: Action) => void }) {
  const p = view.pending;
  const [picked, setPicked] = useState<string[]>([]);
  if (!p || p.seat !== view.you || p.kind === 'turn') return null;
  const hand = view.myHand;
  const ofKind = (k: string) => hand.filter((c) => c.kind === k);
  const respond = (ids: string[]) => send({ type: 'respond', cardIds: ids });
  const others = view.seats.filter((s) => s.alive && s.seat !== view.you);

  let title = '';
  let body: ReactNode = null;
  switch (p.kind) {
    case 'respondAttack': {
      const d = ofKind('dodge');
      title = `${view.seats[p.attacker].name}의 ${p.source === 'cannonade' ? '포격' : '칼질'}!`;
      body = (
        <>
          <button disabled={!d.length} onClick={() => respond([d[0].id])}>피하기 내기</button>
          <button onClick={() => respond([])}>맞기</button>
        </>
      );
      break;
    }
    case 'respondBrawl': {
      const s = ofKind('slash');
      title = `${view.seats[p.attacker].name}의 갑판 난투!`;
      body = (
        <>
          <button disabled={!s.length} onClick={() => respond([s[0].id])}>칼질 내기</button>
          <button onClick={() => respond([])}>맞기</button>
        </>
      );
      break;
    }
    case 'respondDuel': {
      const s = ofKind('slash');
      title = `${view.seats[p.opponent].name}와(과) 결투 중!`;
      body = (
        <>
          <button disabled={s.length < p.required} onClick={() => respond(s.slice(0, p.required).map((c) => c.id))}>
            칼질 {p.required}장 내기
          </button>
          <button onClick={() => respond([])}>포기</button>
        </>
      );
      break;
    }
    case 'dying': {
      const r = ofKind('rum');
      title = '쓰러지기 직전이에요!';
      body = (
        <>
          <button disabled={r.length < p.need} onClick={() => respond(r.slice(0, p.need).map((c) => c.id))}>
            럼주 {p.need}장 내기
          </button>
          <button onClick={() => respond([])}>쓰러지기</button>
        </>
      );
      break;
    }
    case 'discardExcess':
      title = `카드를 ${p.count}장 버려 주세요`;
      body = (
        <>
          <div className="hand">
            {hand.map((c) => (
              <CardBox
                key={c.id}
                card={c}
                selected={picked.includes(c.id)}
                onClick={() => setPicked((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
              />
            ))}
          </div>
          <button
            disabled={picked.length !== p.count}
            onClick={() => {
              send({ type: 'discard', cardIds: picked });
              setPicked([]);
            }}
          >
            버리기 ({picked.length}/{p.count})
          </button>
        </>
      );
      break;
    case 'loot':
    case 'judgeChoice': {
      const list = p.kind === 'loot' ? p.revealed : p.options;
      title = p.kind === 'loot' ? '가져갈 전리품을 고르세요' : '판정에 쓸 카드를 고르세요';
      body = (
        <div className="hand">
          {list.map((c) => (
            <CardBox key={c.id} card={c} onClick={() => send({ type: 'chooseCard', cardId: c.id })} />
          ))}
        </div>
      );
      break;
    }
    case 'peekTarget':
    case 'passKeg':
      title = p.kind === 'peekTarget' ? '손패를 엿볼 사람을 고르세요' : '화약통을 넘길 사람을 고르세요';
      body = others.map((s) => (
        <button key={s.seat} onClick={() => send({ type: 'chooseSeat', target: s.seat })}>
          {s.name}
        </button>
      ));
      break;
    case 'drawSource':
      title = '첫 장을 어디서 뽑을까요?';
      body = (
        <>
          <button onClick={() => send({ type: 'chooseDrawSource', fromDiscard: false })}>덱에서</button>
          <button disabled={!view.discardTop} onClick={() => send({ type: 'chooseDrawSource', fromDiscard: true })}>
            버린 카드에서
          </button>
        </>
      );
      break;
  }

  return (
    <div className="overlay">
      <div className="dialog" role="dialog">
        <h3>{title}</h3>
        <div className="dialog-body">{body}</div>
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import type { Action, CardKind, CardView, PlayerView } from '../../engine/types';
import { CardFace } from './Card';
import { judgeReasonName } from '../format';
import type { AttackSource } from '../../engine/types';

const ATTACK_NAME: Record<AttackSource, string> = { slash: '칼질', cannonade: '포격', fireShip: '불붙은 배' };

/** 지금 내 응답에 낼 수 있는 카드 종류와 장수. 응답 차례가 아니면 null */
export function responseNeed(view: PlayerView): { kind: CardKind; count: number } | null {
  const p = view.pending;
  if (!p || p.seat !== view.you) return null;
  switch (p.kind) {
    case 'respondAttack':
      return { kind: 'dodge', count: 1 };
    case 'respondBrawl':
      return { kind: 'slash', count: 1 };
    case 'respondDuel':
      return { kind: 'slash', count: p.required };
    case 'dying':
      return { kind: 'rum', count: p.need };
    default:
      return null;
  }
}

/** 손패의 cardId로 응답할 카드 묶음(같은 종류로 필요한 장수만큼). 모자라면 null */
export function responseWith(view: PlayerView, cardId: string): string[] | null {
  const need = responseNeed(view);
  const card = view.myHand.find((c) => c.id === cardId);
  if (!need || !card || card.kind !== need.kind) return null;
  const rest = view.myHand.filter((c) => c.kind === need.kind && c.id !== cardId);
  const ids = [cardId, ...rest.map((c) => c.id)].slice(0, need.count);
  return ids.length === need.count ? ids : null;
}

export function Note(p: { title: string; children: ReactNode }) {
  return (
    <div className="note-overlay">
      <div className="note" role="dialog" aria-label={p.title}>
        <h3>{p.title}</h3>
        <div className="note-body">{p.children}</div>
      </div>
    </div>
  );
}

/** 마고 능력: 엿본 카드를 보여주는 쪽지 */
export function PeekNote(p: { targetName: string; card: CardView; onClose: () => void }) {
  return (
    <Note title="엿본 카드">
      <p>{p.targetName}의 손패에서 본 카드예요.</p>
      <div className="note-cards">
        <CardFace card={p.card} />
      </div>
      <button type="button" onClick={p.onClose}>
        확인
      </button>
    </Note>
  );
}

/** 대상의 장비/손패 무작위를 고르는 작은 쪽지 (소매치기·밧줄 자르기) */
export function TargetCardNote(p: { targetName: string; equipment: CardView[]; handCount: number; onPick: (cardId: string | null) => void; onCancel: () => void }) {
  return (
    <Note title={`${p.targetName}에게서 무엇을?`}>
      <div className="note-cards">
        {p.equipment.map((c) => (
          <CardFace key={c.id} card={c} size="sm" onClick={() => p.onPick(c.id)} />
        ))}
      </div>
      {p.handCount > 0 && (
        <button type="button" onClick={() => p.onPick(null)}>
          손패 무작위
        </button>
      )}
      <button type="button" onClick={p.onCancel}>
        취소
      </button>
    </Note>
  );
}

/** latest.pending 기준의 응답 창 */
export function PromptNote({ view, send }: { view: PlayerView; send: (a: Action) => void }) {
  const p = view.pending;
  const [picked, setPicked] = useState<string[]>([]);
  const pendingKey = p ? `${p.kind}:${p.seat}` : '';
  useEffect(() => setPicked([]), [pendingKey]);
  if (!p || p.seat !== view.you || p.kind === 'turn' || p.kind === 'chooseCharacter') return null;

  const hand = view.myHand;
  const ofKind = (k: CardKind) => hand.filter((c) => c.kind === k);
  const respond = (ids: string[]) => send({ type: 'respond', cardIds: ids });
  const others = view.seats.filter((s) => s.alive && s.seat !== view.you);

  let title = '';
  let body: ReactNode = null;
  switch (p.kind) {
    case 'respondAttack': {
      const d = ofKind('dodge');
      title = `${view.seats[p.attacker].name}의 ${ATTACK_NAME[p.source]}!`;
      body = (
        <>
          <button type="button" disabled={!d.length} onClick={() => respond([d[0].id])}>피하기 내기</button>
          <button type="button" onClick={() => respond([])}>맞기</button>
        </>
      );
      break;
    }
    case 'respondBrawl': {
      const s = ofKind('slash');
      title = `${view.seats[p.attacker].name}의 갑판 난투!`;
      body = (
        <>
          <button type="button" disabled={!s.length} onClick={() => respond([s[0].id])}>칼질 내기</button>
          <button type="button" onClick={() => respond([])}>맞기</button>
        </>
      );
      break;
    }
    case 'respondDuel': {
      const s = ofKind('slash');
      title = `${view.seats[p.opponent].name}와(과) 결투 중!`;
      body = (
        <>
          <button type="button" disabled={s.length < p.required} onClick={() => respond(s.slice(0, p.required).map((c) => c.id))}>
            칼질 {p.required}장 내기
          </button>
          <button type="button" onClick={() => respond([])}>포기</button>
        </>
      );
      break;
    }
    case 'dying': {
      const r = ofKind('rum');
      title = '쓰러지기 직전이에요!';
      body = (
        <>
          <button type="button" disabled={r.length < p.need} onClick={() => respond(r.slice(0, p.need).map((c) => c.id))}>
            럼주 {p.need}장 내기
          </button>
          <button type="button" onClick={() => respond([])}>쓰러지기</button>
        </>
      );
      break;
    }
    case 'discardExcess':
      title = `카드를 ${p.count}장 버려 주세요`;
      body = (
        <>
          <div className="note-cards">
            {hand.map((c) => (
              <CardFace
                key={c.id}
                card={c}
                size="sm"
                selected={picked.includes(c.id)}
                onClick={() => setPicked((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
              />
            ))}
          </div>
          <button
            type="button"
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
    case 'treasureMap':
    case 'judgeChoice': {
      const list = p.kind === 'judgeChoice' ? p.options : p.revealed;
      title =
        p.kind === 'loot'
          ? '가져갈 전리품을 고르세요'
          : p.kind === 'treasureMap'
            ? '🗺️ 보물 지도: 가져갈 1장을 고르세요 (나머지는 버려져요)'
            : `${judgeReasonName(p.reason)} 판정에 쓸 카드를 고르세요`;
      body = (
        <div className="note-cards">
          {list.map((c) => (
            <CardFace key={c.id} card={c} size="sm" onClick={() => send({ type: 'chooseCard', cardId: c.id })} />
          ))}
        </div>
      );
      break;
    }
    case 'peekTarget':
    case 'passKeg':
      title = p.kind === 'peekTarget' ? '손패를 엿볼 사람을 고르세요' : '화약통을 넘길 사람을 고르세요';
      body = others.map((s) => (
        <button type="button" key={s.seat} onClick={() => send({ type: 'chooseSeat', target: s.seat })}>
          {s.name}
        </button>
      ));
      break;
    case 'fortune':
      title = '🔮 덱 맨 위 카드예요';
      body = (
        <>
          {p.card && (
            <div className="note-cards">
              <CardFace card={p.card} />
            </div>
          )}
          <button type="button" onClick={() => send({ type: 'fortune', toBottom: false })}>그대로 두기</button>
          <button type="button" onClick={() => send({ type: 'fortune', toBottom: true })}>맨 밑으로</button>
        </>
      );
      break;
    case 'drawSource':
      title = '첫 장을 어디서 뽑을까요?';
      body = (
        <>
          <button type="button" onClick={() => send({ type: 'chooseDrawSource', fromDiscard: false })}>덱에서</button>
          <button type="button" disabled={!view.discardTop} onClick={() => send({ type: 'chooseDrawSource', fromDiscard: true })}>
            버린 카드에서
          </button>
        </>
      );
      break;
  }

  return <Note title={title}>{body}</Note>;
}

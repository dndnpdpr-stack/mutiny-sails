import { useEffect, useRef, useState } from 'react';
import { CARD_CATALOG, type CardInfo } from '../../engine/cards/catalog';
import { CHARACTER_IDS } from '../../engine/characters/roster';
import type { Role } from '../../engine/types';
import { SEA_EVENTS, SEA_EVENT_IDS } from '../../engine/seaEvents';
import { CardFace } from '../table/Card';
import { CharacterCard } from '../table/CharacterCard';
import { RoleCard } from '../table/RoleCard';

type Tab = 'rules' | 'roles' | 'characters' | 'cards' | 'sea';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'rules', label: '기본 규칙' },
  { id: 'roles', label: '역할' },
  { id: 'characters', label: '캐릭터' },
  { id: 'cards', label: '카드' },
  { id: 'sea', label: '바다 이벤트' },
];

function SeaEvents() {
  return (
    <div className="guide-sea">
      <p>
        시작 화면에서 켜 두면, 두 번째 라운드부터 선장의 턴이 시작될 때마다 바다 이벤트 카드 1장을 펼쳐요. 다음 이벤트가 나올 때까지 모두에게 적용되고,
        "펼쳐질 때"라고 적힌 효과는 그 순간 한 번만 일어나요. 12장을 다 쓰면 다시 섞어요.
      </p>
      <ul className="guide-sea-list">
        {SEA_EVENT_IDS.map((id) => (
          <li key={id}>
            <span className="sea-icon" aria-hidden="true">{SEA_EVENTS[id].icon}</span>
            <b>{SEA_EVENTS[id].name}</b>
            <span className="guide-text">{SEA_EVENTS[id].text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ROLES: Role[] = ['captain', 'loyalist', 'rebel', 'spy'];
/** 인원별 역할 구성 (선장, 충성 선원, 반란 선원, 첩자, 현상금 사냥꾼). 8~9인의 충성·반란에는 항해사·이중 첩자 1명씩이 들어 있다 */
const ROLE_COUNTS: Array<[number, number, number, number, number, number]> = [
  [4, 1, 0, 2, 1, 0],
  [5, 1, 1, 2, 1, 0],
  [6, 1, 1, 3, 1, 0],
  [7, 1, 2, 3, 1, 0],
  [8, 1, 2, 3, 1, 1],
  [9, 1, 3, 3, 1, 1],
];

function Rules() {
  return (
    <div className="guide-rules">
      <h3>목표</h3>
      <p>
        모두 정체를 숨긴 채 시작해요. 선장만 정체가 공개돼요. 자기 역할의 승리 조건을 먼저 채우는 쪽이 이겨요. 누가 같은 편인지는 행동을 보고
        짐작해야 해요.
      </p>
      <h3>시작</h3>
      <p>역할 카드를 골라 뽑고(선장 카드만 모두에게 공개), 캐릭터 3장 중 1장을 골라요. 체력만큼 카드를 받아요(선장은 체력 +1). 선장부터 시계 방향으로 돌아가요.</p>
      <h3>내 턴</h3>
      <ol>
        <li>덱에서 카드 2장을 뽑아요.</li>
        <li>원하는 만큼 카드를 내요. 단, 칼질은 한 턴에 1번만 쓸 수 있어요(쌍권총이 있으면 제한 없음). 카드 설명은 손패를 우클릭하거나(웹) 길게 누르면(폰) 볼 수 있어요.</li>
        <li>턴 종료를 누르고, 손패가 체력보다 많으면 넘치는 만큼 버려요.</li>
      </ol>
      <h3>거리와 사거리</h3>
      <p>
        옆자리는 거리 1, 한 칸 건너면 거리 2예요(양쪽 중 가까운 쪽, 쓰러진 사람은 건너뛰어요). 칼질은 상대까지의 거리가 내 무기 사거리 이하일 때만 쓸 수 있어요. 무기가
        없으면 사거리 1이에요. 망원경은 내가 남을 볼 때 거리 −1, 작은 보트는 남이 나를 볼 때 거리 +1이에요.
      </p>
      <h3>체력과 쓰러짐</h3>
      <p>
        체력이 0 이하가 되면 체력이 1 이상이 될 때까지 필요한 만큼 럼주를 내서 버틸 수 있어요(두 명만 남으면 불가). 버티지 못하면 쓰러지고 역할이 공개돼요. 반란 선원을 쓰러뜨리면 카드 3장을
        받고, 선장이 충성 선원을 쓰러뜨리면 손패와 장비를 모두 버려요.
      </p>
      <h3>판정</h3>
      <p>엄폐용 나무통, 화약통, 영창은 덱 맨 위 카드를 뒤집어 문양으로 결과를 정해요.</p>
    </div>
  );
}

function Roles() {
  return (
    <div className="guide-roles">
      <div className="guide-grid">
        {ROLES.map((r) => (
          <RoleCard key={r} role={r} revealed />
        ))}
      </div>
      <h3>인원별 역할</h3>
      <table className="guide-table">
        <thead>
          <tr>
            <th>인원</th>
            <th>선장</th>
            <th>충성 선원</th>
            <th>반란 선원</th>
            <th>첩자</th>
            <th>사냥꾼</th>
          </tr>
        </thead>
        <tbody>
          {ROLE_COUNTS.map(([n, ...counts]) => (
            <tr key={n}>
              <td>{n}명</td>
              {counts.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>선장이 쓰러졌을 때 반란 선원이 한 명이라도 살아 있으면 반란 선원이 이겨요. 반란 선원이 모두 쓰러져 있고 첩자가 살아 있으면 첩자가 혼자 이겨요(충성 선원이 남아 있어도요).</p>
      <h3>확장 역할 (8~9인)</h3>
      <p>8명 이상이면 역할 카드에 확장 역할이 섞여요. 표의 충성 선원 중 1명은 항해사, 반란 선원 중 1명은 이중 첩자예요.</p>
      <div className="guide-grid">
        <RoleCard role="loyalist" special="navigator" revealed />
        <RoleCard role="rebel" special="doubleAgent" revealed />
        <RoleCard role="hunter" revealed />
      </div>
      <ul className="guide-expansion-roles">
        <li>
          <b>🧭 항해사</b> (선장 편): 충성 선원과 같아요. 시작할 때 반란 선원 1명의 정체를 몰래 알아요(이중 첩자일 수도 있어요). 들키지 않게 선장을 도와요.
        </li>
        <li>
          <b>🎭 이중 첩자</b> (반란 편): 반란 선원과 같아요. 앵무새 고자질로 정체를 들켜도 충성 선원으로 보여요. 쓰러지면 진짜 정체가 드러나요.
        </li>
        <li>
          <b>💰 현상금 사냥꾼</b> (혼자): 시작할 때 비밀 표적 1명을 받아요(선장은 아니에요). 표적을 <b>직접</b> 쓰러뜨리고 게임이 끝날 때까지 살아 있으면, 어느 편이
          이기든 함께 이겨요. 다른 사람이 표적을 먼저 쓰러뜨리면 새 표적을 받아 다시 사냥해요. 사냥꾼이 살아 있어도 다른 편의 승리를 막지 않아요.
        </li>
      </ul>
    </div>
  );
}

function CardEntry({ info }: { info: CardInfo }) {
  return (
    <div className="guide-card">
      <CardFace card={{ id: `guide-${info.kind}`, kind: info.kind, suit: 'spades', rank: 14 }} size="sm" />
      <div>
        <b>
          {info.name} <span className="guide-count">×{info.count}</span>
          {info.expansion && <span className="guide-tag">확장</span>}
        </b>
        <div className="guide-text">{info.text}</div>
      </div>
    </div>
  );
}

function Cards() {
  const all = Object.values(CARD_CATALOG);
  return (
    <div className="guide-cards">
      <h3>즉시 사용 카드</h3>
      <div className="guide-card-list">
        {all.filter((c) => c.category === 'action').map((c) => (
          <CardEntry key={c.kind} info={c} />
        ))}
      </div>
      <h3>장비 카드</h3>
      <p className="guide-note">내 앞에 놓아두면 효과가 계속돼요(영창은 다른 사람 앞에 놓아요). 같은 장비는 하나만 둘 수 있고, 무기는 하나만 쓸 수 있어서 새 무기를 내면 이전 무기는 버려져요.</p>
      <div className="guide-card-list">
        {all.filter((c) => c.category === 'equipment').map((c) => (
          <CardEntry key={c.kind} info={c} />
        ))}
      </div>
    </div>
  );
}

/** 시작 화면의 "게임 방법" 창. 캐릭터·카드 설명은 게임 데이터에서 그대로 가져온다 */
export function HowToPlay(p: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('rules');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.onClose]);

  return (
    <div className="guide-overlay" onClick={p.onClose}>
      <div className="guide scroll-panel" role="dialog" aria-modal="true" aria-label="게임 방법" onClick={(e) => e.stopPropagation()}>
        <div className="guide-head">
          <h2>게임 방법</h2>
          <button ref={closeRef} type="button" className="guide-close" aria-label="닫기" onClick={p.onClose}>
            ✕
          </button>
        </div>
        <div className="guide-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="guide-body">
          {tab === 'rules' && <Rules />}
          {tab === 'roles' && <Roles />}
          {tab === 'characters' && (
            <div className="guide-grid">
              {CHARACTER_IDS.map((id) => (
                <CharacterCard key={id} id={id} />
              ))}
            </div>
          )}
          {tab === 'cards' && <Cards />}
          {tab === 'sea' && <SeaEvents />}
        </div>
      </div>
    </div>
  );
}

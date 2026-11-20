import { useEffect, useRef, useState } from 'react';
import { CARD_CATALOG, type CardInfo } from '../../engine/cards/catalog';
import { CHARACTER_IDS } from '../../engine/characters/roster';
import type { Role } from '../../engine/types';
import { CardFace } from '../table/Card';
import { CharacterCard } from '../table/CharacterCard';
import { RoleCard } from '../table/RoleCard';

type Tab = 'rules' | 'roles' | 'characters' | 'cards';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'rules', label: '기본 규칙' },
  { id: 'roles', label: '역할' },
  { id: 'characters', label: '캐릭터' },
  { id: 'cards', label: '카드' },
];

const ROLES: Role[] = ['captain', 'loyalist', 'rebel', 'spy'];
/** 인원별 역할 구성 (선장, 충성 선원, 반란 선원, 첩자) */
const ROLE_COUNTS: Array<[number, number, number, number, number]> = [
  [4, 1, 0, 2, 1],
  [5, 1, 1, 2, 1],
  [6, 1, 1, 3, 1],
  [7, 1, 2, 3, 1],
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
      <p>역할 카드를 받고, 캐릭터 2장 중 1장을 골라요. 체력만큼 카드를 받아요(선장은 체력 +1). 선장부터 시계 방향으로 돌아가요.</p>
      <h3>내 턴</h3>
      <ol>
        <li>덱에서 카드 2장을 뽑아요.</li>
        <li>원하는 만큼 카드를 내요. 단, 칼질은 한 턴에 1번만 쓸 수 있어요(쌍권총이 있으면 제한 없음).</li>
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
      <p>선장이 쓰러졌을 때 첩자 혼자 남아 있으면 첩자가, 아니면 반란 선원이 이겨요.</p>
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
        </div>
      </div>
    </div>
  );
}

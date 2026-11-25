import { useEffect, useRef, useState } from 'react';
import titleArt from '../art/title.svg';
import { HowToPlay } from './HowToPlay';
import { RecordPanel } from './RecordPanel';
import { loadRecord, rate } from '../record';
import { enterFullscreen, fullscreenAvailable, isTouchDevice, loadAutoFullscreen, saveAutoFullscreen } from '../fullscreen';
import type { Difficulty } from '../../ai/memory';

export interface SetupOptions {
  seaEvents: boolean;
  expansionCards: boolean;
  difficulty: Difficulty;
}

const DIFFICULTY_KEY = 'mutiny.difficulty';
const DIFFICULTIES: { id: Difficulty; name: string; text: string }[] = [
  { id: 'easy', name: '쉬움', text: '단순하게 싸워요. 가끔 같은 편도 헷갈려요.' },
  { id: 'normal', name: '보통', text: '누가 어느 편인지 행동을 보고 추리해요.' },
  { id: 'hard', name: '어려움', text: '정체를 숨기고 있다가 기회가 오면 몰아쳐요.' },
];

const COUNT_KEY = 'mutiny.playerCount';
const DEFAULT_COUNT = 5;

/** 지난번에 고른 인원. 처음이면 5명 */
function loadCount(): number {
  try {
    const n = Number(localStorage.getItem(COUNT_KEY));
    return Number.isInteger(n) && n >= 4 && n <= 9 ? n : DEFAULT_COUNT;
  } catch {
    return DEFAULT_COUNT;
  }
}

function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFFICULTY_KEY);
    return v === 'easy' || v === 'hard' ? v : 'normal';
  } catch {
    return 'normal';
  }
}

export function SetupScreen({ onStart }: { onStart: (playerCount: number, name: string, options: SetupOptions) => void }) {
  const [count, setCountState] = useState(loadCount);
  const setCount = (n: number) => {
    setCountState(n);
    try {
      localStorage.setItem(COUNT_KEY, String(n));
    } catch {
      // 저장이 막혀 있으면 이번만
    }
  };
  const [sea, setSea] = useState(true);
  const [expansion, setExpansion] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>(loadDifficulty);
  const pickDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    try {
      localStorage.setItem(DIFFICULTY_KEY, d);
    } catch {
      // 저장이 막혀 있으면 이번만
    }
  };
  const [name, setName] = useState('');
  const [guide, setGuide] = useState(false);
  const [record, setRecord] = useState(loadRecord);
  const [showRecord, setShowRecord] = useState(false);
  // 폰에서만: 출항을 누르는 순간 전체 화면으로(브라우저는 누른 순간에만 허락한다)
  const [showFsOption] = useState(() => fullscreenAvailable() && isTouchDevice());
  const [autoFs, setAutoFs] = useState(loadAutoFullscreen);
  const panelRef = useRef<HTMLDivElement>(null);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // 게임 방법 창이 열린 동안 뒤 화면은 키보드·클릭 모두 막고, 닫히면 버튼으로 포커스를 돌려준다
  useEffect(() => {
    panelRef.current?.toggleAttribute('inert', guide);
    if (wasOpen.current && !guide) guideButtonRef.current?.focus();
    wasOpen.current = guide;
  }, [guide]);
  return (
    <div className="table-bg screen-center">
      <div className="scroll-panel setup" ref={panelRef}>
        <div className="title-block">
          <img className="title-art" src={titleArt} alt="반란의 돛 타이틀 그림" draggable={false} />
          <h1 className="logo">반란의 돛</h1>
          <p className="subtitle">정체를 숨긴 해적들의 카드 게임</p>
        </div>
        <label>
          이름
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="나" maxLength={12} />
        </label>
        <div className="count">
          {[4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" className={`count-card${n === count ? ' selected' : ''}`} onClick={() => setCount(n)}>
              {n}명
            </button>
          ))}
        </div>
        {count >= 8 && (
          <small className="expansion-note">🧭🎭💰 {count}인은 확장 역할(항해사·이중 첩자·현상금 사냥꾼)이 들어가요. 게임 방법 → 역할에서 볼 수 있어요.</small>
        )}
        <label className="toggle">
          <input type="checkbox" checked={sea} onChange={(e) => setSea(e.target.checked)} />
          🌊 바다 이벤트 <small>(두 번째 라운드부터 매 라운드 규칙이 바뀌어요)</small>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={expansion} onChange={(e) => setExpansion(e.target.checked)} />
          🃏 확장 카드 <small>(새 카드 10종 16장을 덱에 섞어요)</small>
        </label>
        {showFsOption && (
          <label className="toggle">
            <input type="checkbox" checked={autoFs} onChange={(e) => (setAutoFs(e.target.checked), saveAutoFullscreen(e.target.checked))} />
            📱 출항하면 전체 화면 <small>(주소창·상태 표시줄을 숨겨요. 게임 중 ⛶ 버튼으로도 켜고 꺼요)</small>
          </label>
        )}
        <div className="difficulty">
          <span className="difficulty-label">🤖 AI 난이도</span>
          <div className="difficulty-options">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} type="button" className={d.id === difficulty ? 'selected' : ''} aria-pressed={d.id === difficulty} onClick={() => pickDifficulty(d.id)}>
                {d.name}
              </button>
            ))}
          </div>
          <small>{DIFFICULTIES.find((d) => d.id === difficulty)!.text}</small>
        </div>
        <button type="button" className="record-chip" onClick={() => setShowRecord(true)}>
          📜 내 전적 {record.games ? `${record.games}전 ${record.wins}승 (${rate(record)})` : '없음'}
        </button>
        <div className="setup-actions">
          <button ref={guideButtonRef} type="button" className="secondary" onClick={() => setGuide(true)}>
            게임 방법
          </button>
          <button type="button" className="primary" onClick={() => {
              if (showFsOption && autoFs) enterFullscreen();
              onStart(count, name.trim(), { seaEvents: sea, expansionCards: expansion, difficulty });
            }}>
            출항
          </button>
        </div>
      </div>
      {guide && <HowToPlay onClose={() => setGuide(false)} />}
      {showRecord && <RecordPanel record={record} onChange={setRecord} onClose={() => setShowRecord(false)} />}
    </div>
  );
}

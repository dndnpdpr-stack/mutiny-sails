import { useEffect, useRef, useState } from 'react';
import titleArt from '../art/title.svg';
import { HowToPlay } from './HowToPlay';

export function SetupScreen({ onStart }: { onStart: (playerCount: number, name: string, seaEvents: boolean) => void }) {
  const [count, setCount] = useState(5);
  const [sea, setSea] = useState(true);
  const [name, setName] = useState('');
  const [guide, setGuide] = useState(false);
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
          {[4, 5, 6, 7].map((n) => (
            <button key={n} type="button" className={`count-card${n === count ? ' selected' : ''}`} onClick={() => setCount(n)}>
              {n}명
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={sea} onChange={(e) => setSea(e.target.checked)} />
          🌊 바다 이벤트 <small>(두 번째 라운드부터 매 라운드 규칙이 바뀌어요)</small>
        </label>
        <div className="setup-actions">
          <button ref={guideButtonRef} type="button" className="secondary" onClick={() => setGuide(true)}>
            게임 방법
          </button>
          <button type="button" className="primary" onClick={() => onStart(count, name.trim(), sea)}>
            출항
          </button>
        </div>
      </div>
      {guide && <HowToPlay onClose={() => setGuide(false)} />}
    </div>
  );
}

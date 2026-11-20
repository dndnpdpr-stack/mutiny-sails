import { useState } from 'react';
import titleArt from '../art/title.svg';

export function SetupScreen({ onStart }: { onStart: (playerCount: number, name: string) => void }) {
  const [count, setCount] = useState(5);
  const [name, setName] = useState('');
  return (
    <div className="table-bg screen-center">
      <div className="scroll-panel setup">
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
        <button type="button" className="primary" onClick={() => onStart(count, name.trim())}>
          출항
        </button>
      </div>
    </div>
  );
}

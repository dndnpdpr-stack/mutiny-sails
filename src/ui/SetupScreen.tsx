import { useState } from 'react';

export function SetupScreen({ onStart }: { onStart: (playerCount: number, name: string) => void }) {
  const [count, setCount] = useState(5);
  const [name, setName] = useState('');
  return (
    <div className="setup">
      <h1>반란의 돛</h1>
      <p>정체를 숨긴 해적들의 카드 게임</p>
      <label>
        이름
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="나" maxLength={12} />
      </label>
      <div className="count">
        인원
        {[4, 5, 6, 7].map((n) => (
          <button key={n} className={n === count ? 'selected' : ''} onClick={() => setCount(n)}>
            {n}명
          </button>
        ))}
      </div>
      <button onClick={() => onStart(count, name.trim())}>시작</button>
    </div>
  );
}

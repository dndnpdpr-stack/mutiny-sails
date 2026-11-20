import { useEffect, useState } from 'react';
import { CHARACTER_INFO } from '../../engine/characters/roster';
import type { PlayerView, SeatView } from '../../engine/types';
import { winnerText } from '../format';
import { RoleCard } from '../table/RoleCard';
import { Portrait } from '../table/Portrait';

function ResultSeat({ s, index }: { s: SeatView; index: number }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), index * 200);
    return () => clearTimeout(t);
  }, [index]);
  return (
    <li className="result-seat">
      <RoleCard role={s.role} revealed={revealed} />
      <div className="face rs-face"><Portrait id={s.character} variant="face" /></div>
      <div className="rs-name">{s.name}</div>
      <div className="rs-char">{s.character ? CHARACTER_INFO[s.character].name : '?'}</div>
      {!s.alive && <div className="rs-dead">쓰러짐</div>}
    </li>
  );
}

export function ResultScreen({ view, onRestart }: { view: PlayerView; onRestart: () => void }) {
  return (
    <div className="table-bg screen-center">
      <div className="scroll-panel result">
        <h1>{winnerText(view.winner!)}</h1>
        <ul className="result-seats">
          {view.seats.map((s, i) => (
            <ResultSeat key={s.seat} s={s} index={i} />
          ))}
        </ul>
        <button type="button" className="primary" onClick={onRestart}>
          다시 하기
        </button>
      </div>
    </div>
  );
}

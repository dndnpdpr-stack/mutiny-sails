import type { PlayerView } from '../engine/types';
import { CHARACTER_INFO } from '../engine/characters/roster';
import { roleName, winnerText } from './format';

export function ResultScreen({ view, onRestart }: { view: PlayerView; onRestart: () => void }) {
  return (
    <div className="result">
      <h2>{winnerText(view.winner!)}</h2>
      <ul>
        {view.seats.map((s) => (
          <li key={s.seat}>
            {s.name} — {s.role ? roleName(s.role) : '?'} · {CHARACTER_INFO[s.character].name} {s.alive ? '' : '(쓰러짐)'}
          </li>
        ))}
      </ul>
      <button onClick={onRestart}>다시 하기</button>
    </div>
  );
}

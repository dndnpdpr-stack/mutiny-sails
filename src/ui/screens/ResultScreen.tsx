import { useEffect, useRef, useState } from 'react';
import { CHARACTER_INFO } from '../../engine/characters/roster';
import type { PlayerView, SeatStats, SeatView } from '../../engine/types';
import { pickMvp } from '../mvp';
import { winnerText } from '../format';
import { RoleCard } from '../table/RoleCard';
import { Portrait } from '../table/Portrait';
import { addGame, didIWin, loadRecord, myRecordRole, rate, type MyRecord } from '../record';
import { recordRoleName } from './RecordPanel';

function ResultSeat({ s, index, stat, mvp }: { s: SeatView; index: number; stat?: SeatStats; mvp: boolean }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), index * 200);
    return () => clearTimeout(t);
  }, [index]);
  return (
    <li className={`result-seat${mvp ? ' is-mvp' : ''}`}>
      {mvp && <span className="mvp-badge">🏅 MVP</span>}
      <RoleCard role={s.role} special={s.special} revealed={revealed} />
      <div className="face rs-face"><Portrait id={s.character} variant="face" /></div>
      <div className="rs-name">{s.name}</div>
      <div className="rs-char">{s.character ? CHARACTER_INFO[s.character].name : '?'}</div>
      {!s.alive && <div className="rs-dead">쓰러짐</div>}
      {stat && <div className="rs-stat">피해 {stat.damage} · 처치 {stat.kills}</div>}
    </li>
  );
}

export function ResultScreen({ view, onRestart }: { view: PlayerView; onRestart: () => void }) {
  const mvp = pickMvp(view.seats, view.winner!, view.stats);
  const m = mvp !== null ? view.seats[mvp] : null;
  const ms = mvp !== null ? view.stats?.[mvp] : undefined;
  const won = didIWin(view);
  const role = myRecordRole(view);
  // 끝난 판은 한 번만 전적에 더한다
  const [record, setRecord] = useState<MyRecord | null>(null);
  const saved = useRef(false);
  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    setRecord(addGame(loadRecord(), role, won));
  }, [role, won]);
  const roleTally = role ? record?.byRole[role] : undefined;
  return (
    <div className="table-bg screen-center">
      <div className="scroll-panel result">
        <h1>{winnerText(view.winner!)}</h1>
        {view.bountyWon && <p className="bounty-won">💰 현상금 사냥꾼 {view.seats.find((s) => s.role === 'hunter')?.name}도 승리!</p>}
        <p className={`my-result ${won ? 'won' : 'lost'}`}>{won ? '🎉 내가 이겼어요!' : '😢 내가 졌어요'}</p>
        {record && (
          <p className="record-line">
            📜 통산 {record.games}전 {record.wins}승 ({rate(record)})
            {record.streak > 1 && ` · 🔥 ${record.streak}연승`}
            {role && roleTally && ` · ${recordRoleName(role)} ${roleTally.games}전 ${roleTally.wins}승`}
          </p>
        )}
        {m && (
          <div className="mvp">
            <span className="mvp-title">🏅 MVP</span>
            <b>{m.name}</b>
            <span>
              {m.character ? CHARACTER_INFO[m.character].name : ''} · 피해 {ms?.damage ?? 0} · 처치 {ms?.kills ?? 0}
            </span>
          </div>
        )}
        <ul className="result-seats">
          {view.seats.map((s, i) => (
            <ResultSeat key={s.seat} s={s} index={i} stat={view.stats?.[s.seat]} mvp={s.seat === mvp} />
          ))}
        </ul>
        <button type="button" className="primary" onClick={onRestart}>
          다시 하기
        </button>
      </div>
    </div>
  );
}

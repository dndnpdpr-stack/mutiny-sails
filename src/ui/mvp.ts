import type { SeatId, SeatStats, SeatView, Winner } from '../engine/types';

const onWinningTeam = (s: SeatView, w: Winner) =>
  w === 'captainTeam' ? s.role === 'captain' || s.role === 'loyalist' : w === 'rebels' ? s.role === 'rebel' : s.role === 'spy';

/** 이긴 편에서 준 피해 + 쓰러뜨린 수×3 + 살아남음 1 이 가장 큰 자리. 같으면 앞자리 */
export function pickMvp(seats: SeatView[], winner: Winner, stats: Record<SeatId, SeatStats> | undefined): SeatId | null {
  if (!stats) return null;
  const score = (s: SeatView) => (stats[s.seat]?.damage ?? 0) + 3 * (stats[s.seat]?.kills ?? 0) + (s.alive ? 1 : 0);
  let best: SeatView | null = null;
  for (const s of seats) if (onWinningTeam(s, winner) && (!best || score(s) > score(best))) best = s;
  return best?.seat ?? null;
}

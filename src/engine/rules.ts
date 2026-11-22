import type { CardKind, SeatId } from './types';
import type { Game } from './Game';
import { WeaponCard } from './cards/Card';

/** 바다 이벤트 등이 끼어드는 규칙 변경 */
export interface RuleModifier {
  distanceDelta?(from: SeatId, to: SeatId): number;
  drawCount?(base: number): number;
  slashLimit?(base: number): number;
  rangeDelta?(seat: SeatId): number;
  /** true면 그 장비의 효과가 없다 */
  disablesGear?(kind: CardKind): boolean;
  /** 럼주를 쓰러질 때만 낼 수 있다 */
  rumOnlyWhenDying?: boolean;
}

export function gearWorks(game: Game, kind: CardKind): boolean {
  return !game.modifiers.some((m) => m.disablesGear?.(kind));
}

export function seatDistance(game: Game, from: SeatId, to: SeatId): number {
  const alive = game.aliveSeats();
  const i = alive.indexOf(from);
  const j = alive.indexOf(to);
  if (i < 0 || j < 0) return Infinity;
  const d = Math.abs(i - j);
  return Math.min(d, alive.length - d);
}

export function distance(game: Game, from: SeatId, to: SeatId): number {
  let d = seatDistance(game, from, to);
  if (gearWorks(game, 'spyglass') && game.seats[from].equipment.some((c) => c.kind === 'spyglass')) d -= 1;
  if (gearWorks(game, 'dinghy') && game.seats[to].equipment.some((c) => c.kind === 'dinghy')) d += 1;
  d += game.seats[to].character.distanceBonusAgainstMe(game, to);
  for (const m of game.modifiers) if (m.distanceDelta) d += m.distanceDelta(from, to);
  return Math.max(1, d);
}

export function weapon(game: Game, seat: SeatId): WeaponCard | null {
  return (game.seats[seat].equipment.find((c) => c instanceof WeaponCard) as WeaponCard | undefined) ?? null;
}

export function weaponRange(game: Game, seat: SeatId): number {
  let r = weapon(game, seat)?.range ?? 1;
  for (const m of game.modifiers) if (m.rangeDelta) r += m.rangeDelta(seat);
  return r;
}

export function drawCount(game: Game, _seat: SeatId): number {
  let n = 2;
  for (const m of game.modifiers) if (m.drawCount) n = m.drawCount(n);
  return n;
}

export function slashLimit(game: Game, seat: SeatId): number {
  let n = weapon(game, seat)?.unlimitedSlash ? Infinity : 1;
  for (const m of game.modifiers) if (m.slashLimit) n = m.slashLimit(n);
  return n;
}

export function handLimit(game: Game, seat: SeatId): number {
  const s = game.seats[seat];
  return s.hp + s.character.handLimitBonus();
}

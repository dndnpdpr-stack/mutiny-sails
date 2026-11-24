import type { CardKind, PlayerView, SeatId } from '../engine/types';

/** AI 난이도. 쉬움: 단순 / 보통: 근거 있는 상대만 공격 / 어려움: 보통 + 정체 숨기기·몰아치기 */
export type Difficulty = 'easy' | 'normal' | 'hard';

/** 대상을 해치는 카드와, 그걸 누구에게 썼는지가 얼마나 강한 단서인지 */
const HOSTILE_WEIGHT: Partial<Record<CardKind, number>> = { slash: 1, duel: 1, brig: 1, fireShip: 1, pickpocket: 0.5, cutRope: 0.5, diceWager: 0.5 };

/**
 * 공개된 이벤트만 보고 각 자리의 성향을 추정한다.
 * captainFoe > 0: 선장을 노리는 쪽으로 보임, < 0: 선장 편으로 보임.
 */
export class AiMemory {
  captainFoe: Record<SeatId, number> = {};
  /** 나를 해치는 카드를 쓴 사람 */
  private hitMe = new Set<SeatId>();
  /** 선장 턴이 몇 번 돌았는지 (라운드) */
  rounds = 0;
  private prev: string[] = [];

  constructor(public level: Difficulty = 'normal') {}

  attackedMe(seat: SeatId): boolean {
    return this.hitMe.has(seat);
  }

  foe(seat: SeatId): number {
    return this.captainFoe[seat] ?? 0;
  }

  private bump(seat: SeatId, by: number): void {
    this.captainFoe[seat] = this.foe(seat) + by;
  }

  update(view: PlayerView): void {
    const keys = view.events.map((e) => JSON.stringify(e));
    let start = 0;
    const prev = this.prev;
    for (let k = 0; k < prev.length; k++) {
      const overlap = prev.length - k;
      if (overlap > keys.length) continue;
      let same = true;
      for (let i = 0; i < overlap; i++) {
        if (prev[k + i] !== keys[i]) {
          same = false;
          break;
        }
      }
      if (same) {
        start = overlap;
        break;
      }
    }
    this.prev = keys;

    const role = (s: SeatId) => view.seats[s]?.role ?? null;
    // 쉬움은 예전처럼 칼질·결투·영창만 본다
    const weightOf = (k: CardKind) => (this.level === 'easy' ? (k === 'slash' || k === 'duel' || k === 'brig' ? 1 : 0) : (HOSTILE_WEIGHT[k] ?? 0));
    for (const e of view.events.slice(start)) {
      if (e.type === 'turnStart' && role(e.seat) === 'captain') this.rounds++;
      if (e.type === 'play' && e.target === view.you && e.seat !== view.you && (HOSTILE_WEIGHT[e.card.kind] ?? 0) > 0) this.hitMe.add(e.seat);
      const w = e.type === 'play' && e.target !== undefined && e.target !== e.seat ? weightOf(e.card.kind) : 0;
      if (e.type === 'play' && e.target !== undefined && w > 0) {
        const r = role(e.target);
        if (r === 'captain') this.bump(e.seat, 2 * w);
        else if (r === 'loyalist') this.bump(e.seat, w);
        else if (r === 'rebel') this.bump(e.seat, -w);
        else if (this.foe(e.target) > 0) this.bump(e.seat, -w);
        else if (this.foe(e.target) < 0) this.bump(e.seat, w);
      } else if (e.type === 'death' && e.killer !== null && e.killer !== e.seat) {
        if (e.role === 'rebel') this.bump(e.killer, -2);
        else if (e.role === 'loyalist') this.bump(e.killer, 2);
      }
    }
  }
}

import type { PlayerView, SeatId } from '../engine/types';

/**
 * 공개된 이벤트만 보고 각 자리의 성향을 추정한다.
 * captainFoe > 0: 선장을 노리는 쪽으로 보임, < 0: 선장 편으로 보임.
 */
export class AiMemory {
  captainFoe: Record<SeatId, number> = {};
  private prev: string[] = [];

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
    for (const e of view.events.slice(start)) {
      if (e.type === 'play' && e.target !== undefined && (e.card.kind === 'slash' || e.card.kind === 'duel' || e.card.kind === 'brig')) {
        if (role(e.target) === 'captain') this.bump(e.seat, 2);
        else if (this.foe(e.target) > 0) this.bump(e.seat, -1);
        else if (this.foe(e.target) < 0) this.bump(e.seat, 1);
      } else if (e.type === 'death' && e.killer !== null && e.killer !== e.seat) {
        if (e.role === 'rebel') this.bump(e.killer, -2);
        else if (e.role === 'loyalist') this.bump(e.killer, 2);
      }
    }
  }
}

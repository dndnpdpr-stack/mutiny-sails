import { pickMvp } from '../../src/ui/mvp';
import type { SeatView } from '../../src/engine/types';

const seat = (i: number, role: SeatView['role'], alive = true) =>
  ({ seat: i, name: `p${i}`, character: 'tom', hp: 1, maxHp: 4, alive, handCount: 0, equipment: [], role, isAi: true }) as SeatView;

describe('pickMvp', () => {
  const seats = [seat(0, 'captain'), seat(1, 'rebel', false), seat(2, 'rebel'), seat(3, 'spy', false), seat(4, 'loyalist')];

  it('picks from the winning team: damage + 3 per knockout + 1 for surviving', () => {
    const stats = { 0: { damage: 3, kills: 0 }, 1: { damage: 9, kills: 2 }, 2: { damage: 1, kills: 0 }, 3: { damage: 0, kills: 0 }, 4: { damage: 2, kills: 1 } };
    expect(pickMvp(seats, 'captainTeam', stats)).toBe(4); // 2+3+1=6 > 3+1=4
    expect(pickMvp(seats, 'rebels', stats)).toBe(1); // 9+6 > 1+1
  });

  it('the spy alone wins as the spy', () => {
    expect(pickMvp(seats, 'spy', { 0: { damage: 9, kills: 3 } })).toBe(3);
  });

  it('no stats, no MVP', () => {
    expect(pickMvp(seats, 'rebels', undefined)).toBeNull();
  });
});

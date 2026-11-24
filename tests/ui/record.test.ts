import { beforeEach, describe, expect, it } from 'vitest';
import { addGame, clearRecord, didIWin, loadRecord, myRecordRole, rate } from '../../src/ui/record';
import type { PlayerView } from '../../src/engine/types';

const view = (role: string, winner: string, extra: object = {}) =>
  ({ you: 0, myRole: role, seats: [{ seat: 0, name: '나', role, alive: true, ...extra }], winner, ...extra }) as unknown as PlayerView;

describe('my record', () => {
  beforeEach(() => localStorage.clear());

  it('decides my win from my team, and from the bounty for the hunter', () => {
    expect(didIWin(view('loyalist', 'captainTeam'))).toBe(true);
    expect(didIWin(view('rebel', 'captainTeam'))).toBe(false);
    expect(didIWin(view('spy', 'spy'))).toBe(true);
    expect(didIWin(view('hunter', 'rebels', { bountyWon: true }))).toBe(true);
    expect(didIWin(view('hunter', 'rebels', { bountyWon: false }))).toBe(false);
  });

  it('records special roles separately', () => {
    expect(myRecordRole(view('rebel', 'rebels', { special: 'doubleAgent' }))).toBe('doubleAgent');
    expect(myRecordRole(view('rebel', 'rebels'))).toBe('rebel');
  });

  it('adds games, keeps streaks and persists', () => {
    let r = loadRecord();
    r = addGame(r, 'captain', true);
    r = addGame(r, 'captain', true);
    r = addGame(r, 'rebel', false);
    r = addGame(r, 'rebel', true);
    expect(r).toMatchObject({ games: 4, wins: 3, streak: 1, bestStreak: 2 });
    expect(r.byRole.captain).toEqual({ games: 2, wins: 2 });
    expect(rate(r.byRole.rebel!)).toBe('50%');
    expect(loadRecord()).toEqual(r);
    expect(clearRecord().games).toBe(0);
    expect(loadRecord().games).toBe(0);
  });
});

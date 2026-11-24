import type { PlayerView, Role, Special } from '../engine/types';
import { onWinningTeam } from './mvp';

/** 전적을 나누는 역할: 기본 역할 + 8~9인 확장 변형 */
export type RecordRole = Role | Special;
export const RECORD_ROLES: RecordRole[] = ['captain', 'loyalist', 'navigator', 'rebel', 'doubleAgent', 'spy', 'hunter'];

export interface Tally {
  games: number;
  wins: number;
}
export interface MyRecord extends Tally {
  byRole: Partial<Record<RecordRole, Tally>>;
  /** 지금 이어지는 연승(진 판이면 0) */
  streak: number;
  bestStreak: number;
}

const KEY = 'mutiny.record';
export const emptyRecord = (): MyRecord => ({ games: 0, wins: 0, byRole: {}, streak: 0, bestStreak: 0 });

export function loadRecord(): MyRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyRecord();
    const r = JSON.parse(raw) as Partial<MyRecord>;
    return { ...emptyRecord(), ...r, byRole: { ...(r.byRole ?? {}) } };
  } catch {
    return emptyRecord();
  }
}

function save(r: MyRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // 저장이 막혀 있으면 이번 판은 기록하지 않는다
  }
}

export function clearRecord(): MyRecord {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
  return emptyRecord();
}

/** 끝난 게임에서 내 역할(변형이 있으면 변형) */
export function myRecordRole(view: PlayerView): RecordRole | null {
  const me = view.seats[view.you];
  return me?.special ?? view.mySpecial ?? me?.role ?? view.myRole ?? null;
}

/** 내가 이겼는지: 사냥꾼은 현상금을 받았을 때, 나머지는 내 편이 이겼을 때 */
export function didIWin(view: PlayerView): boolean {
  const me = view.seats[view.you];
  if (!view.winner || !me) return false;
  const role = me.role ?? view.myRole;
  if (role === 'hunter') return !!view.bountyWon;
  return onWinningTeam({ ...me, role }, view.winner);
}

/** 이 판을 더한 새 전적(저장까지) */
export function addGame(prev: MyRecord, role: RecordRole | null, won: boolean): MyRecord {
  const byRole = { ...prev.byRole };
  if (role) {
    const t = byRole[role] ?? { games: 0, wins: 0 };
    byRole[role] = { games: t.games + 1, wins: t.wins + (won ? 1 : 0) };
  }
  const streak = won ? prev.streak + 1 : 0;
  const next: MyRecord = { games: prev.games + 1, wins: prev.wins + (won ? 1 : 0), byRole, streak, bestStreak: Math.max(prev.bestStreak, streak) };
  save(next);
  return next;
}

export const rate = (t: Tally): string => (t.games ? `${Math.round((t.wins / t.games) * 100)}%` : '-');

import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import type { CharacterId } from '../../src/engine/types';
import { startPastRoles } from './helpers';

function fresh(n: number, seed = 1) {
  const g = new Game({ seed, names: Array.from({ length: n }, (_, i) => `p${i}`) });
  startPastRoles(g);
  return g;
}

function pick(g: Game, index = 0): CharacterId {
  const p = g.pending();
  if (!p || p.kind !== 'chooseCharacter') throw new Error('not drafting');
  const character = p.options[index];
  expect(g.apply(p.seat, { type: 'chooseCharacter', character })).toEqual({ ok: true });
  return character;
}

describe('character draft', () => {
  it('starts with captain choosing between three distinct characters', () => {
    const g = fresh(5);
    const p = g.pending();
    expect(p).toMatchObject({ kind: 'chooseCharacter', seat: g.captainSeat() });
    if (p?.kind !== 'chooseCharacter') throw new Error();
    expect(p.options).toHaveLength(3);
    expect(p.options[0]).not.toBe(p.options[1]);
  });

  it('nobody has hp or hand during the draft', () => {
    const g = fresh(5);
    pick(g);
    for (const s of g.seats) {
      expect(s.hand.length).toBe(0);
      expect(s.hp).toBe(0);
    }
  });

  it('asks captain first then clockwise; options never overlap chosen', () => {
    const n = 7;
    const g = fresh(n, 3);
    const cap = g.captainSeat();
    const chosen: CharacterId[] = [];
    for (let i = 0; i < n; i++) {
      const p = g.pending();
      if (p?.kind !== 'chooseCharacter') throw new Error('expected draft');
      expect(p.seat).toBe((cap + i) % n);
      expect(p.options).toHaveLength(3);
      for (const o of p.options) expect(chosen).not.toContain(o);
      chosen.push(pick(g, i % 2));
    }
    expect(new Set(chosen).size).toBe(n);
    expect(g.seats.map((s) => s.character.id).sort()).toEqual([...chosen].sort());
  });

  it('rejects characters outside options and other actions', () => {
    const g = fresh(4);
    const p = g.pending()!;
    if (p.kind !== 'chooseCharacter') throw new Error();
    const other = (['tom', 'margo', 'lou', 'derrick'] as CharacterId[]).find((c) => !p.options.includes(c))!;
    expect(g.apply(p.seat, { type: 'chooseCharacter', character: other }).ok).toBe(false);
    expect(g.apply(p.seat, { type: 'endTurn' }).ok).toBe(false);
    expect(g.pending()).toEqual(p);
  });

  it('after everyone chooses: hp, hands and captain turn', () => {
    const n = 5;
    const g = fresh(n);
    // 턴 시작에 따로 묻는 캐릭터(마고·오르)는 피해서 고른다
    for (let i = 0; i < n; i++) {
      const p = g.pending();
      if (p?.kind !== 'chooseCharacter') throw new Error('not drafting');
      pick(g, Math.max(0, p.options.findIndex((c) => c !== 'margo' && c !== 'ori')));
    }
    const cap = g.captainSeat();
    for (const s of g.seats) {
      expect(s.maxHp).toBe(s.character.maxHp + (s.seat === cap ? 1 : 0));
      expect(s.hp).toBe(s.maxHp);
    }
    expect(g.pending()).toEqual({ kind: 'turn', seat: cap });
    for (const s of g.seats) expect(s.hand.length).toBe(s.hp + (s.seat === cap ? 2 : 0));
  });

  it('emits public characterChosen events and gapless seq from 1', () => {
    const n = 6;
    const g = fresh(n);
    for (let i = 0; i < n; i++) pick(g);
    const chosen = g.events.filter((e) => e.type === 'characterChosen');
    expect(chosen).toHaveLength(n);
    for (const e of chosen) expect(e.visibleTo).toBeUndefined();
    expect(g.events.map((e) => e.seq)).toEqual(g.events.map((_, i) => i + 1));
  });

  it('forced characters skip the draft', () => {
    const g = new Game({ seed: 1, names: ['a', 'b', 'c', 'd'], characters: ['tom', 'margo', 'lou', 'derrick'] });
    startPastRoles(g);
    expect(g.pending()).toEqual({ kind: 'turn', seat: g.captainSeat() });
  });
});

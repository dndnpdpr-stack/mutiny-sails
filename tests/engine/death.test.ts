import type { Game } from '../../src/engine/Game';
import type { Role } from '../../src/engine/types';
import { giveEquip, makeGame, passUntil, setHand } from './helpers';

/** 5명 기본: 0 선장(hp5), 1 반란, 2 반란, 3 첩자, 4 충성 */
function started(roles?: Role[], n = 5): Game {
  const g = makeGame(n, roles ? { roles } : {});
  g.start();
  return g;
}

describe('death rewards and penalties', () => {
  it('killing a rebel draws 3 cards', () => {
    const g = started();
    const [slash] = setHand(g, 0, ['slash']);
    setHand(g, 1, []);
    g.seats[1].hp = 1;
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [] });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.seats[1].alive).toBe(false);
    expect(g.events.find((e) => e.type === 'death')).toMatchObject({ seat: 1, role: 'rebel', killer: 0 });
    expect(g.seats[0].hand.length).toBe(3);
  });

  it('captain killing a loyalist loses hand and equipment', () => {
    const g = started();
    const [slash] = setHand(g, 0, ['slash', 'dodge', 'rum']);
    giveEquip(g, 0, 'pistol');
    setHand(g, 4, []);
    g.seats[4].hp = 1;
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 4 });
    g.apply(4, { type: 'respond', cardIds: [] });
    g.apply(4, { type: 'respond', cardIds: [] });
    expect(g.seats[4].alive).toBe(false);
    expect(g.seats[0].hand.length).toBe(0);
    expect(g.seats[0].equipment.length).toBe(0);
  });
});

describe('win conditions', () => {
  it('spy wins by finishing the captain last', () => {
    const g = started(['captain', 'spy', 'rebel', 'rebel'], 4);
    g.kill(2, null);
    g.kill(3, null);
    expect(g.winner).toBeNull();
    const [duel] = setHand(g, 0, ['duel']);
    const [s] = setHand(g, 1, ['slash']);
    g.seats[0].hp = 1;
    g.apply(0, { type: 'playCard', cardId: duel.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [s.id] });
    g.apply(0, { type: 'respond', cardIds: [] });
    expect(g.winner).toBe('spy');
    expect(g.events.at(-1)).toMatchObject({ type: 'gameOver', winner: 'spy' });
  });

  it('rebels win if any rebel lives when the captain falls', () => {
    const g = started();
    const [duel] = setHand(g, 0, ['duel']);
    const [s] = setHand(g, 1, ['slash']);
    g.seats[0].hp = 1;
    g.apply(0, { type: 'playCard', cardId: duel.id, target: 1 });
    g.apply(1, { type: 'respond', cardIds: [s.id] });
    g.apply(0, { type: 'respond', cardIds: [] });
    g.apply(0, { type: 'respond', cardIds: [] });
    expect(g.winner).toBe('rebels');
  });

  it('captain team wins when rebels and spy are all down', () => {
    const g = started();
    g.kill(1, null);
    g.kill(2, null);
    const [slash] = setHand(g, 0, ['slash']);
    setHand(g, 3, []);
    g.seats[3].hp = 1;
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 3 });
    g.apply(3, { type: 'respond', cardIds: [] });
    g.apply(3, { type: 'respond', cardIds: [] });
    expect(g.winner).toBe('captainTeam');
  });

  it('game ends mid-cannonade: no further prompts, all actions rejected', () => {
    const g = started(['captain', 'loyalist', 'spy', 'loyalist', 'rebel']);
    passUntil(g, 4);
    const [cannon] = setHand(g, 4, ['cannonade']);
    setHand(g, 0, []);
    g.seats[0].hp = 1;
    g.apply(4, { type: 'playCard', cardId: cannon.id });
    expect(g.pending()).toMatchObject({ kind: 'respondAttack', seat: 0 });
    g.apply(0, { type: 'respond', cardIds: [] });
    expect(g.pending()).toEqual({ kind: 'dying', seat: 0, need: 1 });
    g.apply(0, { type: 'respond', cardIds: [] });
    expect(g.winner).toBe('rebels');
    expect(g.pending()).toBeNull();
    for (const seat of [1, 2, 3, 4]) expect(g.apply(seat, { type: 'respond', cardIds: [] }).ok).toBe(false);
    expect(g.events.filter((e) => e.type === 'gameOver').length).toBe(1);
  });

  it('a responder dying mid-cannonade does not stop the next responder', () => {
    const g = started();
    const [cannon] = setHand(g, 0, ['cannonade']);
    setHand(g, 2, []);
    g.seats[2].hp = 1;
    g.apply(0, { type: 'playCard', cardId: cannon.id });
    g.apply(1, { type: 'respond', cardIds: [] });
    g.apply(2, { type: 'respond', cardIds: [] });
    g.apply(2, { type: 'respond', cardIds: [] });
    expect(g.seats[2].alive).toBe(false);
    expect(g.pending()).toEqual({ kind: 'respondAttack', seat: 3, attacker: 0, source: 'cannonade' });
  });

  it('player who dies on own turn passes the turn on', () => {
    const g = makeGame(5, { characters: ['derrick', 'tom', 'hanna', 'orso', 'sila'] });
    g.start();
    passUntil(g, 1);
    const [duel] = setHand(g, 1, ['duel']);
    const [s] = setHand(g, 3, ['slash']);
    g.seats[1].hp = 1;
    g.apply(1, { type: 'playCard', cardId: duel.id, target: 3 });
    g.apply(3, { type: 'respond', cardIds: [s.id] });
    g.apply(1, { type: 'respond', cardIds: [] });
    g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.seats[1].alive).toBe(false);
    expect(g.current).toBe(2);
    expect(g.pending()).toEqual({ kind: 'turn', seat: 2 });
  });
});

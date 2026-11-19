import { Game } from '../../src/engine/Game';
import { defaultActionFor } from '../../src/engine/defaults';
import type { CharacterId, PendingView } from '../../src/engine/types';
import { giveEquip, makeGame, passTurn, pull, setHand } from './helpers';

function applyDefault(g: Game) {
  const p = g.pending()!;
  return g.apply(p.seat, defaultActionFor(g, p));
}

function expectDefaultOk(g: Game, kind: PendingView['kind']) {
  expect(g.pending()?.kind).toBe(kind);
  expect(applyDefault(g)).toEqual({ ok: true });
}

const chars = (c: CharacterId[]) => makeGame(5, { characters: c });

describe('defaultActionFor', () => {
  it('turn', () => {
    const g = makeGame(5);
    g.start();
    expectDefaultOk(g, 'turn');
  });
  it('discardExcess', () => {
    const g = makeGame(5);
    g.start();
    g.apply(0, { type: 'endTurn' });
    expectDefaultOk(g, 'discardExcess');
    expect(g.seats[0].hand.length).toBe(5);
  });
  it('respondAttack, respondBrawl, respondDuel, dying', () => {
    const g = makeGame(5);
    g.start();
    const [slash, brawl, duel] = setHand(g, 0, ['slash', 'brawl', 'duel']);
    g.apply(0, { type: 'playCard', cardId: slash.id, target: 1 });
    expectDefaultOk(g, 'respondAttack');
    g.apply(0, { type: 'playCard', cardId: brawl.id });
    expectDefaultOk(g, 'respondBrawl');
    while (g.pending()?.kind === 'respondBrawl') applyDefault(g);
    g.seats[3].hp = 1;
    g.apply(0, { type: 'playCard', cardId: duel.id, target: 3 });
    expectDefaultOk(g, 'respondDuel');
    expectDefaultOk(g, 'dying');
  });
  it('loot', () => {
    const g = makeGame(5);
    g.start();
    const [loot] = setHand(g, 0, ['loot']);
    g.apply(0, { type: 'playCard', cardId: loot.id });
    expectDefaultOk(g, 'loot');
  });
  it('judgeChoice (sila)', () => {
    const g = chars(['derrick', 'sila', 'hanna', 'orso', 'bruno']);
    g.start();
    giveEquip(g, 1, 'brig');
    passTurn(g);
    expectDefaultOk(g, 'judgeChoice');
  });
  it('peekTarget (margo)', () => {
    const g = chars(['margo', 'derrick', 'hanna', 'orso', 'bruno']);
    g.start();
    expectDefaultOk(g, 'peekTarget');
  });
  it('passKeg (bibi)', () => {
    const g = chars(['derrick', 'bibi', 'hanna', 'orso', 'bruno']);
    g.start();
    giveEquip(g, 1, 'powderKeg');
    passTurn(g);
    expectDefaultOk(g, 'passKeg');
  });
  it('drawSource (lou)', () => {
    const g = chars(['lou', 'derrick', 'hanna', 'orso', 'bruno']);
    g.discard.push(pull(g, 'rum'));
    g.start();
    expectDefaultOk(g, 'drawSource');
  });

  it('chooseCharacter', () => {
    const g = new Game({ seed: 1, names: ['a', 'b', 'c', 'd'] });
    g.start();
    expectDefaultOk(g, 'chooseCharacter');
  });

  it('defaults alone never break a game', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const n = 4 + (seed % 4);
      const g = new Game({ seed, names: Array.from({ length: n }, (_, i) => `P${i}`) });
      g.start();
      for (let i = 0; i < 1500 && g.pending(); i++) expect(applyDefault(g).ok).toBe(true);
    }
  });
});

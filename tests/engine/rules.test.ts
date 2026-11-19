import { distance, handLimit, weaponRange } from '../../src/engine/rules';
import { giveEquip, makeGame } from './helpers';

describe('distance rules', () => {
  it('seat distance around the table', () => {
    const g = makeGame(5);
    expect(distance(g, 0, 1)).toBe(1);
    expect(distance(g, 0, 2)).toBe(2);
    expect(distance(g, 0, 3)).toBe(2);
    expect(distance(g, 0, 4)).toBe(1);
  });
  it('skips dead seats', () => {
    const g = makeGame(5);
    g.seats[2].alive = false;
    expect(distance(g, 1, 3)).toBe(1);
  });
  it('dinghy adds, spyglass subtracts, min 1', () => {
    const g = makeGame(5);
    giveEquip(g, 2, 'dinghy');
    expect(distance(g, 0, 2)).toBe(3);
    giveEquip(g, 0, 'spyglass');
    expect(distance(g, 0, 2)).toBe(2);
    expect(distance(g, 0, 1)).toBe(1);
  });
  it('weapon range', () => {
    const g = makeGame(5);
    expect(weaponRange(g, 0)).toBe(1);
    giveEquip(g, 0, 'pistol');
    expect(weaponRange(g, 0)).toBe(2);
    giveEquip(g, 1, 'deckCannon');
    expect(weaponRange(g, 1)).toBe(5);
  });
  it('rule modifiers change distance (sea event hook)', () => {
    const g = makeGame(5);
    g.modifiers.push({ distanceDelta: () => 1 });
    expect(distance(g, 0, 1)).toBe(2);
    expect(distance(g, 0, 2)).toBe(3);
  });
  it('hand limit is hp, orso gets +2', () => {
    const g = makeGame(5); // seat 3 = orso
    expect(handLimit(g, 0)).toBe(g.seats[0].hp);
    expect(g.seats[3].character.id).toBe('orso');
    expect(handLimit(g, 3)).toBe(g.seats[3].hp + 2);
  });
  it('hanna with 3+ cards in front is harder to reach', () => {
    const g = makeGame(5); // seat 2 = hanna
    expect(distance(g, 0, 2)).toBe(2);
    giveEquip(g, 2, 'pistol');
    giveEquip(g, 2, 'spyglass');
    expect(distance(g, 0, 2)).toBe(2);
    giveEquip(g, 2, 'dinghy'); // 보트 +1, 한나 +1
    expect(distance(g, 0, 2)).toBe(4);
  });
});

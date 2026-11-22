import type { Game } from '../../src/engine/Game';
import { distance, seatDistance, slashLimit, weaponRange } from '../../src/engine/rules';
import { SEA_EVENTS, SEA_EVENT_IDS, type SeaEventId } from '../../src/engine/seaEvents';
import { buildView } from '../../src/host/view';
import { giveEquip, giveHand, makeGame, passTurn, setHand, stackTop } from './helpers';

const noAi = () => false;

function withEvents(order: SeaEventId[], n = 4): Game {
  return makeGame(n, { seaEvents: true, seaEventOrder: order });
}

/** 선장(0번)의 다음 턴 직전까지, 마지막 사람 턴에서 멈춘다 */
function toLastSeatOfRound(g: Game) {
  g.start();
  while (g.current !== g.seats.length - 1) passTurn(g);
}

/** 두 번째 라운드 선장 턴까지 진행 */
function toRound2(g: Game) {
  toLastSeatOfRound(g);
  passTurn(g);
}

const lastOf = (g: Game, type: string) => [...g.events].reverse().find((e) => e.type === type);

describe('sea events', () => {
  it('has 12 events, each with a name, icon and text', () => {
    expect(SEA_EVENT_IDS).toHaveLength(12);
    for (const id of SEA_EVENT_IDS) {
      expect(SEA_EVENTS[id].name).toBeTruthy();
      expect(SEA_EVENTS[id].icon).toBeTruthy();
      expect(SEA_EVENTS[id].text).toBeTruthy();
    }
  });

  it('are off by default', () => {
    const g = makeGame(4);
    toRound2(g);
    expect(g.seaEvent).toBeNull();
    expect(g.events.some((e) => e.type === 'seaEvent')).toBe(false);
  });

  it('nothing in the first round; the second captain turn reveals the next event before its turn starts', () => {
    const g = withEvents(['calmSea', 'storm']);
    g.start();
    expect(g.seaEvent).toBeNull();
    passTurn(g);
    passTurn(g);
    passTurn(g);
    expect(g.seaEvent).toBeNull();
    passTurn(g);
    expect(g.current).toBe(0);
    expect(g.seaEvent).toBe('calmSea');
    const i = g.events.findIndex((e) => e.type === 'seaEvent');
    expect(g.events[i]).toMatchObject({ type: 'seaEvent', event: 'calmSea' });
    expect(g.events[i + 1]).toMatchObject({ type: 'turnStart', seat: 0 });
  });

  it('a new event replaces the previous one and its rule', () => {
    const g = withEvents(['storm', 'calmSea']);
    toRound2(g);
    expect(distance(g, 0, 1)).toBe(seatDistance(g, 0, 1) + 1);
    for (let i = 0; i < 4; i++) passTurn(g);
    expect(g.seaEvent).toBe('calmSea');
    expect(distance(g, 0, 1)).toBe(seatDistance(g, 0, 1));
  });

  it('reshuffles the event deck when it runs out', () => {
    const g = withEvents(['calmSea']);
    toRound2(g);
    for (let i = 0; i < 4; i++) passTurn(g);
    expect(SEA_EVENT_IDS).toContain(g.seaEvent);
  });

  it('storm: every distance +1', () => {
    const g = withEvents(['storm']);
    toRound2(g);
    expect(distance(g, 2, 3)).toBe(2);
  });

  it('fair wind: draw 3 in the draw phase', () => {
    const g = withEvents(['fairWind']);
    toRound2(g);
    expect(lastOf(g, 'draw')).toMatchObject({ seat: 0, count: 3 });
  });

  it('doldrums: draw only 1 in the draw phase', () => {
    const g = withEvents(['doldrums']);
    toRound2(g);
    expect(lastOf(g, 'draw')).toMatchObject({ seat: 0, count: 1 });
  });

  it('fog: spyglass and dinghy do nothing', () => {
    const g = withEvents(['fog']);
    toRound2(g);
    giveEquip(g, 0, 'spyglass');
    giveEquip(g, 2, 'dinghy');
    expect(distance(g, 0, 2)).toBe(seatDistance(g, 0, 2));
  });

  it('flag festival: two slashes a turn', () => {
    const g = withEvents(['flagFestival']);
    toRound2(g);
    expect(slashLimit(g, 0)).toBe(2);
    const [a, b] = [giveHand(g, 0, 'slash'), giveHand(g, 0, 'slash')];
    expect(g.apply(0, { type: 'playCard', cardId: a.id, target: 1 }).ok).toBe(true);
    if (g.pending()?.kind === 'respondAttack') g.apply(1, { type: 'respond', cardIds: [] });
    expect(g.apply(0, { type: 'playCard', cardId: b.id, target: 1 }).ok).toBe(true);
  });

  it('high tide: everyone reaches 1 further', () => {
    const g = withEvents(['highTide']);
    toRound2(g);
    expect(weaponRange(g, 1)).toBe(2);
  });

  it('supply shortage: rum only when dying', () => {
    const g = withEvents(['shortage']);
    toRound2(g);
    g.seats[0].hp = 1;
    const rum = giveHand(g, 0, 'rum');
    const r = g.apply(0, { type: 'playCard', cardId: rum.id });
    expect(r.ok).toBe(false);
    // 쓰러질 때는 낼 수 있다
    g.dealDamage(0, 1, null);
    expect(g.pending()).toMatchObject({ kind: 'dying', seat: 0 });
  });

  it('sea monster: everyone judges from the captain, a spade costs 1 hp', () => {
    const g = withEvents(['seaMonster']);
    toLastSeatOfRound(g);
    stackTop(g, [{ suit: 'spades', rank: 10 }, { suit: 'hearts' }, { suit: 'spades', rank: 10 }, { suit: 'clubs' }]);
    const hp = g.seats.map((s) => s.hp);
    passTurn(g);
    const judged = g.events.filter((e) => e.type === 'judge');
    expect(judged.map((e) => (e.type === 'judge' ? [e.seat, e.reason] : null))).toEqual([
      [0, 'seaMonster'], [1, 'seaMonster'], [2, 'seaMonster'], [3, 'seaMonster'],
    ]);
    expect(g.seats.map((s) => s.hp)).toEqual([hp[0] - 1, hp[1], hp[2] - 1, hp[3]]);
    expect(g.pending()).toMatchObject({ kind: 'turn', seat: 0 });
  });

  it('big catch: everyone draws 1', () => {
    const g = withEvents(['bigCatch']);
    toLastSeatOfRound(g);
    for (let s = 0; s < 4; s++) setHand(g, s, ['slash']);
    passTurn(g);
    // 0번은 만선 1장 + 뽑기 2장
    expect(g.seats.map((s) => s.hand.length)).toEqual([4, 2, 2, 2]);
  });

  it('whirlpool: everyone passes a random hand card to the next player at once; an empty hand only receives', () => {
    const g = withEvents(['whirlpool']);
    toLastSeatOfRound(g);
    const rum = setHand(g, 0, ['rum'])[0];
    const dodge = setHand(g, 1, ['dodge'])[0];
    setHand(g, 2, []);
    const brawl = setHand(g, 3, ['brawl'])[0];
    passTurn(g);
    const has = (seat: number, id: string) => g.seats[seat].hand.some((c) => c.id === id);
    expect(has(1, rum.id)).toBe(true);
    expect(has(2, dodge.id)).toBe(true);
    expect(g.seats[3].hand).toHaveLength(0);
    expect(has(0, brawl.id)).toBe(true);
    const steals = g.events.filter((e) => e.type === 'steal' && e.card !== null);
    for (const e of steals) if (e.type === 'steal') expect(e.visibleTo).toEqual([e.from, e.to]);
  });

  it('treasure island: the lowest hp heal 1, ties all heal', () => {
    const g = withEvents(['treasureIsland']);
    toLastSeatOfRound(g);
    g.seats[1].hp = 1;
    g.seats[3].hp = 1;
    const hp0 = g.seats[0].hp;
    passTurn(g);
    expect(g.seats[1].hp).toBe(2);
    expect(g.seats[3].hp).toBe(2);
    expect(g.seats[0].hp).toBe(hp0);
  });

  it('the view shows whether events are on and the current one', () => {
    const off = makeGame(4);
    off.start();
    expect(buildView(off, 1, noAi)).toMatchObject({ seaEventsOn: false, seaEvent: null });
    const g = withEvents(['storm']);
    toRound2(g);
    expect(buildView(g, 1, noAi)).toMatchObject({ seaEventsOn: true, seaEvent: 'storm' });
  });

  it('does not change the card order of an existing seed', () => {
    const a = makeGame(4);
    const b = makeGame(4, { seaEvents: true });
    expect(b.deck.map((c) => c.id)).toEqual(a.deck.map((c) => c.id));
  });
});

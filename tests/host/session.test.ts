import { HostSession, type ServerSide } from '../../src/host/HostSession';
import { createLocalPair } from '../../src/net/LocalTransport';
import type { ClientMessage, ServerMessage } from '../../src/host/messages';
import type { Transport } from '../../src/net/Transport';
import { makeGame, setHand } from '../engine/helpers';

type ClientSide = Transport<ServerMessage, ClientMessage>;

function connect() {
  const [client, server] = createLocalPair<ClientMessage, ServerMessage>() as [ClientSide, ServerSide];
  const inbox: ServerMessage[] = [];
  client.onMessage((m) => inbox.push(m));
  return { client, server, inbox };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(timeouts: { responseMs: number; turnMs: number } | null = null) {
  const game = makeGame(5);
  const host = new HostSession(game, { timeouts });
  const conns = [0, 1, 2, 3, 4].map(() => connect());
  conns.forEach((c, seat) => host.attach(seat, { kind: 'human', transport: c.server }));
  return { game, host, conns };
}

describe('HostSession', () => {
  it('sends a view on attach and after every accepted action', async () => {
    const { conns } = setup();
    await flush();
    expect(conns.every((c) => c.inbox.length === 1 && c.inbox[0].type === 'view')).toBe(true);
    conns[0].client.send({ type: 'action', action: { type: 'endTurn' } });
    await flush();
    expect(conns.every((c) => c.inbox.length === 2)).toBe(true);
  });

  it('rejects out-of-turn actions only to the sender', async () => {
    const { conns } = setup();
    await flush();
    conns.forEach((c) => (c.inbox.length = 0));
    conns[2].client.send({ type: 'action', action: { type: 'endTurn' } });
    await flush();
    expect(conns[2].inbox).toEqual([{ type: 'rejected', reason: expect.any(String) }]);
    expect(conns[0].inbox).toEqual([]);
  });

  it('frees a seat when a human disconnects', async () => {
    const { host, conns } = setup();
    const vacated: number[] = [];
    host.onSeatVacated((s) => vacated.push(s));
    conns[3].client.close();
    await flush();
    expect(vacated).toEqual([3]);
    expect(host.controllerKind(3)).toBeNull();
  });

  it('a returning human reclaims the seat with the right token', async () => {
    const { host, conns } = setup();
    conns[3].client.close();
    await flush();
    const ai = connect();
    host.attach(3, { kind: 'ai', transport: ai.server });
    expect(host.controllerKind(3)).toBe('ai');
    const back = connect();
    host.accept(back.server);
    back.client.send({ type: 'hello', seatToken: 'wrong' });
    await flush();
    expect(back.inbox.at(-1)?.type).toBe('rejected');
    back.client.send({ type: 'hello', seatToken: host.seatToken(3) });
    await flush();
    expect(host.controllerKind(3)).toBe('human');
    expect(back.inbox.at(-1)?.type).toBe('view');
  });

  it('times out a turn after turnMs, never without timeouts', () => {
    vi.useFakeTimers();
    try {
      const { game } = setup({ responseMs: 30000, turnMs: 90000 });
      vi.advanceTimersByTime(89000);
      expect(game.current).toBe(0);
      vi.advanceTimersByTime(1000); // 턴 종료 → 손패 초과 버리기 대기
      expect(game.pending()?.kind).toBe('discardExcess');
      vi.advanceTimersByTime(30000);
      expect(game.current).toBe(1);

      const other = setup(null);
      vi.advanceTimersByTime(600000);
      expect(other.game.current).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps sending views to a fallen human, including the final one', async () => {
    const { game, conns } = setup();
    const [duel] = setHand(game, 0, ['duel']);
    setHand(game, 1, []);
    game.seats[1].hp = 1;
    conns[0].client.send({ type: 'action', action: { type: 'playCard', cardId: duel.id, target: 1 } });
    await flush();
    conns[1].client.send({ type: 'action', action: { type: 'respond', cardIds: [] } });
    await flush();
    conns[1].client.send({ type: 'action', action: { type: 'respond', cardIds: [] } });
    await flush();
    expect(game.seats[1].alive).toBe(false);
    // 선장이 결투를 다시 걸어 스스로 쓰러지게 해서 게임을 끝냄
    const [duel2] = setHand(game, 0, ['duel']);
    setHand(game, 2, ['slash']);
    game.seats[0].hp = 1;
    conns[0].client.send({ type: 'action', action: { type: 'playCard', cardId: duel2.id, target: 2 } });
    await flush();
    conns[2].client.send({ type: 'action', action: { type: 'respond', cardIds: [game.seats[2].hand[0].id] } });
    await flush();
    conns[0].client.send({ type: 'action', action: { type: 'respond', cardIds: [] } });
    await flush();
    conns[0].client.send({ type: 'action', action: { type: 'respond', cardIds: [] } });
    await flush();
    expect(game.winner).toBe('rebels');
    const last = conns[1].inbox.at(-1);
    expect(last?.type === 'view' && last.view.winner).toBe('rebels');
  });
});

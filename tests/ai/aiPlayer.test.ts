import { AiPlayer } from '../../src/ai/AiPlayer';
import { createLocalPair } from '../../src/net/LocalTransport';
import type { ClientMessage, ServerMessage } from '../../src/host/messages';
import { buildView } from '../../src/host/view';
import { makeGame } from '../engine/helpers';

describe('AiPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('setDelay changes how long it waits before acting', async () => {
    const g = makeGame(4);
    g.start();
    const [host, remote] = createLocalPair<ServerMessage, ClientMessage>();
    const got: ClientMessage[] = [];
    host.onMessage((m) => got.push(m));
    const ai = new AiPlayer(remote, { delayMs: 700, seed: 1 });
    ai.setDelay(100);
    host.send({ type: 'view', view: buildView(g, 0, () => true) });
    await vi.advanceTimersByTimeAsync(150);
    expect(got).toHaveLength(1);
    ai.dispose();
  });
});

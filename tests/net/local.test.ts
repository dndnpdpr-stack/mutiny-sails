import { createLocalPair } from '../../src/net/LocalTransport';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createLocalPair', () => {
  it('delivers asynchronously as a copy', async () => {
    const [a, b] = createLocalPair<{ n: number }, { m: string }>();
    const got: Array<{ n: number }> = [];
    b.onMessage((msg) => got.push(msg));
    const sent = { n: 1 };
    a.send(sent);
    expect(got).toEqual([]);
    await tick();
    expect(got).toEqual([{ n: 1 }]);
    expect(got[0]).not.toBe(sent);
  });
  it('delivers in both directions and can unsubscribe', async () => {
    const [a, b] = createLocalPair<{ n: number }, { m: string }>();
    const got: string[] = [];
    const off = a.onMessage((msg) => got.push(msg.m));
    b.send({ m: 'x' });
    await tick();
    off();
    b.send({ m: 'y' });
    await tick();
    expect(got).toEqual(['x']);
  });
  it('close notifies both sides', async () => {
    const [a, b] = createLocalPair<unknown, unknown>();
    let closedA = 0;
    let closedB = 0;
    a.onClose(() => closedA++);
    b.onClose(() => closedB++);
    a.close();
    await tick();
    expect([closedA, closedB]).toEqual([1, 1]);
  });
});

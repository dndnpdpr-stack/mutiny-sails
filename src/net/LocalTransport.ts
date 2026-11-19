import type { Transport } from './Transport';

class Endpoint<In, Out> implements Transport<In, Out> {
  peer!: Endpoint<Out, In>;
  private handlers = new Set<(msg: In) => void>();
  private closeHandlers = new Set<() => void>();
  closed = false;

  send(msg: Out): void {
    if (this.closed) return;
    const copy = JSON.parse(JSON.stringify(msg)) as Out; // 직렬화 가능성 강제
    queueMicrotask(() => this.peer.deliver(copy));
  }
  deliver(msg: In): void {
    if (this.closed) return;
    for (const h of [...this.handlers]) h(msg);
  }
  onMessage(handler: (msg: In) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }
  close(): void {
    this.shutdown();
    this.peer.shutdown();
  }
  private shutdown(): void {
    if (this.closed) return;
    this.closed = true;
    queueMicrotask(() => {
      for (const h of [...this.closeHandlers]) h();
    });
  }
}

/** 같은 페이지 안에서 쓰는 연결 한 쌍. 왼쪽은 A를 보내고 B를 받는다 */
export function createLocalPair<A, B>(): [Transport<B, A>, Transport<A, B>] {
  const left = new Endpoint<B, A>();
  const right = new Endpoint<A, B>();
  left.peer = right;
  right.peer = left;
  return [left, right];
}

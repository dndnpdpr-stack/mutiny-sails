import { Rng } from '../engine/rng';
import type { Transport } from '../net/Transport';
import type { ClientMessage, ServerMessage } from '../host/messages';
import type { PlayerView } from '../engine/types';
import { AiMemory, type Difficulty } from './memory';
import { decide, fallbackAction } from './decide';

export class AiPlayer {
  private mem: AiMemory;
  private rng: Rng;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastView: PlayerView | null = null;
  private retried = false;
  private off: () => void;
  private delayMs: number;

  constructor(
    private readonly transport: Transport<ServerMessage, ClientMessage>,
    opts: { delayMs: number; seed: number; difficulty?: Difficulty },
  ) {
    this.rng = new Rng(opts.seed);
    this.mem = new AiMemory(opts.difficulty ?? 'normal');
    this.delayMs = opts.delayMs;
    this.off = transport.onMessage((m) => {
      if (m.type === 'view') this.onView(m.view);
      else if (m.type === 'rejected') this.onRejected();
    });
  }

  /** 다음 행동부터 기다리는 시간을 바꾼다 (관전 중 빨리 감기) */
  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  dispose(): void {
    this.cancel();
    this.off();
  }

  private cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private onView(view: PlayerView): void {
    this.cancel();
    this.lastView = view;
    this.retried = false;
    if (view.winner) return;
    const action = decide(view, this.mem, this.rng);
    if (!action) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.transport.send({ type: 'action', action });
    }, this.delayMs);
  }

  private onRejected(): void {
    if (this.retried || !this.lastView) return;
    this.retried = true;
    const action = fallbackAction(this.lastView);
    if (action) this.transport.send({ type: 'action', action });
  }
}

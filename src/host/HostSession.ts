import type { Action, SeatId } from '../engine/types';
import type { Game } from '../engine/Game';
import { defaultActionFor } from '../engine/defaults';
import type { Transport } from '../net/Transport';
import type { ClientMessage, ServerMessage } from './messages';
import { buildView } from './view';

export type ServerSide = Transport<ClientMessage, ServerMessage>;

export interface Controller {
  kind: 'human' | 'ai';
  transport: ServerSide;
}

export interface HostOptions {
  /** 1단계는 null (시간 제한 없음) */
  timeouts: { responseMs: number; turnMs: number } | null;
}

interface Attached {
  controller: Controller;
  unsubscribe: () => void;
}

function randomToken(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * 방장 세션: 엔진을 돌리고, 자리마다 조종자(사람 연결 또는 AI)를 붙이고,
 * 각자에게 보일 정보만 담은 화면 상태를 보낸다.
 */
export class HostSession {
  private attached = new Map<SeatId, Attached>();
  private tokens: string[];
  private vacatedHandlers = new Set<(seat: SeatId) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly game: Game,
    private readonly opts: HostOptions,
  ) {
    this.tokens = game.seats.map(() => randomToken());
    game.start();
    this.armTimer();
  }

  seatToken(seat: SeatId): string {
    return this.tokens[seat];
  }

  controllerKind(seat: SeatId): 'human' | 'ai' | null {
    return this.attached.get(seat)?.controller.kind ?? null;
  }

  onSeatVacated(handler: (seat: SeatId) => void): () => void {
    this.vacatedHandlers.add(handler);
    return () => this.vacatedHandlers.delete(handler);
  }

  attach(seat: SeatId, c: Controller): void {
    this.detach(seat);
    const offMsg = c.transport.onMessage((m) => this.onMessage(seat, c, m));
    const offClose = c.transport.onClose(() => {
      if (this.attached.get(seat)?.controller !== c) return;
      this.detach(seat);
      for (const h of [...this.vacatedHandlers]) h(seat);
    });
    this.attached.set(seat, { controller: c, unsubscribe: () => (offMsg(), offClose()) });
    this.sendView(seat);
  }

  detach(seat: SeatId): void {
    const a = this.attached.get(seat);
    if (!a) return;
    a.unsubscribe();
    this.attached.delete(seat);
  }

  /** 자리가 아직 없는 연결(재접속). hello의 토큰으로 자리를 찾아 사람으로 붙인다 */
  accept(transport: ServerSide): void {
    const off = transport.onMessage((m) => {
      if (m.type !== 'hello') return;
      const seat = this.tokens.indexOf(m.seatToken);
      if (seat < 0) {
        transport.send({ type: 'rejected', reason: '자리를 찾을 수 없어요' });
        return;
      }
      off();
      this.attach(seat, { kind: 'human', transport });
    });
  }

  /** 엔진 상태가 바뀌었을 때 모두에게 새 화면 상태를 보낸다 */
  refresh(): void {
    for (const seat of this.attached.keys()) this.sendView(seat);
    this.armTimer();
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const seat of [...this.attached.keys()]) this.detach(seat);
  }

  private onMessage(seat: SeatId, c: Controller, m: ClientMessage): void {
    if (m.type !== 'action') return;
    this.act(seat, m.action, c);
  }

  private act(seat: SeatId, action: Action, from?: Controller): void {
    const r = this.game.apply(seat, action);
    if (!r.ok) {
      from?.transport.send({ type: 'rejected', reason: r.reason });
      return;
    }
    this.refresh();
  }

  private sendView(seat: SeatId): void {
    const a = this.attached.get(seat);
    if (!a) return;
    a.controller.transport.send({ type: 'view', view: buildView(this.game, seat, (s) => this.controllerKind(s) === 'ai') });
  }

  private armTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const t = this.opts.timeouts;
    const p = this.game.pending();
    if (!t || !p) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        if (this.game.pending() === p) this.act(p.seat, defaultActionFor(this.game, p));
      },
      p.kind === 'turn' ? t.turnMs : t.responseMs,
    );
  }
}

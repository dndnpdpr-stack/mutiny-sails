import { CARD_CATALOG } from '../../engine/cards/catalog';
import type { CardView, GameEvent, SeatId } from '../../engine/types';

export type Anchor = 'deck' | 'discard' | 'judge' | 'hand' | `seat:${number}` | `equip:${number}`;

export type Effect =
  | { kind: 'fly'; from: Anchor; to: Anchor; via?: Anchor; card: CardView | null; flip?: boolean; at: number; ms: number }
  | { kind: 'shake'; seat: SeatId; at: number; ms: number }
  | { kind: 'float'; seat: SeatId; text: string; tone: 'damage' | 'heal'; at: number; ms: number }
  | { kind: 'judge'; card: CardView; success: boolean; at: number; ms: number }
  | { kind: 'death'; seat: SeatId; at: number; ms: number }
  | { kind: 'turn'; seat: SeatId; mine: boolean; at: number; ms: number };

export const STAGGER_MS = 120;
const FLY_MS = 450;
const SHAKE_MS = 400;
const FLOAT_MS = 600;
const JUDGE_MS = 600;
const DEATH_MS = 600;
const TURN_MS = 500;

/** 이벤트 순서대로 STAGGER_MS씩 시작 시각을 늦춰 연출 목록을 만든다 */
export function effectsFor(events: GameEvent[], you: SeatId): Effect[] {
  const out: Effect[] = [];
  let slot = 0;
  const at = () => slot++ * STAGGER_MS;
  const anchor = (seat: SeatId): Anchor => (seat === you ? 'hand' : `seat:${seat}`);

  for (const e of events) {
    switch (e.type) {
      case 'draw':
        if (e.seat === you) break;
        for (let i = 0; i < e.count; i++) {
          out.push({ kind: 'fly', from: 'deck', to: anchor(e.seat), card: null, at: at(), ms: FLY_MS });
        }
        break;
      case 'drawCards':
        if (e.seat !== you) break;
        for (const card of e.cards) {
          out.push({ kind: 'fly', from: 'deck', to: 'hand', card, flip: true, at: at(), ms: FLY_MS });
        }
        break;
      case 'play': {
        const from = anchor(e.seat);
        if (CARD_CATALOG[e.card.kind]?.category === 'equipment') {
          out.push({ kind: 'fly', from, to: `equip:${e.target ?? e.seat}`, card: e.card, at: at(), ms: FLY_MS });
        } else {
          const fly: Effect = { kind: 'fly', from, to: 'discard', card: e.card, at: at(), ms: FLY_MS };
          if (e.target !== undefined) fly.via = `seat:${e.target}`;
          out.push(fly);
        }
        break;
      }
      case 'respond':
      case 'discardCards':
        for (const card of e.cards) {
          out.push({ kind: 'fly', from: anchor(e.seat), to: 'discard', card, at: at(), ms: FLY_MS });
        }
        break;
      case 'damage': {
        const t = at();
        out.push({ kind: 'shake', seat: e.seat, at: t, ms: SHAKE_MS });
        out.push({ kind: 'float', seat: e.seat, text: `-${e.amount}`, tone: 'damage', at: t, ms: FLOAT_MS });
        break;
      }
      case 'heal':
        out.push({ kind: 'float', seat: e.seat, text: `+${e.amount}`, tone: 'heal', at: at(), ms: FLOAT_MS });
        break;
      case 'judge':
        out.push({ kind: 'judge', card: e.card, success: e.success, at: at(), ms: JUDGE_MS });
        break;
      case 'steal':
        out.push({ kind: 'fly', from: anchor(e.from), to: anchor(e.to), card: e.card, at: at(), ms: FLY_MS });
        break;
      case 'death':
        out.push({ kind: 'death', seat: e.seat, at: at(), ms: DEATH_MS });
        break;
      case 'turnStart':
        out.push({ kind: 'turn', seat: e.seat, mine: e.seat === you, at: at(), ms: TURN_MS });
        break;
      default:
        break;
    }
  }
  return out;
}

export function totalMs(effects: Effect[]): number {
  return effects.reduce((m, e) => Math.max(m, e.at + e.ms), 0);
}

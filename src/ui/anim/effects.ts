import { CARD_CATALOG } from '../../engine/cards/catalog';
import type { CardView, GameEvent, SeatId } from '../../engine/types';
import type { SeaEventId } from '../../engine/seaEvents';
import { judgeRule } from '../judgeRule';
import { rankLabel } from '../table/Card';

export type Anchor = 'deck' | 'discard' | 'judge' | 'hand' | `seat:${number}` | `equip:${number}`;

export type Effect =
  | { kind: 'fly'; from: Anchor; to: Anchor; via?: Anchor; card: CardView | null; flip?: boolean; at: number; ms: number }
  | { kind: 'shake'; seat: SeatId; at: number; ms: number }
  | { kind: 'float'; seat: SeatId; text: string; tone: 'damage' | 'heal'; at: number; ms: number }
  /** good: 판정 받은 사람에게 좋은 결과인지 (null이면 중립 — 주사위 내기) / 설명 줄이 없으면(title '') 카드만 */
  | { kind: 'judge'; card: CardView; success: boolean; title: string; need: string; result: string; good: boolean | null; at: number; ms: number }
  /** 누가 누구에게 카드를 냈는지: 낸 사람의 패널이 대상에게 달려들어 부딪힌다 */
  | { kind: 'aim'; from: SeatId; to: SeatId; emoji: string; at: number; ms: number }
  | { kind: 'death'; seat: SeatId; at: number; ms: number }
  | { kind: 'turn'; seat: SeatId; mine: boolean; at: number; ms: number }
  | { kind: 'sea'; event: SeaEventId; at: number; ms: number };

export const STAGGER_MS = 120;
const FLY_MS = 450;
const SHAKE_MS = 400;
const FLOAT_MS = 600;
/** 무엇을 위한 판정인지·결과를 읽을 시간 */
const JUDGE_MS = 1400;
/** 공격한 사람 패널이 달려들었다 돌아오는 시간 */
const AIM_MS = 800;
const DEATH_MS = 600;
const TURN_MS = 500;
/** 표시만 하는 짧은 표시. 띠는 TableScreen이 자기 타이머로 띄워서 배속·몰아치기에 영향받지 않는다 */
const SEA_MS = 300;

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
        if (e.target !== undefined && e.target !== e.seat) {
          out.push({ kind: 'aim', from: e.seat, to: e.target, emoji: CARD_CATALOG[e.card.kind]?.emoji ?? '🎯', at: at(), ms: AIM_MS });
        }
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
        out.push({ kind: 'judge', card: e.card, success: e.success, ...judgeRule(e.reason, e.success), at: at(), ms: JUDGE_MS });
        break;
      case 'steal':
        out.push({ kind: 'fly', from: anchor(e.from), to: anchor(e.to), card: e.card, at: at(), ms: FLY_MS });
        break;
      case 'death':
        out.push({ kind: 'death', seat: e.seat, at: at(), ms: DEATH_MS });
        break;
      case 'gearUsed':
        out.push({ kind: 'fly', from: `equip:${e.seat}`, to: 'discard', card: e.card, at: at(), ms: FLY_MS });
        break;
      case 'wager': {
        const [a, b] = e.cards;
        // 두 장을 같은 자리에 뒤집으니 설명 줄은 첫 장에만: "Q 대 3"
        const score = `${rankLabel(a.rank)} 대 ${rankLabel(b.rank)}`;
        out.push({ kind: 'judge', card: a, success: a.rank > b.rank, title: '🎲 주사위 내기', need: '높은 숫자가 이겨요', result: score, good: null, at: at(), ms: JUDGE_MS });
        out.push({ kind: 'judge', card: b, success: b.rank > a.rank, title: '', need: '', result: '', good: null, at: at(), ms: JUDGE_MS });
        break;
      }
      case 'seaEvent':
        out.push({ kind: 'sea', event: e.event, at: at(), ms: SEA_MS });
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

import type { SeatId } from './types';
import type { Game } from './Game';
import type { RuleModifier } from './rules';
import { judge } from './judge';
import type { Card } from './cards/Card';

export type SeaEventId =
  | 'storm' | 'fairWind' | 'fog' | 'flagFestival' | 'seaMonster' | 'highTide'
  | 'doldrums' | 'shortage' | 'bigCatch' | 'whirlpool' | 'treasureIsland' | 'calmSea';

export interface SeaEventInfo {
  name: string;
  icon: string;
  text: string;
  /** 다음 이벤트가 나올 때까지 적용되는 규칙 */
  modifier?: RuleModifier;
  /** 펼쳐질 때 한 번 일어나는 일 */
  onReveal?(game: Game): void;
}

/** 선장부터 시계 방향으로 살아있는 자리 */
function fromCaptain(game: Game): SeatId[] {
  const cap = game.captainSeat();
  return [cap, ...game.othersFrom(cap)];
}

function seaMonster(game: Game): void {
  // 스택은 나중에 넣은 것이 먼저 실행되므로 뒤에서부터 넣는다
  for (const seat of [...fromCaptain(game)].reverse()) {
    game.pushStep(() => {
      if (!game.seats[seat].alive) return;
      judge(game, seat, 'seaMonster', (c) => c.suit !== 'spades', (safe) => {
        if (!safe) game.dealDamage(seat, 1, null);
      });
    });
  }
}

function bigCatch(game: Game): void {
  for (const seat of fromCaptain(game)) game.giveCards(seat, game.draw(1));
}

function whirlpool(game: Game): void {
  const order = fromCaptain(game);
  // 넘길 카드를 모두 먼저 정한 뒤 한꺼번에 넘긴다
  const moves: Array<{ from: SeatId; to: SeatId; card: Card }> = [];
  for (const from of order) {
    const hand = game.seats[from].hand;
    if (hand.length === 0) continue;
    moves.push({ from, to: game.nextAlive(from), card: hand[game.rng.int(hand.length)] });
  }
  for (const m of moves) game.removeFromHand(m.from, m.card.id);
  for (const m of moves) {
    game.seats[m.to].hand.push(m.card);
    const involved = [m.from, m.to];
    const others = game.seats.map((s) => s.seat).filter((s) => !involved.includes(s));
    game.emit({ type: 'steal', from: m.from, to: m.to, card: null, visibleTo: others });
    game.emit({ type: 'steal', from: m.from, to: m.to, card: m.card.toView(), visibleTo: involved });
  }
}

function treasureIsland(game: Game): void {
  const alive = fromCaptain(game);
  const low = Math.min(...alive.map((s) => game.seats[s].hp));
  for (const s of alive) if (game.seats[s].hp === low) game.heal(s, 1);
}

export const SEA_EVENTS: Record<SeaEventId, SeaEventInfo> = {
  storm: { name: '폭풍', icon: '🌪️', text: '모든 거리 +1', modifier: { distanceDelta: () => 1 } },
  fairWind: { name: '순풍', icon: '🌬️', text: '뽑기 단계에 카드 3장', modifier: { drawCount: (n) => n + 1 } },
  fog: {
    name: '바다 안개',
    icon: '😶‍🌫️',
    text: '망원경·작은 보트 효과 없음',
    modifier: { disablesGear: (k) => k === 'spyglass' || k === 'dinghy' },
  },
  flagFestival: { name: '해적 깃발 축제', icon: '🏴‍☠️', text: '칼질을 한 턴에 2번까지', modifier: { slashLimit: (n) => Math.max(n, 2) } },
  seaMonster: { name: '바다 괴물', icon: '🐙', text: '펼쳐질 때 모두 판정, ♠이면 체력 1 잃음', onReveal: seaMonster },
  highTide: { name: '만조', icon: '🌊', text: '모든 사람의 사거리 +1', modifier: { rangeDelta: () => 1 } },
  doldrums: { name: '무풍지대', icon: '🪨', text: '뽑기 단계에 카드 1장', modifier: { drawCount: (n) => Math.max(1, n - 1) } },
  shortage: { name: '보급 부족', icon: '🧺', text: '럼주는 쓰러질 때만 쓸 수 있음', modifier: { rumOnlyWhenDying: true } },
  bigCatch: { name: '만선', icon: '🐟', text: '펼쳐질 때 모두 카드 1장', onReveal: bigCatch },
  whirlpool: { name: '소용돌이', icon: '🌀', text: '펼쳐질 때 모두 다음 사람에게 손패 1장(무작위)을 넘김', onReveal: whirlpool },
  treasureIsland: { name: '보물섬', icon: '🏝️', text: '펼쳐질 때 체력이 가장 낮은 사람 1 회복(같으면 모두)', onReveal: treasureIsland },
  calmSea: { name: '고요한 바다', icon: '☀️', text: '아무 일도 없음' },
};

export const SEA_EVENT_IDS = Object.keys(SEA_EVENTS) as SeaEventId[];

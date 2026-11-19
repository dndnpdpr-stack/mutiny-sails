import type { CardView, CharacterId, Role, SeatId } from './types';
import { Rng } from './rng';
import { buildDeckSpec } from './cards/deck';
import { createCard, type Card } from './cards/Card';
import './cards/equipment';
import type { Character } from './characters/Character';
import { CHARACTERS, CHARACTER_IDS } from './characters/roster';
import type { RuleModifier } from './rules';

export interface GameConfig {
  seed: number;
  names: string[];
  /** 테스트용 강제값 */
  roles?: Role[];
  characters?: CharacterId[];
  /** 덱 맨 위부터의 순서. 나머지는 일반 덱에서 이 카드들을 뺀 뒤 섞어 뒤에 붙인다 */
  stackDeck?: CardView[];
}

export interface SeatState {
  seat: SeatId;
  name: string;
  role: Role;
  character: Character;
  hp: number;
  maxHp: number;
  hand: Card[];
  equipment: Card[];
  alive: boolean;
}

const ROLE_TABLE: Role[] = ['captain', 'spy', 'rebel', 'rebel', 'loyalist', 'rebel', 'loyalist'];

export class Game {
  readonly seats: SeatState[];
  /** 배열 끝이 덱 맨 위 */
  deck: Card[];
  discard: Card[] = [];
  readonly rng: Rng;
  modifiers: RuleModifier[] = [];
  current: SeatId;
  winner: 'captainTeam' | 'rebels' | 'spy' | null = null;

  constructor(config: GameConfig) {
    const n = config.names.length;
    if (n < 4 || n > 7) throw new Error('인원은 4~7명이어야 해요');
    this.rng = new Rng(config.seed);
    const roles = config.roles ?? this.rng.shuffle(ROLE_TABLE.slice(0, n));
    const chars = config.characters ?? this.rng.shuffle([...CHARACTER_IDS]).slice(0, n);

    let specs = this.rng.shuffle(buildDeckSpec(this.rng));
    if (config.stackDeck) {
      const ids = new Set(config.stackDeck.map((c) => c.id));
      specs = [...specs.filter((c) => !ids.has(c.id)), ...[...config.stackDeck].reverse()];
    }
    this.deck = specs.map(createCard);

    this.seats = config.names.map((name, seat) => {
      const character = CHARACTERS[chars[seat]];
      const maxHp = character.maxHp + (roles[seat] === 'captain' ? 1 : 0);
      return { seat, name, role: roles[seat], character, hp: maxHp, maxHp, hand: [], equipment: [], alive: true };
    });
    for (const s of this.seats) s.hand.push(...this.draw(s.hp));
    this.current = this.captainSeat();
  }

  captainSeat(): SeatId {
    return this.seats.findIndex((s) => s.role === 'captain');
  }

  aliveSeats(): SeatId[] {
    return this.seats.filter((s) => s.alive).map((s) => s.seat);
  }

  /** 덱이 부족하면 버린 카드를 섞어 보충, 그래도 부족하면 가능한 만큼 */
  draw(n: number): Card[] {
    const out: Card[] = [];
    for (let i = 0; i < n; i++) {
      if (this.deck.length === 0) {
        if (this.discard.length === 0) break;
        this.deck = this.rng.shuffle(this.discard.splice(0));
      }
      out.push(this.deck.pop()!);
    }
    return out;
  }
}

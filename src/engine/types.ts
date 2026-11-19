export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
/** 11=J 12=Q 13=K 14=A */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
/** 0..n-1, 앉은 순서(시계 방향) */
export type SeatId = number;
export type CardId = string;
export type Role = 'captain' | 'loyalist' | 'rebel' | 'spy';
export type CardKind =
  | 'slash' | 'dodge' | 'rum' | 'cannonade' | 'brawl' | 'duel' | 'pickpocket' | 'cutRope'
  | 'supplyShip' | 'merchantRaid' | 'feast' | 'loot'
  | 'pistol' | 'musket' | 'longMusket' | 'deckCannon' | 'twinPistols'
  | 'spyglass' | 'dinghy' | 'barrel' | 'powderKeg' | 'brig';
export type CharacterId = 'tom' | 'margo' | 'lou' | 'derrick' | 'orso' | 'nico' | 'hanna' | 'sila' | 'bibi' | 'bruno';

export interface CardView {
  id: CardId;
  kind: CardKind;
  suit: Suit;
  rank: Rank;
}

export type Action =
  | { type: 'playCard'; cardId: CardId; target?: SeatId; targetCardId?: CardId }
  /** 포수 데릭 */
  | { type: 'useAbility'; cardIds: CardId[] }
  | { type: 'endTurn' }
  /** 피하기/칼질/럼주 내기. [] = 안 냄(맞기·포기) */
  | { type: 'respond'; cardIds: CardId[] }
  | { type: 'discard'; cardIds: CardId[] }
  /** 전리품 선택, 실라 판정 선택 */
  | { type: 'chooseCard'; cardId: CardId }
  /** 마고 엿보기, 비비 화약통 넘기기 */
  | { type: 'chooseSeat'; target: SeatId }
  /** 밀수꾼 루 */
  | { type: 'chooseDrawSource'; fromDiscard: boolean }
  /** 캐릭터 뽑기 */
  | { type: 'chooseCharacter'; character: CharacterId };

export type PendingView =
  | { kind: 'turn'; seat: SeatId }
  | { kind: 'respondAttack'; seat: SeatId; attacker: SeatId; source: 'slash' | 'cannonade' }
  | { kind: 'respondBrawl'; seat: SeatId; attacker: SeatId }
  | { kind: 'respondDuel'; seat: SeatId; opponent: SeatId; required: number }
  /** need = 살아나려면 내야 할 럼주 장수 */
  | { kind: 'dying'; seat: SeatId; need: number }
  | { kind: 'discardExcess'; seat: SeatId; count: number }
  | { kind: 'loot'; seat: SeatId; revealed: CardView[] }
  | { kind: 'judgeChoice'; seat: SeatId; options: CardView[] }
  | { kind: 'peekTarget'; seat: SeatId }
  | { kind: 'passKeg'; seat: SeatId }
  | { kind: 'drawSource'; seat: SeatId }
  | { kind: 'chooseCharacter'; seat: SeatId; options: CharacterId[] };

export type Winner = 'captainTeam' | 'rebels' | 'spy';

/** visibleTo 없음 = 모두에게 공개 */
/** seq는 Game.emit이 채운다(1부터) */
export type GameEvent = { visibleTo?: SeatId[]; seq?: number } & (
  | { type: 'turnStart'; seat: SeatId }
  | { type: 'draw'; seat: SeatId; count: number }
  | { type: 'drawCards'; seat: SeatId; cards: CardView[] }
  | { type: 'play'; seat: SeatId; card: CardView; target?: SeatId }
  | { type: 'respond'; seat: SeatId; cards: CardView[] }
  | { type: 'damage'; seat: SeatId; amount: number; source: SeatId | null }
  | { type: 'heal'; seat: SeatId; amount: number }
  | { type: 'judge'; seat: SeatId; card: CardView; success: boolean; reason: CardKind }
  | { type: 'steal'; from: SeatId; to: SeatId; card: CardView | null }
  | { type: 'discardCards'; seat: SeatId; cards: CardView[] }
  | { type: 'peek'; seat: SeatId; target: SeatId; card: CardView }
  | { type: 'death'; seat: SeatId; role: Role; killer: SeatId | null }
  | { type: 'ability'; seat: SeatId; character: CharacterId }
  | { type: 'gameOver'; winner: Winner }
  | { type: 'characterChosen'; seat: SeatId; character: CharacterId }
);

/** targets null = 대상 불필요. targetCards = 대상의 장비를 고를 수 있음 */
export interface PlayHint {
  cardId: CardId;
  targets: SeatId[] | null;
  targetCards: boolean;
}

export interface SeatView {
  seat: SeatId;
  name: string;
  character: CharacterId;
  hp: number;
  maxHp: number;
  alive: boolean;
  handCount: number;
  equipment: CardView[];
  /** 선장, 쓰러진 사람, 게임 종료 후에만 공개 */
  role: Role | null;
  isAi: boolean;
}

/** 방장이 플레이어 한 명에게 보내는 화면 상태. 그 사람이 볼 수 있는 정보만 담는다 */
export interface PlayerView {
  you: SeatId;
  myRole: Role;
  myHand: CardView[];
  seats: SeatView[];
  current: SeatId;
  pending: PendingView | null;
  hints: PlayHint[];
  deckCount: number;
  discardTop: CardView | null;
  /** 나에서 각 살아있는 자리까지의 거리 */
  distances: Record<SeatId, number>;
  myRange: number;
  /** 내게 보이는 것만, 최근 100개 */
  events: GameEvent[];
  winner: Winner | null;
}

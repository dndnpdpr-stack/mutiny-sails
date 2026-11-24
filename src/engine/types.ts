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
  | 'spyglass' | 'dinghy' | 'barrel' | 'powderKeg' | 'brig'
  // 확장 카드
  | 'parrotTattle' | 'treasureMap' | 'diceWager' | 'fireShip' | 'walkPlank'
  | 'leatherCoat' | 'harpoon' | 'compass' | 'luckyCoin' | 'blackFlag';
export type AttackSource = 'slash' | 'cannonade' | 'fireShip';
import type { SeaEventId } from './seaEvents';

/** 판정 이유: 장비 카드 또는 바다 이벤트 */
export type JudgeReason = CardKind | 'seaMonster';
export type CharacterId =
  | 'tom' | 'margo' | 'lou' | 'derrick' | 'orso' | 'nico' | 'hanna' | 'sila' | 'bibi' | 'bruno'
  | 'dorothy' | 'ori' | 'felix' | 'tara' | 'luca' | 'gordon' | 'kiki' | 'morgan';

export interface CardView {
  id: CardId;
  kind: CardKind;
  suit: Suit;
  rank: Rank;
}

export type Action =
  | { type: 'playCard'; cardId: CardId; target?: SeatId; targetCardId?: CardId }
  /** 캐릭터 능력: 데릭(칼질 2장), 도로시(럼주 + 대상), 키키(손패 1장 + 대상 + 대상 장비) */
  | { type: 'useAbility'; cardIds: CardId[]; target?: SeatId; targetCardId?: CardId }
  /** 점쟁이 오르: 덱 맨 위를 맨 밑으로 보낼지 */
  | { type: 'fortune'; toBottom: boolean }
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
  | { type: 'chooseCharacter'; character: CharacterId }
  /** 엎어 둔 역할 카드 중 하나 뽑기 */
  | { type: 'drawRole'; slot: number };

export type PendingView =
  | { kind: 'turn'; seat: SeatId }
  | { kind: 'respondAttack'; seat: SeatId; attacker: SeatId; source: AttackSource }
  | { kind: 'respondBrawl'; seat: SeatId; attacker: SeatId }
  | { kind: 'respondDuel'; seat: SeatId; opponent: SeatId; required: number }
  /** need = 살아나려면 내야 할 럼주 장수 */
  | { kind: 'dying'; seat: SeatId; need: number }
  | { kind: 'discardExcess'; seat: SeatId; count: number }
  | { kind: 'loot'; seat: SeatId; revealed: CardView[] }
  /** 보물 지도: 본인에게만 revealed가 채워진다 */
  | { kind: 'treasureMap'; seat: SeatId; revealed: CardView[] }
  /** reason: 무슨 판정인지 (고를 때 참고) */
  | { kind: 'judgeChoice'; seat: SeatId; options: CardView[]; reason: JudgeReason }
  | { kind: 'peekTarget'; seat: SeatId }
  | { kind: 'passKeg'; seat: SeatId }
  | { kind: 'drawSource'; seat: SeatId }
  /** 점쟁이 오르: card는 본인에게만 채워진다 */
  | { kind: 'fortune'; seat: SeatId; card: CardView | null }
  | { kind: 'chooseCharacter'; seat: SeatId; options: CharacterId[] }
  /** slots: 아직 남은 역할 카드 자리 번호 (내용은 비공개) */
  | { kind: 'drawRole'; seat: SeatId; slots: number[] };

export interface SeatStats {
  damage: number;
  kills: number;
}

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
  | { type: 'judge'; seat: SeatId; card: CardView; success: boolean; reason: JudgeReason }
  | { type: 'steal'; from: SeatId; to: SeatId; card: CardView | null }
  | { type: 'discardCards'; seat: SeatId; cards: CardView[] }
  | { type: 'peek'; seat: SeatId; target: SeatId; card: CardView }
  | { type: 'death'; seat: SeatId; role: Role; killer: SeatId | null }
  | { type: 'ability'; seat: SeatId; character: CharacterId }
  | { type: 'gameOver'; winner: Winner }
  | { type: 'characterChosen'; seat: SeatId; character: CharacterId }
  /** role: 본인과(선장이면 모두) 볼 때만 채워지고, 나머지에게는 null */
  | { type: 'roleDrawn'; seat: SeatId; slot: number; role: Role | null }
  | { type: 'seaEvent'; event: SeaEventId }
  /** 앵무새의 고자질: 낸 사람에게만 */
  | { type: 'roleRevealed'; seat: SeatId; target: SeatId; role: Role }
  /** 주사위 내기: cards = [낸 사람, 대상] 순서로 뒤집은 카드 */
  | { type: 'wager'; seat: SeatId; target: SeatId; cards: [CardView, CardView] }
  /** 가죽 코트·행운의 동전처럼 스스로 버려지며 효과를 낸 장비 */
  | { type: 'gearUsed'; seat: SeatId; card: CardView }
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
  character: CharacterId | null;
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
  /** 아직 역할 카드를 안 뽑았으면 null */
  myRole: Role | null;
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
  /** 이번 턴에 내 능력을 이미 썼는지(내 차례일 때만 true가 될 수 있다) */
  abilityUsed: boolean;
  /** 내게 보이는 것만, 최근 100개 */
  events: GameEvent[];
  winner: Winner | null;
  /** 게임이 끝났을 때만: 자리별 준 피해·쓰러뜨린 수 (MVP용) */
  stats?: Record<SeatId, SeatStats>;
  /** 바다 이벤트를 쓰는 게임인지, 지금 펼쳐진 이벤트 */
  seaEventsOn: boolean;
  seaEvent: SeaEventId | null;
}

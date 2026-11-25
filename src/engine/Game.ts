import type { Action, AttackSource, BountyState, CardId, CardKind, CardView, CharacterId, GameEvent, PendingView, Role, SeatId, SeatStats, Special, Winner } from './types';
import { Rng } from './rng';
import { buildDeckSpec } from './cards/deck';
import { CARD_CATALOG } from './cards/catalog';
import { ActionCard, EquipmentCard, WeaponCard, createCard, type Card } from './cards/Card';
import './cards/actions';
import './cards/equipment';
import './cards/expansion';
import type { Character } from './characters/Character';
import { CHARACTERS, CHARACTER_IDS } from './characters/roster';
import { drawCount, handLimit, weapon, type RuleModifier } from './rules';
import { isHeart, isKegBlast, judge } from './judge';
import { SEA_EVENTS, SEA_EVENT_IDS, type SeaEventId } from './seaEvents';

export interface GameConfig {
  seed: number;
  names: string[];
  /** 테스트용 강제값 */
  roles?: Role[];
  /** 테스트용: roles와 함께 항해사·이중 첩자 지정 */
  specials?: (Special | null)[];
  /** 테스트용: 현상금 사냥꾼의 표적 */
  bountyTarget?: SeatId;
  characters?: CharacterId[];
  /** 덱 맨 위부터의 순서. 나머지는 일반 덱에서 이 카드들을 뺀 뒤 섞어 뒤에 붙인다 */
  stackDeck?: CardView[];
  /** 역할 카드를 누구부터 뽑을지 (기본 0번 자리). 1인 플레이는 사람 자리, 멀티플레이는 방장 자리 */
  firstRoleDrawer?: SeatId;
  /** 두 번째 라운드부터 선장 턴마다 바다 이벤트를 펼친다 (기본 꺼짐) */
  seaEvents?: boolean;
  /** 테스트용: 이벤트가 나올 순서. 다 쓰면 전체를 섞어 이어 간다 */
  seaEventOrder?: SeaEventId[];
  /** 확장 카드 10종(16장)을 덱에 넣는다 (기본 꺼짐) */
  expansionCards?: boolean;
}

export interface SeatState {
  seat: SeatId;
  name: string;
  role: Role;
  /** 8~9인 확장: 항해사(충성)·이중 첩자(반란) */
  special: Special | null;
  character: Character;
  hp: number;
  maxHp: number;
  hand: Card[];
  equipment: Card[];
  alive: boolean;
  characterChosen: boolean;
  /** 역할 카드를 뽑았는지 (뽑기 전 role 값은 임시) */
  roleDrawn: boolean;
}

export type ApplyResult = { ok: true } | { ok: false; reason: string };

/** resolve가 문자열을 반환하면 거부(상태를 바꾸기 전에 검사해야 함) */
type Resolver = (a: Action) => string | null;
type Step = { kind: 'input'; pending: PendingView; resolve: Resolver } | { kind: 'run'; run: () => void };

/** 인원수만큼 앞에서부터. 8번째부터가 확장 역할 인원(현상금 사냥꾼, 세 번째 충성 선원) */
const ROLE_TABLE: Role[] = ['captain', 'spy', 'rebel', 'rebel', 'loyalist', 'rebel', 'loyalist', 'hunter', 'loyalist'];

/** n인 게임에 그 역할이 몇 명 있는지 (공개 규칙이라 AI·화면도 쓴다) */
export function roleCount(n: number, role: Role): number {
  return ROLE_TABLE.slice(0, n).filter((r) => r === role).length;
}
/** 이 인원부터 항해사·이중 첩자·현상금 사냥꾼이 들어간다 */
export const EXPANSION_ROLES_FROM = 8;
type RoleSlot = { role: Role; special: Special | null };
const WRONG_ACTION = '지금 할 수 없는 행동이에요';

export class Game {
  readonly seats: SeatState[];
  /** 배열 끝이 덱 맨 위 */
  deck: Card[];
  discard: Card[] = [];
  readonly rng: Rng;
  modifiers: RuleModifier[] = [];
  current: SeatId;
  winner: Winner | null = null;
  events: GameEvent[] = [];
  /** 자리별 준 피해·쓰러뜨린 수. 최근 100개만 보이는 이벤트와 달리 게임 전체를 센다 */
  stats: Record<SeatId, SeatStats> = {};
  slashesPlayedThisTurn = 0;
  abilityUsedThisTurn = false;
  private stack: Step[] = [];
  private started = false;
  private seq = 0;
  /** 엎어 둔 역할 카드 (역할 뽑기를 할 때만) */
  private roleSlots: RoleSlot[] | null = null;
  private takenSlots = new Set<number>();
  private firstRoleDrawer: SeatId = 0;
  readonly seaEventsOn: boolean;
  seaEvent: SeaEventId | null = null;
  /** 배열 끝이 다음에 펼칠 이벤트 */
  private seaDeck: SeaEventId[] = [];
  /** 카드 덱 순서를 바꾸지 않도록 이벤트 덱은 따로 섞는다 */
  private seaRng: Rng;
  private captainTurns = 0;
  /** 앵무새의 고자질로 알게 된 역할: 보는 사람 → 알게 된 자리들 */
  /** viewer → (target → viewer에게 보인 역할) */
  private knownRoles = new Map<SeatId, Map<SeatId, Role>>();
  /** 현상금 사냥꾼 (8~9인) */
  bounty: { hunter: SeatId; target: SeatId; state: BountyState } | null = null;
  private bountyTargetConfig: SeatId | undefined;

  constructor(config: GameConfig) {
    const n = config.names.length;
    if (n < 4 || n > 9) throw new Error('인원은 4~9명이어야 해요');
    this.bountyTargetConfig = config.bountyTarget;
    this.rng = new Rng(config.seed);
    this.seaRng = new Rng((config.seed ^ 0x5ea5ea) >>> 0);
    this.seaEventsOn = config.seaEvents ?? false;
    if (config.seaEventOrder) this.seaDeck = [...config.seaEventOrder].reverse();
    const drawRoles = !config.roles;
    this.firstRoleDrawer = config.firstRoleDrawer ?? 0;
    if (drawRoles) this.roleSlots = this.makeRoleSlots(n);
    // 역할 뽑기를 하면 뽑기 전까지 자리의 역할은 임시값
    const roles: Role[] = config.roles ?? Array.from({ length: n }, () => 'rebel' as Role);
    const forced = config.characters;

    let specs = this.rng.shuffle(buildDeckSpec(this.rng, config.expansionCards ?? false));
    if (config.stackDeck) {
      const stackIds = new Set(config.stackDeck.map((c) => c.id));
      specs = [...specs.filter((c) => !stackIds.has(c.id)), ...[...config.stackDeck].reverse()];
    }
    this.deck = specs.map(createCard);

    this.seats = config.names.map((name, seat) => {
      if (!forced) {
        // 임시 캐릭터(뽑기 전에는 읽지 않음)
        return { seat, name, role: roles[seat], special: config.specials?.[seat] ?? null, character: CHARACTERS[CHARACTER_IDS[0]], hp: 0, maxHp: 0, hand: [], equipment: [], alive: true, characterChosen: false, roleDrawn: !drawRoles };
      }
      const character = CHARACTERS[forced[seat]];
      const maxHp = character.maxHp + (roles[seat] === 'captain' ? 1 : 0);
      return { seat, name, role: roles[seat], special: config.specials?.[seat] ?? null, character, hp: maxHp, maxHp, hand: [], equipment: [], alive: true, characterChosen: true, roleDrawn: !drawRoles };
    });
    for (const s of this.seats) this.stats[s.seat] = { damage: 0, kills: 0 };
    if (forced) this.dealOpeningHands();
    this.current = drawRoles ? this.firstRoleDrawer : this.captainSeat();
  }

  // ───────────── 조회 ─────────────

  captainSeat(): SeatId {
    return this.seats.findIndex((s) => s.role === 'captain');
  }

  /** 시계 방향 순서 */
  aliveSeats(): SeatId[] {
    return this.seats.filter((s) => s.alive).map((s) => s.seat);
  }

  /** from 다음 자리부터 시계 방향으로 살아있는 다른 자리들 */
  othersFrom(from: SeatId): SeatId[] {
    const n = this.seats.length;
    const out: SeatId[] = [];
    for (let i = 1; i < n; i++) {
      const s = (from + i) % n;
      if (this.seats[s].alive) out.push(s);
    }
    return out;
  }

  nextAlive(from: SeatId): SeatId {
    return this.othersFrom(from)[0] ?? from;
  }

  /** viewer가 고자질·항해사로 target의 역할을 알고 있는지 */
  knowsRole(viewer: SeatId, target: SeatId): boolean {
    return this.knownRoles.get(viewer)?.has(target) ?? false;
  }

  /** viewer에게 보인 target의 역할 (이중 첩자는 고자질에 충성 선원으로 보인다) */
  seenRole(viewer: SeatId, target: SeatId): Role | null {
    return this.knownRoles.get(viewer)?.get(target) ?? null;
  }

  /** honest: 항해사처럼 진짜 역할을 아는 경우. 아니면(고자질) 이중 첩자는 충성 선원으로 보인다 */
  revealRoleTo(viewer: SeatId, target: SeatId, honest = false): void {
    const t = this.seats[target];
    const seen: Role = !honest && t.special === 'doubleAgent' ? 'loyalist' : t.role;
    if (!this.knownRoles.has(viewer)) this.knownRoles.set(viewer, new Map());
    this.knownRoles.get(viewer)!.set(target, seen);
    this.emit({ type: 'roleRevealed', seat: viewer, target, role: seen, visibleTo: [viewer] });
  }

  /** 역할 카드 묶음. 8인 이상이면 반란 1장은 이중 첩자, 충성 1장은 항해사 */
  private makeRoleSlots(n: number): RoleSlot[] {
    const slots: RoleSlot[] = this.rng.shuffle(ROLE_TABLE.slice(0, n)).map((role) => ({ role, special: null }));
    if (n >= EXPANSION_ROLES_FROM) {
      const pick = (role: Role) => {
        const idx = slots.map((s, i) => (s.role === role ? i : -1)).filter((i) => i >= 0);
        return idx[this.rng.int(idx.length)];
      };
      slots[pick('rebel')].special = 'doubleAgent';
      slots[pick('loyalist')].special = 'navigator';
    }
    return slots;
  }

  /** 역할이 다 정해진 뒤: 항해사는 반란 선원 1명을 알고, 현상금 사냥꾼은 표적을 받는다 */
  private setupExpansionRoles(): void {
    for (const nav of this.seats.filter((s) => s.special === 'navigator')) {
      const rebels = this.seats.filter((s) => s.role === 'rebel');
      if (rebels.length) this.revealRoleTo(nav.seat, rebels[this.rng.int(rebels.length)].seat, true);
    }
    const hunter = this.seats.find((s) => s.role === 'hunter');
    if (hunter) {
      const pool = this.seats.filter((s) => s.role !== 'captain' && s.seat !== hunter.seat).map((s) => s.seat);
      const target = this.bountyTargetConfig ?? pool[this.rng.int(pool.length)];
      this.bounty = { hunter: hunter.seat, target, state: 'open' };
      this.emit({ type: 'bounty', seat: hunter.seat, target, state: 'open', visibleTo: [hunter.seat] });
    }
  }

  private setBounty(state: BountyState): void {
    const b = this.bounty!;
    b.state = state;
    this.emit({ type: 'bounty', seat: b.hunter, target: b.target, state, visibleTo: [b.hunter] });
  }

  /** 남이 표적을 쓰러뜨렸으면 사냥꾼은 새 표적을 받는다 (선장·자신 말고 살아 있는 사람). 받을 사람이 없으면 놓친다 */
  private retargetBounty(fallen: SeatId): void {
    const b = this.bounty!;
    const pool = this.seats.filter((s) => s.alive && s.role !== 'captain' && s.seat !== b.hunter && s.seat !== fallen).map((s) => s.seat);
    if (!pool.length) return this.setBounty('lost');
    b.target = pool[this.rng.int(pool.length)];
    this.emit({ type: 'bounty', seat: b.hunter, target: b.target, state: 'open', renewed: true, visibleTo: [b.hunter] });
  }

  /** 게임이 끝났고 현상금 사냥꾼이 표적을 직접 쓰러뜨린 뒤 살아남았는지 */
  get bountyWon(): boolean {
    const b = this.bounty;
    return this.winner !== null && !!b && b.state === 'claimed' && this.seats[b.hunter].alive;
  }

  /** 덱 맨 위 카드 (비었으면 버린 카드를 섞어 채운다). 꺼내지 않는다 */
  peekTop(): Card | undefined {
    if (this.deck.length === 0 && this.discard.length > 0) this.deck = this.rng.shuffle(this.discard.splice(0));
    return this.deck.at(-1);
  }

  /** 고든처럼 빼앗기 카드에 버티는 캐릭터면 판정(♥·♦이면 무효), 아니면 바로 effect */
  unlessResisted(target: SeatId, kind: CardKind, effect: () => void): void {
    const ch = this.seats[target].character;
    if (!ch.resistsTakes()) return effect();
    judge(this, target, kind, (c) => c.suit === 'hearts' || c.suit === 'diamonds', (resisted) => {
      if (resisted) this.emit({ type: 'ability', seat: target, character: ch.id });
      else effect();
    });
  }

  /** 판정 때 뒤집을 장수: 캐릭터 능력 또는 나침반 */
  judgeFlipCount(seat: SeatId): 1 | 2 {
    return this.findEquip(seat, 'compass') ? 2 : this.seats[seat].character.judgeFlipCount();
  }

  hasEquip(seat: SeatId, kind: CardKind): boolean {
    return this.findEquip(seat, kind) !== undefined;
  }

  /** 스스로 버려지며 효과를 내는 장비를 쓴다 */
  useUpGear(seat: SeatId, kind: CardKind): void {
    const c = this.findEquip(seat, kind);
    if (!c) return;
    this.removeEquipment(seat, c.id);
    this.discardCard(c);
    this.emit({ type: 'gearUsed', seat, card: c.toView() });
  }

  /** seat가 손패 count장을 골라 버리게 한다 */
  forceDiscard(seat: SeatId, count: number): void {
    if (count <= 0 || !this.seats[seat].alive) return;
    this.pushInput({ kind: 'discardExcess', seat, count }, (a) => {
      if (a.type !== 'discard') return WRONG_ACTION;
      const cards = this.cardsInHand(seat, a.cardIds);
      if (!cards || cards.length !== count) return `${count}장을 골라 버려 주세요`;
      for (const c of cards) this.removeFromHand(seat, c.id);
      for (const c of cards) this.discardCard(c);
      this.emit({ type: 'discardCards', seat, cards: cards.map((c) => c.toView()) });
      return null;
    });
  }

  pending(): PendingView | null {
    const top = this.stack.at(-1);
    return top && top.kind === 'input' ? top.pending : null;
  }

  // ───────────── 진행 ─────────────

  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.roleSlots) this.roleDrawFrom(0);
    else this.afterRoles();
    this.advance();
  }

  /** 역할이 다 정해진 뒤: 캐릭터 뽑기 또는 바로 첫 턴 */
  private afterRoles(): void {
    this.setupExpansionRoles();
    this.current = this.captainSeat();
    if (this.seats.every((s) => s.characterChosen)) this.beginTurn(this.captainSeat());
    else this.draftFrom(0);
  }

  /** firstRoleDrawer부터 시계 방향으로 i번째 사람이 엎어 둔 역할 카드 하나를 뽑는다 */
  private roleDrawFrom(i: number): void {
    const slots = this.roleSlots!;
    if (i >= this.seats.length) {
      // 테스트용으로 캐릭터만 강제한 경우: 선장 체력 +1을 이제 반영
      if (this.seats.every((s) => s.characterChosen)) {
        const cap = this.seats[this.captainSeat()];
        cap.maxHp += 1;
        cap.hp += 1;
        cap.hand.push(...this.draw(1));
      }
      this.afterRoles();
      return;
    }
    const seat = (this.firstRoleDrawer + i) % this.seats.length;
    const remaining = slots.map((_, k) => k).filter((k) => !this.takenSlots.has(k));
    this.pushInput({ kind: 'drawRole', seat, slots: remaining }, (a) => {
      if (a.type !== 'drawRole') return WRONG_ACTION;
      if (!remaining.includes(a.slot)) return '남아 있는 역할 카드 중에서 골라 주세요';
      const s = this.seats[seat];
      s.role = slots[a.slot].role;
      s.special = slots[a.slot].special;
      s.roleDrawn = true;
      this.takenSlots.add(a.slot);
      if (s.role === 'captain') {
        this.emit({ type: 'roleDrawn', seat, slot: a.slot, role: 'captain' });
      } else {
        const others = this.seats.map((x) => x.seat).filter((x) => x !== seat);
        this.emit({ type: 'roleDrawn', seat, slot: a.slot, role: null, visibleTo: others });
        this.emit({ type: 'roleDrawn', seat, slot: a.slot, role: s.role, special: s.special, visibleTo: [seat] });
      }
      this.roleDrawFrom(i + 1);
      return null;
    });
  }

  private dealOpeningHands(): void {
    for (const s of this.seats) s.hand.push(...this.draw(s.hp));
  }

  /** 선장부터 시계 방향으로 i번째 사람이 캐릭터를 고른다 */
  private draftFrom(i: number): void {
    const n = this.seats.length;
    if (i >= n) {
      for (const s of this.seats) {
        s.maxHp = s.character.maxHp + (s.role === 'captain' ? 1 : 0);
        s.hp = s.maxHp;
      }
      this.dealOpeningHands();
      this.beginTurn(this.captainSeat());
      return;
    }
    const seat = (this.captainSeat() + i) % n;
    const taken = new Set(this.seats.filter((s) => s.characterChosen).map((s) => s.character.id));
    const options = this.rng.shuffle(CHARACTER_IDS.filter((c) => !taken.has(c))).slice(0, 3);
    this.pushInput({ kind: 'chooseCharacter', seat, options }, (a) => {
      if (a.type !== 'chooseCharacter') return WRONG_ACTION;
      if (!options.includes(a.character)) return '제시된 캐릭터 중에서 골라 주세요';
      const s = this.seats[seat];
      s.character = CHARACTERS[a.character];
      s.characterChosen = true;
      this.emit({ type: 'characterChosen', seat, character: a.character });
      this.draftFrom(i + 1);
      return null;
    });
  }

  apply(seat: SeatId, action: Action): ApplyResult {
    if (this.winner) return { ok: false, reason: '게임이 끝났어요' };
    const top = this.stack.at(-1);
    if (!top || top.kind !== 'input') return { ok: false, reason: WRONG_ACTION };
    if (top.pending.seat !== seat) return { ok: false, reason: '지금은 당신 차례가 아니에요' };
    this.stack.pop();
    const err = top.resolve(action);
    if (err !== null) {
      this.stack.push(top);
      return { ok: false, reason: err };
    }
    this.advance();
    return { ok: true };
  }

  /** 입력이 필요 없는 단계를 다음 입력 대기가 나올 때까지 실행 */
  private advance(): void {
    while (!this.winner) {
      const top = this.stack.at(-1);
      if (!top) return;
      if (top.kind === 'input') {
        if (this.seats[top.pending.seat].alive) return;
        this.stack.pop(); // 쓰러진 사람에게는 묻지 않음
        continue;
      }
      this.stack.pop();
      top.run();
    }
    this.stack = [];
  }

  pushInput(p: PendingView, resolve: Resolver): void {
    this.stack.push({ kind: 'input', pending: p, resolve });
  }

  pushStep(run: () => void): void {
    this.stack.push({ kind: 'run', run });
  }

  private beginTurn(seat: SeatId): void {
    this.current = seat;
    this.slashesPlayedThisTurn = 0;
    this.abilityUsedThisTurn = false;
    const reveal = this.seaEventsOn && seat === this.captainSeat() && ++this.captainTurns >= 2;
    const event = reveal ? this.revealSeaEvent() : null;
    this.emit({ type: 'turnStart', seat });
    this.pushStep(() => this.kegPhase(seat));
    if (event?.onReveal) this.pushStep(() => event.onReveal!(this));
  }

  /** 다음 바다 이벤트를 펼쳐 규칙을 바꾼다. 덱을 다 쓰면 다시 섞는다 */
  private revealSeaEvent() {
    if (this.seaDeck.length === 0) this.seaDeck = this.seaRng.shuffle([...SEA_EVENT_IDS]);
    const id = this.seaDeck.pop()!;
    const info = SEA_EVENTS[id];
    this.seaEvent = id;
    this.modifiers = info.modifier ? [info.modifier] : [];
    this.emit({ type: 'seaEvent', event: id });
    return info;
  }

  findEquip(seat: SeatId, kind: CardKind): Card | undefined {
    return this.seats[seat].equipment.find((c) => c.kind === kind);
  }

  /** 턴 시작 ①: 화약통 */
  private kegPhase(seat: SeatId): void {
    const keg = this.findEquip(seat, 'powderKeg');
    if (!keg) return this.brigPhase(seat);
    if (this.seats[seat].character.passesKegFreely()) {
      this.pushInput({ kind: 'passKeg', seat }, (a) => {
        if (a.type !== 'chooseSeat' || a.target === seat || !this.seats[a.target]?.alive) return '화약통을 넘길 다른 사람을 골라 주세요';
        this.removeEquipment(seat, keg.id);
        this.seats[a.target].equipment.push(keg);
        this.emit({ type: 'ability', seat, character: this.seats[seat].character.id });
        this.brigPhase(seat);
        return null;
      });
      return;
    }
    judge(this, seat, 'powderKeg', isKegBlast, (blast) => {
      this.removeEquipment(seat, keg.id);
      if (blast) {
        this.discardCard(keg);
        this.pushStep(() => this.brigPhase(seat));
        this.dealDamage(seat, 3, null);
      } else {
        this.seats[this.nextAlive(seat)].equipment.push(keg);
        this.brigPhase(seat);
      }
    });
  }

  /** 턴 시작 ②: 영창 */
  private brigPhase(seat: SeatId): void {
    const brig = this.findEquip(seat, 'brig');
    if (!brig) return this.mainPhase(seat);
    judge(this, seat, 'brig', isHeart, (free) => {
      this.removeEquipment(seat, brig.id);
      this.discardCard(brig);
      if (free) this.mainPhase(seat);
      else this.pushStep(() => this.nextTurn());
    });
  }

  /** 턴 시작 ③: (캐릭터 능력) → 뽑기 → 카드 사용 */
  private mainPhase(seat: SeatId): void {
    this.pushTurnInput(seat);
    this.pushStep(() => this.drawPhase(seat));
    this.beforeDrawHooks(seat);
  }

  /** 뽑기 직전에 처리할 캐릭터 능력. 나중에 쌓인 것이 먼저 실행된다 */
  private beforeDrawHooks(seat: SeatId): void {
    this.seats[seat].character.onTurnStartBeforeDraw(this, seat);
  }

  protected drawPhase(seat: SeatId): void {
    const n = drawCount(this, seat);
    if (this.seats[seat].character.offersDiscardDraw() && this.discard.length > 0 && n > 0) {
      this.pushInput({ kind: 'drawSource', seat }, (a) => {
        if (a.type !== 'chooseDrawSource') return WRONG_ACTION;
        const first = a.fromDiscard ? [this.discard.pop()!] : [];
        this.giveCards(seat, [...first, ...this.draw(n - first.length)]);
        return null;
      });
      return;
    }
    this.giveCards(seat, this.draw(n));
  }

  giveCards(seat: SeatId, cards: Card[]): void {
    this.seats[seat].hand.push(...cards);
    this.emit({ type: 'draw', seat, count: cards.length });
    if (cards.length) this.emit({ type: 'drawCards', seat, cards: cards.map((c) => c.toView()), visibleTo: [seat] });
  }

  private pushTurnInput(seat: SeatId): void {
    this.pushInput({ kind: 'turn', seat }, (a) => this.resolveTurn(seat, a));
  }

  private resolveTurn(seat: SeatId, a: Action): string | null {
    if (a.type === 'endTurn') {
      this.pushStep(() => this.endPhase(seat));
      return null;
    }
    if (a.type === 'useAbility') {
      const ch = this.seats[seat].character;
      const err = ch.canUseAbility(this, seat, a);
      if (err) return err;
      this.pushTurnInput(seat);
      this.emit({ type: 'ability', seat, character: ch.id });
      ch.useAbility(this, seat, a);
      return null;
    }
    if (a.type !== 'playCard') return WRONG_ACTION;
    const card = this.findInHand(seat, a.cardId);
    if (!card) return '손에 없는 카드예요';
    const p = { target: a.target, targetCardId: a.targetCardId };
    if (card instanceof ActionCard) {
      const err = card.validate(this, seat, p);
      if (err) return err;
      this.removeFromHand(seat, card.id);
      this.pushTurnInput(seat);
      this.discardCard(card);
      this.emit({ type: 'play', seat, card: card.toView(), target: a.target });
      card.play(this, seat, p);
      return null;
    }
    if (card instanceof EquipmentCard) {
      const owner = card.placement() === 'self' ? seat : a.target;
      if (owner === undefined) return '대상을 골라 주세요';
      const err = card.validate(this, seat, p);
      if (err) return err;
      this.removeFromHand(seat, card.id);
      this.pushTurnInput(seat);
      if (card instanceof WeaponCard) {
        const old = this.seats[owner].equipment.filter((c) => c instanceof WeaponCard);
        for (const w of old) this.removeEquipment(owner, w.id);
        for (const w of old) this.discardCard(w);
      }
      this.seats[owner].equipment.push(card);
      this.emit({ type: 'play', seat, card: card.toView(), target: owner === seat ? undefined : owner });
      card.onEquip(this, owner);
      return null;
    }
    return WRONG_ACTION;
  }

  private endPhase(seat: SeatId): void {
    const ch = this.seats[seat].character;
    if (ch.drawsOnQuietTurn() && this.slashesPlayedThisTurn === 0) {
      this.emit({ type: 'ability', seat, character: ch.id });
      this.giveCards(seat, this.draw(1));
    }
    const excess = this.seats[seat].hand.length - handLimit(this, seat);
    this.pushStep(() => this.nextTurn());
    this.forceDiscard(seat, excess);
  }

  private nextTurn(): void {
    this.beginTurn(this.nextAlive(this.current));
  }

  // ───────────── 카드·피해 (카드·캐릭터 클래스가 사용) ─────────────

  emit(e: GameEvent): void {
    e.seq = ++this.seq;
    this.events.push(e);
    if (e.type === 'damage' && e.source !== null && e.source !== e.seat) this.stats[e.source].damage += e.amount;
    if (e.type === 'death' && e.killer !== null && e.killer !== e.seat) this.stats[e.killer].kills++;
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

  findInHand(seat: SeatId, id: CardId): Card | undefined {
    return this.seats[seat].hand.find((c) => c.id === id);
  }

  /** 모두 손에 있고 중복이 없으면 카드 목록, 아니면 null */
  cardsInHand(seat: SeatId, idList: CardId[], kind?: CardKind): Card[] | null {
    if (new Set(idList).size !== idList.length) return null;
    const out: Card[] = [];
    for (const id of idList) {
      const c = this.findInHand(seat, id);
      if (!c || (kind && c.kind !== kind)) return null;
      out.push(c);
    }
    return out;
  }

  removeFromHand(seat: SeatId, id: CardId): Card | undefined {
    const hand = this.seats[seat].hand;
    const i = hand.findIndex((c) => c.id === id);
    return i >= 0 ? hand.splice(i, 1)[0] : undefined;
  }

  removeEquipment(seat: SeatId, id: CardId): Card | undefined {
    const eq = this.seats[seat].equipment;
    const i = eq.findIndex((c) => c.id === id);
    return i >= 0 ? eq.splice(i, 1)[0] : undefined;
  }

  discardCard(c: Card): void {
    this.discard.push(c);
  }

  /**
   * 응답으로 특정 종류 카드를 n장 내게 하는 입력 대기.
   * onPlayed: 냈을 때, onDeclined: 안 냈을 때([]).
   */
  pushCardResponse(p: PendingView, kind: CardKind, n: number, onPlayed: () => void, onDeclined: () => void): void {
    const seat = p.seat;
    this.pushInput(p, (a) => {
      if (a.type !== 'respond') return WRONG_ACTION;
      if (a.cardIds.length === 0) {
        onDeclined();
        return null;
      }
      const cards = this.cardsInHand(seat, a.cardIds, kind);
      if (!cards || cards.length !== n) return `${CARD_CATALOG[kind].name} ${n}장을 내거나 포기해 주세요`;
      for (const c of cards) this.removeFromHand(seat, c.id);
      for (const c of cards) this.discardCard(c);
      this.emit({ type: 'respond', seat, cards: cards.map((c) => c.toView()) });
      onPlayed();
      return null;
    });
  }

  /** 칼질·포격 공격 1회. afterHit: 피해를 준 뒤(쓰러짐 처리 후) 실행 */
  attack(target: SeatId, attacker: SeatId, source: AttackSource, afterHit?: () => void): void {
    const ch = this.seats[target].character;
    if (ch.autoDodges(source)) {
      this.emit({ type: 'ability', seat: target, character: ch.id });
      return;
    }
    const barrelThen = () => this.barrelOrRespond(target, attacker, source, afterHit);
    if (ch.hasInnateBarrel()) {
      this.emit({ type: 'ability', seat: target, character: ch.id });
      judge(this, target, 'barrel', isHeart, (dodged) => {
        if (!dodged) barrelThen();
      });
      return;
    }
    barrelThen();
  }

  private barrelOrRespond(target: SeatId, attacker: SeatId, source: AttackSource, afterHit?: () => void): void {
    if (this.findEquip(target, 'barrel')) {
      judge(this, target, 'barrel', isHeart, (dodged) => {
        if (!dodged) this.attackResponse(target, attacker, source, afterHit);
      });
      return;
    }
    this.attackResponse(target, attacker, source, afterHit);
  }

  private attackResponse(target: SeatId, attacker: SeatId, source: AttackSource, afterHit?: () => void): void {
    this.pushCardResponse(
      { kind: 'respondAttack', seat: target, attacker, source },
      'dodge',
      1,
      () => {},
      () => {
        if (this.hasEquip(target, 'leatherCoat')) {
          this.useUpGear(target, 'leatherCoat');
          return;
        }
        if (afterHit) this.pushStep(afterHit);
        this.dealDamage(target, 1, attacker);
      },
    );
  }

  /** 포격 효과: 나를 뺀 모두에게 앉은 순서대로 */
  cannonade(actor: SeatId): void {
    for (const t of [...this.othersFrom(actor)].reverse()) this.pushStep(() => this.attack(t, actor, 'cannonade'));
  }

  /** 결투에서 seat가 칼질을 낼 차례 */
  duelTurn(seat: SeatId, opponent: SeatId): void {
    const required = this.seats[opponent].character.duelSlashesRequiredFromOpponent();
    this.pushCardResponse(
      { kind: 'respondDuel', seat, opponent, required },
      'slash',
      required,
      () => this.duelTurn(opponent, seat),
      () => this.dealDamage(seat, 1, opponent),
    );
  }

  /** 전리품 분배: order 순서대로 한 장씩. 마지막 한 장은 자동 */
  lootPick(order: SeatId[], cards: Card[]): void {
    if (cards.length === 0) return;
    const [seat, ...rest] = order;
    if (seat === undefined) {
      for (const c of cards) this.discardCard(c);
      return;
    }
    if (cards.length === 1) {
      this.giveCards(seat, cards);
      return;
    }
    this.pushInput({ kind: 'loot', seat, revealed: cards.map((c) => c.toView()) }, (a) => {
      if (a.type !== 'chooseCard') return WRONG_ACTION;
      const picked = cards.find((c) => c.id === a.cardId);
      if (!picked) return '펼쳐진 카드 중에서 골라 주세요';
      this.giveCards(seat, [picked]);
      this.lootPick(rest, cards.filter((c) => c !== picked));
      return null;
    });
  }

  /** 칼질 카드로 하는 공격 */
  slashAttack(target: SeatId, attacker: SeatId): void {
    this.attack(target, attacker, 'slash', () => {
      weapon(this, attacker)?.onSlashHit(this, attacker, target);
      this.seats[attacker].character.onSlashDamageDealt(this, attacker, target);
    });
  }

  dealDamage(target: SeatId, amount: number, source: SeatId | null): void {
    const s = this.seats[target];
    if (!s.alive) return;
    s.hp -= amount;
    this.emit({ type: 'damage', seat: target, amount, source });
    const extra = s.character.drawOnDamage();
    // 핍: 쓰러지기 직전이어도 받은 카드(럼주)로 버틸 수 있다. 둘만 남아 바로 쓰러지면 받지 않는다
    if (extra && (s.hp > 0 || this.aliveSeats().length > 2)) {
      this.emit({ type: 'ability', seat: target, character: s.character.id });
      this.giveCards(target, this.draw(extra));
    }
    if (s.hp > 0) return;
    if (this.aliveSeats().length <= 2) {
      this.kill(target, source);
      return;
    }
    const heal = s.character.rumHeal();
    const need = Math.ceil((1 - s.hp) / heal);
    this.pushCardResponse(
      { kind: 'dying', seat: target, need },
      'rum',
      need,
      () => this.heal(target, need * heal),
      () => this.kill(target, source),
    );
  }

  heal(seat: SeatId, amount: number): void {
    const s = this.seats[seat];
    const before = s.hp;
    s.hp = Math.min(s.maxHp, s.hp + amount);
    if (s.hp > before) this.emit({ type: 'heal', seat, amount: s.hp - before });
  }

  kill(seat: SeatId, killer: SeatId | null): void {
    const s = this.seats[seat];
    if (!s.alive) return;
    s.alive = false;
    this.emit({ type: 'death', seat, role: s.role, killer, special: s.special });
    const b = this.bounty;
    if (b && b.state === 'open' && seat === b.target) {
      if (killer === b.hunter) this.setBounty('claimed');
      else this.retargetBounty(seat);
    }
    else if (b && b.state !== 'lost' && seat === b.hunter) this.setBounty('lost');
    for (const c of s.hand.splice(0)) this.discardCard(c);
    for (const c of s.equipment.splice(0)) this.discardCard(c);

    const winner = this.checkWinner();
    if (winner) {
      this.winner = winner;
      this.stack = [];
      this.emit({ type: 'gameOver', winner });
      return;
    }
    if (killer !== null && killer !== seat && this.seats[killer].alive) {
      const flag = this.hasEquip(killer, 'blackFlag');
      if (s.role === 'rebel') this.giveCards(killer, this.draw(3));
      if (s.role === 'loyalist' && this.seats[killer].role === 'captain') {
        const k = this.seats[killer];
        const lost = [...k.hand.splice(0), ...k.equipment.splice(0)];
        for (const c of lost) this.discardCard(c);
        if (lost.length) this.emit({ type: 'discardCards', seat: killer, cards: lost.map((c) => c.toView()) });
      }
      // 검은 깃발: 쓰러뜨린 순간 갖고 있었으면 (선장 벌칙으로 버려져도) 2장
      if (flag) this.giveCards(killer, this.draw(2));
    }
    if (seat === this.current) {
      // 자기 턴에 쓰러지면 남은 턴 단계를 버리고 다음 사람에게
      this.stack = [];
      this.pushStep(() => this.nextTurn());
    }
  }

  private checkWinner(): Winner | null {
    const alive = this.seats.filter((x) => x.alive);
    if (!alive.some((x) => x.role === 'captain')) {
      // 선장이 쓰러질 때 반란 선원은 다 쓰러지고 첩자가 살아 있으면 첩자 승리 (충성 선원이 남아 있어도)
      return alive.some((x) => x.role === 'spy') && !alive.some((x) => x.role === 'rebel') ? 'spy' : 'rebels';
    }
    if (!alive.some((x) => x.role === 'rebel' || x.role === 'spy')) return 'captainTeam';
    return null;
  }
}

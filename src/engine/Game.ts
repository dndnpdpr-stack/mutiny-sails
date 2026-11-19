import type { Action, CardId, CardKind, CardView, CharacterId, GameEvent, PendingView, Role, SeatId, Winner } from './types';
import { Rng } from './rng';
import { buildDeckSpec } from './cards/deck';
import { CARD_CATALOG } from './cards/catalog';
import { ActionCard, EquipmentCard, WeaponCard, createCard, type Card } from './cards/Card';
import './cards/actions';
import './cards/equipment';
import type { Character } from './characters/Character';
import { CHARACTERS, CHARACTER_IDS } from './characters/roster';
import { drawCount, handLimit, type RuleModifier } from './rules';

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

export type ApplyResult = { ok: true } | { ok: false; reason: string };

/** resolve가 문자열을 반환하면 거부(상태를 바꾸기 전에 검사해야 함) */
type Resolver = (a: Action) => string | null;
type Step = { kind: 'input'; pending: PendingView; resolve: Resolver } | { kind: 'run'; run: () => void };

const ROLE_TABLE: Role[] = ['captain', 'spy', 'rebel', 'rebel', 'loyalist', 'rebel', 'loyalist'];
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
  slashesPlayedThisTurn = 0;
  abilityUsedThisTurn = false;
  private stack: Step[] = [];
  private started = false;

  constructor(config: GameConfig) {
    const n = config.names.length;
    if (n < 4 || n > 7) throw new Error('인원은 4~7명이어야 해요');
    this.rng = new Rng(config.seed);
    const roles = config.roles ?? this.rng.shuffle(ROLE_TABLE.slice(0, n));
    const chars = config.characters ?? this.rng.shuffle([...CHARACTER_IDS]).slice(0, n);

    let specs = this.rng.shuffle(buildDeckSpec(this.rng));
    if (config.stackDeck) {
      const stackIds = new Set(config.stackDeck.map((c) => c.id));
      specs = [...specs.filter((c) => !stackIds.has(c.id)), ...[...config.stackDeck].reverse()];
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

  pending(): PendingView | null {
    const top = this.stack.at(-1);
    return top && top.kind === 'input' ? top.pending : null;
  }

  // ───────────── 진행 ─────────────

  start(): void {
    if (this.started) return;
    this.started = true;
    this.beginTurn(this.captainSeat());
    this.advance();
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

  /** 지금 쌓인 단계를 전부 버림 (게임 종료, 턴 주인 쓰러짐) */
  protected clearStack(): void {
    this.stack = [];
  }

  private beginTurn(seat: SeatId): void {
    this.current = seat;
    this.slashesPlayedThisTurn = 0;
    this.abilityUsedThisTurn = false;
    this.emit({ type: 'turnStart', seat });
    this.pushTurnInput(seat);
    this.pushStep(() => this.drawPhase(seat));
    this.turnStartHooks(seat);
  }

  /** 뽑기 전에 처리할 것들(판정, 캐릭터 능력). 나중에 쌓인 것이 먼저 실행된다 */
  protected turnStartHooks(_seat: SeatId): void {}

  protected drawPhase(seat: SeatId): void {
    this.giveCards(seat, this.draw(drawCount(this, seat)));
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
      const err = ch.canUseAbility(this, seat, a.cardIds);
      if (err) return err;
      this.pushTurnInput(seat);
      this.emit({ type: 'ability', seat, character: ch.id });
      ch.useAbility(this, seat, a.cardIds);
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
    const excess = this.seats[seat].hand.length - handLimit(this, seat);
    this.pushStep(() => this.nextTurn());
    if (excess > 0) {
      this.pushInput({ kind: 'discardExcess', seat, count: excess }, (a) => {
        if (a.type !== 'discard') return WRONG_ACTION;
        const cards = this.cardsInHand(seat, a.cardIds);
        if (!cards || cards.length !== excess) return `${excess}장을 골라 버려 주세요`;
        for (const c of cards) this.removeFromHand(seat, c.id);
        for (const c of cards) this.discardCard(c);
        this.emit({ type: 'discardCards', seat, cards: cards.map((c) => c.toView()) });
        return null;
      });
    }
  }

  private nextTurn(): void {
    this.beginTurn(this.nextAlive(this.current));
  }

  // ───────────── 카드·피해 (카드·캐릭터 클래스가 사용) ─────────────

  emit(e: GameEvent): void {
    this.events.push(e);
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
  attack(target: SeatId, attacker: SeatId, source: 'slash' | 'cannonade', afterHit?: () => void): void {
    this.pushCardResponse(
      { kind: 'respondAttack', seat: target, attacker, source },
      'dodge',
      1,
      () => {},
      () => {
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
    this.attack(target, attacker, 'slash');
  }

  dealDamage(target: SeatId, amount: number, source: SeatId | null): void {
    const s = this.seats[target];
    if (!s.alive) return;
    s.hp -= amount;
    this.emit({ type: 'damage', seat: target, amount, source });
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
    this.emit({ type: 'death', seat, role: s.role, killer });
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
      if (s.role === 'rebel') this.giveCards(killer, this.draw(3));
      if (s.role === 'loyalist' && this.seats[killer].role === 'captain') {
        const k = this.seats[killer];
        const lost = [...k.hand.splice(0), ...k.equipment.splice(0)];
        for (const c of lost) this.discardCard(c);
        if (lost.length) this.emit({ type: 'discardCards', seat: killer, cards: lost.map((c) => c.toView()) });
      }
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
      return alive.length === 1 && alive[0].role === 'spy' ? 'spy' : 'rebels';
    }
    if (!alive.some((x) => x.role === 'rebel' || x.role === 'spy')) return 'captainTeam';
    return null;
  }
}

import type { CardKind } from '../types';

export interface CardInfo {
  kind: CardKind;
  name: string;
  count: number;
  category: 'action' | 'equipment';
  emoji: string;
  text: string;
  /** 대상(자리)을 골라야 하는 카드 */
  needsTarget: boolean;
  /** 대상의 장비를 고를 수 있는 카드 */
  targetsCards: boolean;
  /** 확장 카드 (켰을 때만 덱에 들어간다) */
  expansion?: boolean;
}

const list: Array<Omit<CardInfo, 'needsTarget' | 'targetsCards'>> = [
  { kind: 'slash', name: '칼질', count: 23, category: 'action', emoji: '🗡️', text: '사거리 안의 1명을 공격해요. 상대는 피하기를 내거나 체력 1을 잃어요. (한 턴에 1번)' },
  { kind: 'dodge', name: '피하기', count: 12, category: 'action', emoji: '💨', text: '공격을 받았을 때 내서 무효로 만들어요.' },
  { kind: 'rum', name: '럼주', count: 6, category: 'action', emoji: '🍺', text: '체력 1을 회복해요. 두 명만 남으면 쓸 수 없어요.' },
  { kind: 'cannonade', name: '포격', count: 1, category: 'action', emoji: '💥', text: '나를 뺀 모두를 공격해요. 각자 피하기를 내거나 체력 1을 잃어요.' },
  { kind: 'brawl', name: '갑판 난투', count: 2, category: 'action', emoji: '🤼', text: '나를 뺀 모두는 칼질을 내거나 체력 1을 잃어요.' },
  { kind: 'duel', name: '결투', count: 3, category: 'action', emoji: '⚔️', text: '1명을 지목해 번갈아 칼질을 버려요. 먼저 못 내는 쪽이 체력 1을 잃어요.' },
  { kind: 'pickpocket', name: '소매치기', count: 4, category: 'action', emoji: '🫳', text: '거리 1인 상대의 손패(무작위) 또는 장비 1장을 가져와요.' },
  { kind: 'cutRope', name: '밧줄 자르기', count: 4, category: 'action', emoji: '✂️', text: '아무 상대의 손패(무작위) 또는 장비 1장을 버리게 해요.' },
  { kind: 'supplyShip', name: '보급선', count: 2, category: 'action', emoji: '⛵', text: '카드 2장을 뽑아요.' },
  { kind: 'merchantRaid', name: '상선 약탈', count: 1, category: 'action', emoji: '💰', text: '카드 3장을 뽑아요.' },
  { kind: 'feast', name: '선상 잔치', count: 1, category: 'action', emoji: '🍖', text: '살아있는 모두가 체력 1을 회복해요.' },
  { kind: 'loot', name: '전리품 분배', count: 2, category: 'action', emoji: '🎁', text: '살아있는 인원만큼 카드를 펼치고, 나부터 1장씩 가져가요.' },
  { kind: 'pistol', name: '권총', count: 3, category: 'equipment', emoji: '🔫', text: '무기. 사거리 2.' },
  { kind: 'musket', name: '머스킷', count: 3, category: 'equipment', emoji: '🪈', text: '무기. 사거리 3.' },
  { kind: 'longMusket', name: '롱 머스킷', count: 1, category: 'equipment', emoji: '🎯', text: '무기. 사거리 4.' },
  { kind: 'deckCannon', name: '선상 대포', count: 1, category: 'equipment', emoji: '💣', text: '무기. 사거리 5.' },
  { kind: 'twinPistols', name: '쌍권총', count: 2, category: 'equipment', emoji: '🔫🔫', text: '무기. 사거리 1. 칼질을 횟수 제한 없이 쓸 수 있어요.' },
  { kind: 'spyglass', name: '망원경', count: 1, category: 'equipment', emoji: '🔭', text: '내가 남을 볼 때 거리 −1.' },
  { kind: 'dinghy', name: '작은 보트', count: 2, category: 'equipment', emoji: '🛶', text: '남이 나를 볼 때 거리 +1.' },
  { kind: 'barrel', name: '엄폐용 나무통', count: 2, category: 'equipment', emoji: '🛢️', text: '칼질·포격을 받을 때 판정: ♥이면 피해요.' },
  { kind: 'powderKeg', name: '화약통', count: 1, category: 'equipment', emoji: '🧨', text: '내 턴 시작 시 판정: ♠2~9면 터져서 체력 3을 잃어요. 아니면 다음 사람에게 넘겨요.' },
  { kind: 'brig', name: '영창', count: 3, category: 'equipment', emoji: '⛓️', text: '다른 사람(선장 제외) 앞에 둬요. 그 사람은 턴 시작 시 판정: ♥이 아니면 턴을 건너뛰어요.' },
  // ── 확장 카드 ──
  { kind: 'parrotTattle', name: '앵무새의 고자질', count: 1, category: 'action', emoji: '🦜', text: '선장이 아닌 1명의 역할을 나만 몰래 봐요.', expansion: true },
  { kind: 'treasureMap', name: '보물 지도', count: 2, category: 'action', emoji: '🗺️', text: '덱 위 3장을 나만 보고 1장을 가져가요. 나머지는 버려요.', expansion: true },
  { kind: 'diceWager', name: '주사위 내기', count: 2, category: 'action', emoji: '🎲', text: '1명과 덱 맨 위를 1장씩 뒤집어요. 숫자가 높은 쪽이 상대 손패 1장(무작위)을 가져가요. 같으면 무효.', expansion: true },
  { kind: 'fireShip', name: '불붙은 배', count: 1, category: 'action', emoji: '🔥', text: '사거리 안의 1명과 그 양옆 사람(나 제외)이 각자 피하기를 내거나 체력 1을 잃어요.', expansion: true },
  { kind: 'walkPlank', name: '널빤지 걷기', count: 2, category: 'action', emoji: '🪢', text: '손패가 가장 많은 사람(들)이 카드 2장을 골라 버려요.', expansion: true },
  { kind: 'leatherCoat', name: '가죽 코트', count: 2, category: 'equipment', emoji: '🧥', text: '칼질·포격·불붙은 배를 피하지 못했을 때 피해를 한 번 막고 버려져요.', expansion: true },
  { kind: 'harpoon', name: '작살', count: 2, category: 'equipment', emoji: '🔱', text: '무기. 사거리 2. 칼질로 피해를 주면 상대 손패 1장(무작위)도 버리게 해요.', expansion: true },
  { kind: 'compass', name: '나침반', count: 1, category: 'equipment', emoji: '🧭', text: '판정할 때 2장을 뒤집고 하나를 골라요.', expansion: true },
  { kind: 'luckyCoin', name: '행운의 동전', count: 2, category: 'equipment', emoji: '🪙', text: '내 판정 결과가 나쁘면 ♥로 바꾸고 버려져요.', expansion: true },
  { kind: 'blackFlag', name: '검은 깃발', count: 1, category: 'equipment', emoji: '🏴', text: '내가 누군가를 쓰러뜨리면 카드 2장을 더 받아요.', expansion: true },
];

const TARGETED: CardKind[] = ['slash', 'duel', 'pickpocket', 'cutRope', 'brig', 'parrotTattle', 'diceWager', 'fireShip'];
const CARD_TARGETING: CardKind[] = ['pickpocket', 'cutRope'];

export const CARD_CATALOG = Object.fromEntries(
  list.map((i) => [i.kind, { ...i, needsTarget: TARGETED.includes(i.kind), targetsCards: CARD_TARGETING.includes(i.kind) }]),
) as Record<CardKind, CardInfo>;

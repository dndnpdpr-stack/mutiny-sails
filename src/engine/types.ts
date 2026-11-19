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

import { EquipmentCard, WeaponCard, registerCard } from './Card';

export class Pistol extends WeaponCard {
  readonly range = 2;
}
export class DeckCannon extends WeaponCard {
  readonly range = 5;
}
export class Spyglass extends EquipmentCard {}
export class Dinghy extends EquipmentCard {}

registerCard('pistol', Pistol);
registerCard('deckCannon', DeckCannon);
registerCard('spyglass', Spyglass);
registerCard('dinghy', Dinghy);

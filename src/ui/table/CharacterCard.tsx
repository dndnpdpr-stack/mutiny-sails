import { motion } from 'framer-motion';
import { CHARACTER_INFO } from '../../engine/characters/roster';
import type { CharacterId } from '../../engine/types';

export const CHARACTER_FACE: Record<CharacterId, string> = {
  tom: '👨‍🍳',
  margo: '🦜',
  lou: '🧔',
  derrick: '🤠',
  orso: '🐻',
  nico: '🕵️',
  hanna: '👩‍✈️',
  sila: '🧙',
  bibi: '🐒',
  bruno: '💪',
};

export function CharacterCard(p: { id: CharacterId; onClick?: () => void }) {
  const info = CHARACTER_INFO[p.id];
  return (
    <motion.div className="char-card" whileHover={p.onClick ? { y: -4 } : undefined}>
      <div className="face">{CHARACTER_FACE[p.id]}</div>
      <div className="cname">{info.name}</div>
      <div className="hearts" aria-label={`체력 ${info.maxHp}`}>
        {Array.from({ length: info.maxHp }, (_, i) => (
          <span key={i} className="heart">♥</span>
        ))}
      </div>
      <div className="ctext">{info.text}</div>
      {p.onClick && (
        <button type="button" className="pick" aria-label={`${info.name} 고르기`} onClick={p.onClick}>
          고르기
        </button>
      )}
    </motion.div>
  );
}

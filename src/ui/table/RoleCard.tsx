import { motion } from 'framer-motion';
import type { Role } from '../../engine/types';
import { roleName } from '../format';

export const ROLE_GOAL: Record<Role, string> = {
  captain: '반란 선원과 첩자를 모두 쓰러뜨리세요',
  loyalist: '선장을 지켜 반란 선원과 첩자를 쓰러뜨리세요',
  rebel: '선장을 쓰러뜨리세요',
  spy: '마지막까지 혼자 살아남으세요',
};

const ROLE_EMOJI: Record<Role, string> = { captain: '👑', loyalist: '⚓', rebel: '🏴‍☠️', spy: '🎭' };

/** revealed가 false→true가 되면 Y축으로 뒤집히며 앞면이 나타난다. sm은 게임판 내 자리 옆에 두는 작은 크기 */
export function RoleCard(p: { role: Role | null; revealed: boolean; size?: 'sm'; label?: string }) {
  const sm = p.size === 'sm' ? ' sm' : '';
  if (!p.revealed || !p.role) {
    return (
      <div className={`role-card hidden${sm}`} aria-label="가려진 역할 카드">
        <div className="pcard back md" />
      </div>
    );
  }
  return (
    <motion.div
      key="front"
      className={`role-card front ${p.role}${sm}`}
      aria-label={p.label}
      initial={{ rotateY: 90 }}
      animate={{ rotateY: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="remoji">{ROLE_EMOJI[p.role]}</div>
      <div className="rname">{roleName(p.role)}</div>
      <div className="rgoal">{ROLE_GOAL[p.role]}</div>
    </motion.div>
  );
}

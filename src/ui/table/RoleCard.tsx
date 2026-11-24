import { motion } from 'framer-motion';
import type { Role, Special } from '../../engine/types';
import { roleLabel } from '../format';

export const ROLE_GOAL: Record<Role, string> = {
  captain: '반란 선원과 첩자를 모두 쓰러뜨리세요',
  loyalist: '선장을 지켜 반란 선원과 첩자를 쓰러뜨리세요',
  rebel: '선장을 쓰러뜨리세요',
  spy: '마지막까지 혼자 살아남으세요',
  hunter: '표적을 직접 쓰러뜨리고 끝까지 살아남으면, 어느 편이 이기든 함께 이겨요',
};

/** 8~9인 확장: 항해사·이중 첩자의 목표 */
export const SPECIAL_GOAL: Record<Special, string> = {
  navigator: '선장을 지켜 반란 선원과 첩자를 쓰러뜨리세요. 반란 선원 1명의 정체를 알고 시작해요',
  doubleAgent: '선장을 쓰러뜨리세요. 앵무새 고자질로 들켜도 충성 선원으로 보여요',
};

const ROLE_EMOJI: Record<Role, string> = { captain: '👑', loyalist: '⚓', rebel: '🏴‍☠️', spy: '🕵️', hunter: '💰' };
const SPECIAL_EMOJI: Record<Special, string> = { navigator: '🧭', doubleAgent: '🎭' };

/** revealed가 false→true가 되면 Y축으로 뒤집히며 앞면이 나타난다. sm은 게임판 내 자리 옆에 두는 작은 크기 */
export function RoleCard(p: { role: Role | null; revealed: boolean; size?: 'sm'; label?: string; special?: Special | null; note?: string }) {
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
      className={`role-card front ${p.role}${p.special ? ` ${p.special}` : ''}${sm}`}
      aria-label={p.label}
      initial={{ rotateY: 90 }}
      animate={{ rotateY: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="remoji">{p.special ? SPECIAL_EMOJI[p.special] : ROLE_EMOJI[p.role]}</div>
      <div className="rname">{roleLabel(p.role, p.special)}</div>
      <div className="rgoal">{p.special ? SPECIAL_GOAL[p.special] : ROLE_GOAL[p.role]}</div>
      {p.note && <div className="rnote">{p.note}</div>}
    </motion.div>
  );
}

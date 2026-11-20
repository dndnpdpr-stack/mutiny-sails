import { useState } from 'react';
import { CHARACTER_INFO } from '../../engine/characters/roster';
import type { CharacterId } from '../../engine/types';
import { CHARACTER_FACE, PORTRAITS } from '../art/portraits';

/**
 * 캐릭터 초상화. card = 세로 상반신, face = 같은 그림을 원형으로 얼굴만.
 * 그림이 없거나 불러오지 못하면 이모지로 대신한다.
 */
export function Portrait(p: { id: CharacterId | null; variant: 'card' | 'face'; portraits?: Partial<Record<CharacterId, string>> }) {
  const src = p.id ? (p.portraits ?? PORTRAITS)[p.id] : undefined;
  const [failed, setFailed] = useState<string | null>(null);
  if (!p.id) return <span className={`portrait-emoji ${p.variant}`}>❔</span>;
  if (!src || failed === src) return <span className={`portrait-emoji ${p.variant}`}>{CHARACTER_FACE[p.id]}</span>;
  return <img className={`portrait ${p.variant}`} src={src} alt={CHARACTER_INFO[p.id].name} draggable={false} onError={() => setFailed(src)} />;
}

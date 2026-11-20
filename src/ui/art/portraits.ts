import type { CharacterId } from '../../engine/types';
/*
 * 캐릭터 그림 등록표.
 * 그림을 바꾸려면 ./portraits/{id}.svg 파일을 새 그림으로 덮어쓰거나,
 * PNG 등 다른 파일을 쓰려면 아래 import 한 줄의 경로만 바꾸면 된다.
 * 그림 비율은 세로 166:200, 얼굴이 위쪽 2/3 안에 오게 그리면 원형 얼굴로도 잘 잘린다.
 */
import tom from './portraits/tom.svg';
import margo from './portraits/margo.svg';
import lou from './portraits/lou.svg';
import derrick from './portraits/derrick.svg';
import orso from './portraits/orso.svg';
import nico from './portraits/nico.svg';
import hanna from './portraits/hanna.svg';
import sila from './portraits/sila.svg';
import bibi from './portraits/bibi.svg';
import bruno from './portraits/bruno.svg';

export const PORTRAITS: Partial<Record<CharacterId, string>> = { tom, margo, lou, derrick, orso, nico, hanna, sila, bibi, bruno };

/** 그림이 없을 때 대신 보여줄 이모지 */
export const CHARACTER_FACE: Record<CharacterId, string> = {
  tom: '👨‍🍳',
  margo: '🦜',
  lou: '🧔',
  derrick: '💣',
  orso: '⚓',
  nico: '🪙',
  hanna: '👩',
  sila: '🔭',
  bibi: '🧨',
  bruno: '💪',
};

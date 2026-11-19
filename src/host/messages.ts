import type { Action, PlayerView } from '../engine/types';

export type ClientMessage = { type: 'hello'; seatToken: string } | { type: 'action'; action: Action };
export type ServerMessage = { type: 'view'; view: PlayerView } | { type: 'rejected'; reason: string };

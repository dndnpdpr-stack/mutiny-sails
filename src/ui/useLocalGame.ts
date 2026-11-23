import { useCallback, useEffect, useRef, useState } from 'react';
import { AiPlayer } from '../ai/AiPlayer';
import { Game } from '../engine/Game';
import type { Action, PlayerView } from '../engine/types';
import { HostSession } from '../host/HostSession';
import type { ClientMessage, ServerMessage } from '../host/messages';
import { createLocalPair } from '../net/LocalTransport';
import type { Transport } from '../net/Transport';

export interface LocalSetup {
  playerCount: number;
  myName: string;
  seed?: number;
  /** 기본 700 */
  aiDelayMs?: number;
  /** 바다 이벤트 사용 (기본 켜짐) */
  seaEvents?: boolean;
  /** 확장 카드 사용 (기본 켜짐) */
  expansionCards?: boolean;
}

const NICKNAMES = ['붉은수염', '애꾸눈 잭', '검은 메리', '폭풍의 핀', '소금 샐리', '철갈고리', '바다쥐 로코', '황금이빨', '안개 속 아나', '녹슨 닻 칼'];

export function useLocalGame(setup: LocalSetup | null) {
  const [view, setView] = useState<PlayerView | null>(null);
  const [lastRejection, setLastRejection] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const client = useRef<Transport<ServerMessage, ClientMessage> | null>(null);

  useEffect(() => {
    if (!setup) {
      setView(null);
      return;
    }
    const seed = setup.seed ?? Math.floor(Math.random() * 1e9);
    const n = setup.playerCount;
    const mySeat = Math.abs(seed * 31 + 7) % n;
    const pool = [...NICKNAMES].sort(() => 0.5 - Math.random());
    let k = 0;
    const names = Array.from({ length: n }, (_, i) => (i === mySeat ? setup.myName || '나' : pool[k++ % pool.length]));
    const game = new Game({ seed, names, firstRoleDrawer: mySeat, seaEvents: setup.seaEvents ?? true, expansionCards: setup.expansionCards ?? true });
    const session = new HostSession(game, { timeouts: null });
    const ais: AiPlayer[] = [];
    for (let s = 0; s < n; s++) {
      const [host, remote] = createLocalPair<ServerMessage, ClientMessage>();
      session.attach(s, { kind: s === mySeat ? 'human' : 'ai', transport: host });
      if (s === mySeat) {
        client.current = remote;
        remote.onMessage((m) => {
          if (m.type === 'view') setView(m.view);
          else setLastRejection(m.reason);
        });
      } else {
        ais.push(new AiPlayer(remote, { delayMs: setup.aiDelayMs ?? 700, seed: seed + s }));
      }
    }
    return () => {
      ais.forEach((a) => a.dispose());
      session.dispose();
      client.current = null;
    };
  }, [setup, round]);

  useEffect(() => {
    if (!lastRejection) return;
    const t = setTimeout(() => setLastRejection(null), 2000);
    return () => clearTimeout(t);
  }, [lastRejection]);

  const send = useCallback((action: Action) => client.current?.send({ type: 'action', action }), []);
  const restart = useCallback(() => {
    setView(null);
    setRound((r) => r + 1);
  }, []);

  return { view, lastRejection, send, restart };
}

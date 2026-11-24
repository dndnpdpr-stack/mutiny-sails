import { useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import './theme.css';
import { useAnimatedView } from './anim/useAnimatedView';
import { DraftScreen } from './screens/DraftScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SetupScreen } from './screens/SetupScreen';
import { TableScreen } from './screens/TableScreen';
import { useLocalGame, type LocalSetup } from './useLocalGame';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function App({ defaults }: { defaults?: Partial<LocalSetup> & { animations?: boolean } }) {
  const [setup, setSetup] = useState<LocalSetup | null>(null);
  const [reducedMotion] = useState(prefersReducedMotion);
  const { view, lastRejection, send, restart, fast, setFast } = useLocalGame(setup);
  const { animations = true, ...localDefaults } = defaults ?? {};
  const { shown, effects, speed, batchKey } = useAnimatedView(view, { enabled: animations && !reducedMotion && !fast });

  const newGame = () => (setSetup(null), restart());

  let body: ReactNode;
  if (!setup) {
    body = <SetupScreen onStart={(playerCount, myName, options) => setSetup({ ...localDefaults, playerCount, myName, ...options })} />;
  } else if (shown?.winner) {
    body = <ResultScreen view={shown} onRestart={newGame} />;
  } else if (view && view.seats.some((s) => s.character === null)) {
    // 뽑기는 최신 view 기준 (shown을 기다리지 않는다)
    body = <DraftScreen view={view} send={send} />;
  } else if (!view || !shown) {
    body = <div className="table-bg screen-center">항해 준비 중…</div>;
  } else {
    body = (
      <TableScreen
        latest={view}
        shown={shown}
        effects={effects}
        speed={speed}
        batchKey={batchKey}
        send={send}
        lastRejection={lastRejection}
        spectate={{ fast, onToggleFast: () => setFast(!fast), onRestart: newGame }}
      />
    );
  }
  return <MotionConfig reducedMotion="user">{body}</MotionConfig>;
}

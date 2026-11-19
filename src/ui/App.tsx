import { useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import './styles.css';
import './theme.css';
import { GameScreen } from './GameScreen';
import { DraftScreen } from './screens/DraftScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SetupScreen } from './screens/SetupScreen';
import { useLocalGame, type LocalSetup } from './useLocalGame';

export function App({ defaults }: { defaults?: Partial<LocalSetup> & { animations?: boolean } }) {
  const [setup, setSetup] = useState<LocalSetup | null>(null);
  const { view, lastRejection, send, restart } = useLocalGame(setup);
  const { animations = true, ...localDefaults } = defaults ?? {};
  void animations; // Task 7 passes this to useAnimatedView

  let body: ReactNode;
  if (!setup) {
    body = <SetupScreen onStart={(playerCount, myName) => setSetup({ ...localDefaults, playerCount, myName })} />;
  } else if (!view) {
    body = <div className="table-bg screen-center">항해 준비 중…</div>;
  } else if (view.winner) {
    body = <ResultScreen view={view} onRestart={() => (setSetup(null), restart())} />;
  } else if (view.seats.some((s) => s.character === null)) {
    body = <DraftScreen view={view} send={send} />;
  } else {
    body = <GameScreen view={view} send={send} lastRejection={lastRejection} />;
  }
  return <MotionConfig reducedMotion="user">{body}</MotionConfig>;
}

import { useState } from 'react';
import './styles.css';
import { GameScreen } from './GameScreen';
import { ResultScreen } from './ResultScreen';
import { SetupScreen } from './SetupScreen';
import { useLocalGame, type LocalSetup } from './useLocalGame';

export function App({ defaults }: { defaults?: Partial<LocalSetup> }) {
  const [setup, setSetup] = useState<LocalSetup | null>(null);
  const { view, lastRejection, send, restart } = useLocalGame(setup);

  if (!setup) {
    return <SetupScreen onStart={(playerCount, myName) => setSetup({ ...defaults, playerCount, myName })} />;
  }
  if (!view) return <div className="setup">항해 준비 중…</div>;
  if (view.winner) return <ResultScreen view={view} onRestart={() => (setSetup(null), restart())} />;
  return <GameScreen view={view} send={send} lastRejection={lastRejection} />;
}

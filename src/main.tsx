import './ui/styles.css';
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { controller } from './ui/controller';
import { MenuScreen } from './ui/MenuScreen';
import { GameScreen } from './ui/GameScreen';

function App() {
  useSyncExternalStore(controller.subscribe, controller.getVersion);
  const state = controller.state;
  return state ? <GameScreen key={controller.session} state={state} /> : <MenuScreen />;
}

createRoot(document.getElementById('root')!).render(<App />);

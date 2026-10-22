import './ui/styles.css';
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { controller } from './ui/controller';
import { MenuScreen } from './ui/MenuScreen';
import { GameScreen } from './ui/GameScreen';
import { usePauseWhilePortrait, usePortrait, useKeyboardInset } from './ui/layout/viewport';
import { Icon } from './ui/icons';

function RotateOverlay() {
  return (
    <div className="rotate" role="alertdialog" aria-labelledby="rotate-title" data-testid="rotate">
      <div className="rotate-icon"><Icon name="rotate" size={56} /></div>
      <h2 id="rotate-title">Gira tu iPhone</h2>
      <p>Simulador de Presidente se juega en horizontal. {controller.state ? 'Tu partida está en pausa y sigue intacta.' : ''}</p>
    </div>
  );
}

function App() {
  useSyncExternalStore(controller.subscribe, controller.getVersion);
  const portrait = usePortrait();
  usePauseWhilePortrait(portrait && !!controller.state);
  useKeyboardInset();
  const state = controller.state;
  return (
    <>
      <div className="app" aria-hidden={portrait || undefined}>
        {state ? <GameScreen key={controller.session} state={state} /> : <MenuScreen />}
      </div>
      {portrait && <RotateOverlay />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

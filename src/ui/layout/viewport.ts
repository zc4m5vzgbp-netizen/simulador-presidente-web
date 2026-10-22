/**
 * Orientación y teclado.
 *
 * Safari en iPhone NO permite bloquear la orientación desde una web: el
 * método screen.orientation.lock() solo funciona en algunos navegadores y en
 * pantalla completa. Se intenta de forma silenciosa y, si no está disponible,
 * se muestra un aviso para girar el dispositivo cuando está en vertical.
 */
import { useEffect, useState } from 'react';
import { controller } from '../controller';
import type { SpeedId } from '../../engine/time';

const PORTRAIT = '(orientation: portrait)';

export function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(() => typeof window !== 'undefined' && window.matchMedia(PORTRAIT).matches);
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT);
    const on = () => setPortrait(mq.matches);
    on();
    mq.addEventListener('change', on);
    window.addEventListener('resize', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);
  return portrait;
}

/** Pausa la simulación mientras el aviso de giro está visible y la reanuda después. */
export function usePauseWhilePortrait(portrait: boolean): void {
  useEffect(() => {
    if (!portrait) return;
    const prev: SpeedId = controller.clock.speed;
    if (prev !== 0) controller.setSpeed(0);
    return () => { if (prev !== 0 && controller.state && !controller.state.gameOver) controller.setSpeed(prev); };
  }, [portrait]);
}

export function tryLockLandscape(): void {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    o?.lock?.('landscape').catch(() => { /* no soportado (p. ej. Safari iOS) */ });
  } catch { /* no soportado */ }
}

/**
 * Cuando aparece el teclado, iOS reduce la ventana visible. Se expone la
 * altura ocupada en la variable CSS --kb para que la interfaz se encoja y el
 * campo enfocado se desplace a la vista.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--kb', kb > 60 ? `${Math.round(kb)}px` : '0px');
    };
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    document.addEventListener('focusin', onFocus);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);
}

import { freeze, isValidGame } from './engine/engine';
import { GameState, Settings } from './engine/types';

const K = {
  game: 'mk.game.v2',
  prefs: 'mk.prefs.v1',
  settings: 'mk.settings.v1',
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  const g = read<unknown>(K.game);
  return isValidGame(g) ? g : null;
}
export function saveGame(g: GameState | null): boolean {
  if (!g) {
    try { localStorage.removeItem(K.game); } catch { /* تجاهل */ }
    return true;
  }
  const now = Date.now();
  return write(K.game, { ...freeze(g, now), history: g.history.map((h) => freeze(h, now)) });
}

export interface Prefs { muted: boolean; projector: boolean }
export const loadPrefs = (): Prefs => ({ muted: false, projector: false, ...(read<Prefs>(K.prefs) ?? {}) });
export const savePrefs = (p: Prefs) => write(K.prefs, p);

export const loadSettings = () => read<Settings>(K.settings);
export const saveSettings = (s: Settings) => write(K.settings, s);

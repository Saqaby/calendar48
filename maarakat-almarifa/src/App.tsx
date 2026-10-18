import { useCallback, useEffect, useRef, useState } from 'react';
import { createGame, reducer } from './engine/engine';
import { Action, GameState, Settings } from './engine/types';
import { loadGame, loadPrefs, loadSettings, saveGame, savePrefs, saveSettings } from './storage';
import { play, setMuted, unlockAudio } from './audio';
import { ConfirmDialog, ConfirmRequest, Credit, Icon } from './ui/common';
import { Home } from './ui/Home';
import { Setup } from './ui/Setup';
import { GameScreen } from './ui/GameScreen';
import { Rules } from './ui/Rules';

export type Screen = 'home' | 'setup' | 'game' | 'rules';

export interface AppApi {
  go: (s: Screen) => void;
  confirm: (r: ConfirmRequest) => void;
  game: GameState | null;
  dispatch: (a: Action) => void;
  startGame: (s: Settings) => void;
  clearGame: () => void;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;

  /* الحفظ التلقائي بعد كل إجراء، وكل ثانية أثناء تشغيل المؤقّت، وعند مغادرة الصفحة */
  useEffect(() => { setSaveFailed(!saveGame(game)); }, [game]);
  useEffect(() => {
    const flush = () => saveGame(gameRef.current);
    const id = window.setInterval(() => {
      const g = gameRef.current;
      if (g && (g.turn?.timer?.endsAt != null || g.clock.runningSince != null)) flush();
    }, 1000);
    window.addEventListener('pagehide', flush);
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearInterval(id); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); };
  }, []);

  useEffect(() => {
    savePrefs(prefs);
    setMuted(prefs.muted);
    document.documentElement.classList.toggle('projector', prefs.projector);
  }, [prefs]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const fs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fs);
    return () => document.removeEventListener('fullscreenchange', fs);
  }, []);

  const dispatch = useCallback((a: Action) => setGame((g) => (g ? reducer(g, a) : g)), []);

  const api: AppApi = {
    go: (s) => { setScreen(s); window.scrollTo(0, 0); },
    confirm: setConfirmReq,
    game,
    dispatch,
    startGame: (s) => { saveSettings(s); setGame(createGame(s, Date.now())); setScreen('game'); play('turn'); },
    clearGame: () => setGame(null),
  };

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className={`app screen-${screen}`}>
      <div className="backdrop" aria-hidden="true">
        <div className="grid" />
        <div className="topo" />
        <div className="radar" />
      </div>

      <div className="global-tools" role="toolbar" aria-label="أدوات العرض">
        <button className={`icon-btn ${prefs.muted ? 'on-danger' : ''}`} onClick={() => setPrefs({ ...prefs, muted: !prefs.muted })}
          aria-pressed={prefs.muted} title={prefs.muted ? 'تشغيل الصوت' : 'كتم الصوت'}>
          <Icon name={prefs.muted ? 'soundOff' : 'soundOn'} />
          <span className="tool-label">{prefs.muted ? 'الصوت مكتوم' : 'كتم'}</span>
        </button>
        <button className={`icon-btn ${prefs.projector ? 'on' : ''}`} onClick={() => setPrefs({ ...prefs, projector: !prefs.projector })}
          aria-pressed={prefs.projector} title="وضع البروجكتر: خط أكبر وتباين أعلى">
          <Icon name="projector" /><span className="tool-label">بروجكتر</span>
        </button>
        <button className={`icon-btn ${isFull ? 'on' : ''}`} onClick={toggleFull} title="ملء الشاشة">
          <Icon name="fullscreen" /><span className="tool-label">{isFull ? 'خروج' : 'ملء الشاشة'}</span>
        </button>
      </div>

      {saveFailed && <div className="save-warning" role="alert">تعذّر الحفظ المحلي في هذا المتصفح (قد يكون في وضع التصفح الخاص). ستعمل المباراة لكنها لن تُستعاد بعد التحديث.</div>}

      {screen === 'home' && <Home api={api} />}
      {screen === 'setup' && <Setup api={api} initial={loadSettings()} />}
      {screen === 'game' && game && <GameScreen api={api} game={game} />}
      {screen === 'game' && !game && <Home api={api} />}
      {screen === 'rules' && <Rules api={api} />}

      {(screen !== 'game' || !game || game.phase === 'finished') && <Credit />}

      {confirmReq && <ConfirmDialog req={confirmReq} onClose={() => setConfirmReq(null)} />}
    </div>
  );
}

import { CSSProperties, useEffect, useRef, useState } from 'react';
import type { AppApi } from '../App';
import { computeEffect, fmt, timerRemaining } from '../engine/engine';
import { pickQuestion } from '../engine/questions';
import { DIFFICULTY_LABEL, GameState, TeamState } from '../engine/types';
import { play } from '../audio';
import { Delta, Emblem, Icon, useNow } from './common';
import type { Shortage } from './GameScreen';

const MODE_LABEL = { reinforce: 'مهمة تعزيزات', confront: 'مواجهة', refill: 'إعادة التعبئة', tiebreak: 'سؤال فاصل' } as const;

export function QuestionStage({ api, game, paused, onShortage }: {
  api: AppApi; game: GameState; paused: boolean; onShortage: (s: Shortage) => void;
}) {
  const { dispatch } = api;
  const t = game.turn!;
  const team = (id: string | null) => game.teams.find((x) => x.id === id) ?? null;
  const running = !!t.timer && t.timer.endsAt != null;
  const now = useNow(running, 100);
  const remaining = timerRemaining(t.timer, now);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [t.seq]);

  /* انتهاء المؤقّت */
  useEffect(() => {
    if (running && remaining <= 0) dispatch({ type: 'TIMEOUT', now: Date.now() });
  }, [running, remaining, dispatch]);

  /* صوت اقتراب نهاية الوقت: نقرة كل ثانية في آخر ٥ ثوانٍ */
  const lastTick = useRef<number | null>(null);
  const secLeft = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (running && secLeft <= 5 && secLeft > 0 && lastTick.current !== secLeft) {
      lastTick.current = secLeft;
      play('tick');
    }
    if (!running) lastTick.current = null;
  }, [running, secLeft]);

  /* مفتاح المسافة لإيقاف المؤقّت واستئنافه */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement)?.closest('input,textarea,select,button')) return;
      if (!t.timer) return;
      e.preventDefault();
      dispatch({ type: t.timer.endsAt != null ? 'PAUSE_TIMER' : 'RESUME_TIMER', now: Date.now() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t.timer, dispatch]);

  const replace = () => {
    const q = pickQuestion(api.bank, game.usedQuestionIds, t.difficulty);
    if (q) dispatch({ type: 'REPLACE_QUESTION', question: q });
    else onShortage({ difficulty: t.difficulty, allowOther: false });
  };

  const init = team(t.initiatorId);
  const opp = team(t.opponentId);
  const sides: TeamState[] = t.mode === 'tiebreak' ? game.teams.filter((x) => game.tiebreakTeamIds.includes(x.id)) : [init, opp].filter(Boolean) as TeamState[];
  const answering = team(t.answeringTeamId);
  const lastAttempt = t.attempts[t.attempts.length - 1];

  return (
    <div className={`question-stage mode-${t.mode} stage-${t.stage}`}>
      <div className="q-meta">
        <span className={`chip mode-chip mode-${t.mode}`}>{MODE_LABEL[t.mode]}</span>
        <span className={`chip diff-${t.difficulty}`}>{DIFFICULTY_LABEL[t.difficulty]}</span>
        {t.stake > 0 && <span className="chip">{fmt(t.stake)} {t.stake === 20 ? 'جنديًا' : 'جنود'} في المهمة</span>}
        <span className="chip ghost-chip">{t.question.category}</span>
      </div>

      <div className={`q-sides n${sides.length}`}>
        {sides.map((s, i) => (
          <div key={s.id} className="q-side-wrap">
            {i > 0 && t.mode === 'confront' && <span className="vs">ضد</span>}
            <div className={`q-side ${answering?.id === s.id ? 'answering' : ''} ${!t.contenders.includes(s.id) && t.stage !== 'decided' ? 'out' : ''} ${t.stage === 'decided' && t.winnerId === s.id ? 'winner' : ''}`}
              style={{ '--team': s.color } as CSSProperties}>
              <Emblem id={s.emblem} color={s.color} size={48} />
              <div><b>{s.name}</b><small>{fmt(s.soldiers)} جندي{s.id === t.initiatorId && t.mode === 'confront' ? ' · المبادر' : ''}</small></div>
            </div>
          </div>
        ))}
      </div>

      <div className="q-body">
        <p className="q-text">{t.question.text}</p>
        {t.timer && <TimerRing remaining={remaining} duration={t.timer.durationMs} running={running} />}
      </div>

      {t.revealed && (
        <div className="answer-box" role="status">
          <span className="answer-label">الإجابة النموذجية</span>
          <p className="answer-text">{t.question.answer}</p>
          {t.question.explanation && <p className="answer-explain">{t.question.explanation}</p>}
        </div>
      )}

      <div className="presenter" role="group" aria-label="أدوات المقدّم">
        <span className="presenter-label">أدوات المقدّم</span>

        {t.stage === 'reading' && (
          <div className="ctrl-row">
            <p className="ctrl-hint">اقرؤوا السؤال كاملًا أولًا. {t.mode === 'confront' || t.mode === 'tiebreak' ? 'لا يُقبل طلب الإجابة قبل بدء المواجهة.' : ''}</p>
            <button className={`btn xl ${t.mode === 'confront' ? 'danger' : t.mode === 'tiebreak' ? 'gold' : 'primary'}`} disabled={paused}
              onClick={() => dispatch({ type: 'BEGIN', now: Date.now() })}>
              {t.mode === 'confront' ? 'بدء المواجهة' : t.mode === 'tiebreak' ? 'بدء السؤال الفاصل' : `بدء المؤقّت (${fmt(game.settings.answerSeconds)} ث)`}
            </button>
            <button className="btn ghost" onClick={replace}><Icon name="swap" size={18} /> استبدال السؤال</button>
          </div>
        )}

        {t.stage === 'buzz' && (
          <div className="ctrl-row">
            <p className="ctrl-hint">
              {lastAttempt ? `أخطأ ${team(lastAttempt.teamId)?.name}. ` : ''}مَن طلب الإجابة أولًا؟
            </p>
            <div className="buzz-buttons">
              {t.contenders.map((id) => {
                const s = team(id)!;
                return (
                  <button key={id} className="btn buzz" style={{ '--team': s.color } as CSSProperties} disabled={paused}
                    onClick={() => dispatch({ type: 'BUZZ', teamId: id, now: Date.now() })}>
                    <Emblem id={s.emblem} color={s.color} size={34} /> {s.name}
                  </button>
                );
              })}
            </div>
            <div className="ctrl-secondary">
              <TimerToggle t={t} dispatch={dispatch} />
              {t.attempts.length === 0 && t.mode === 'confront' && (
                <button className="btn ghost" onClick={replace}><Icon name="swap" size={18} /> تعذّر تحديد الأسبق — استبدال السؤال</button>
              )}
              <button className="btn ghost danger-text" onClick={() => dispatch({ type: 'NO_BUZZ' })}>لم يُجب أحد</button>
            </div>
          </div>
        )}

        {t.stage === 'answering' && answering && (
          <div className="ctrl-row">
            <p className="ctrl-hint">يجيب الآن: <b style={{ color: answering.color }}>{answering.name}</b>
              {t.mode === 'confront' || t.mode === 'tiebreak' ? ` — ${fmt(Math.round(t.timer!.durationMs / 1000))} ثوانٍ` : ''}</p>
            <div className="judge-buttons">
              <button className="btn success xl" onClick={() => dispatch({ type: 'MARK', result: 'correct', now: Date.now() })}><Icon name="check" /> إجابة صحيحة</button>
              <button className="btn danger xl" onClick={() => dispatch({ type: 'MARK', result: 'wrong', now: Date.now() })}><Icon name="cross" /> إجابة خاطئة</button>
            </div>
            <div className="ctrl-secondary">
              <TimerToggle t={t} dispatch={dispatch} />
              <button className="btn ghost" onClick={() => dispatch({ type: 'MARK', result: 'timeout', now: Date.now() })}>انتهى الوقت</button>
            </div>
          </div>
        )}

        {t.stage === 'decided' && (
          <Decision game={game} dispatch={dispatch} confirming={confirming} onConfirm={() => {
            if (confirming) return;
            setConfirming(true);
            dispatch({ type: 'CONFIRM', seq: t.seq, now: Date.now() });
          }} />
        )}
      </div>
    </div>
  );
}

function TimerToggle({ t, dispatch }: { t: NonNullable<GameState['turn']>; dispatch: AppApi['dispatch'] }) {
  if (!t.timer) return null;
  const running = t.timer.endsAt != null;
  return (
    <button className="btn ghost" onClick={() => dispatch({ type: running ? 'PAUSE_TIMER' : 'RESUME_TIMER', now: Date.now() })}>
      <Icon name={running ? 'pause' : 'play'} size={18} /> {running ? 'إيقاف المؤقّت' : 'استئناف المؤقّت'}
    </button>
  );
}

function TimerRing({ remaining, duration, running }: { remaining: number; duration: number; running: boolean }) {
  const frac = duration > 0 ? remaining / duration : 0;
  const sec = Math.ceil(remaining / 1000);
  const level = sec <= 5 ? 'danger' : frac <= 0.5 ? 'warn' : 'ok';
  const C = 2 * Math.PI * 52;
  return (
    <div className={`timer-ring ${level} ${running ? '' : 'paused'}`} role="timer" aria-label={`الوقت المتبقي ${sec} ثانية`}>
      <svg viewBox="0 0 120 120" width="100%" height="100%">
        <circle cx="60" cy="60" r="52" className="track" />
        <circle cx="60" cy="60" r="52" className="arc" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 60 60)" />
      </svg>
      <span className="timer-num">{fmt(sec)}</span>
      {!running && <span className="timer-paused">متوقف</span>}
    </div>
  );
}

function Decision({ game, dispatch, confirming, onConfirm }: {
  game: GameState; dispatch: AppApi['dispatch']; confirming: boolean; onConfirm: () => void;
}) {
  const t = game.turn!;
  const name = (id: string | null) => game.teams.find((x) => x.id === id)?.name ?? '';
  const effect = computeEffect(t, t.winnerId, game.teams);
  const options: { label: string; winner: string | null }[] =
    t.mode === 'confront' ? [
      { label: `فوز ${name(t.initiatorId)}`, winner: t.initiatorId },
      { label: `فوز ${name(t.opponentId)}`, winner: t.opponentId },
      { label: 'إخفاق الجيشين', winner: null },
    ] : t.mode === 'tiebreak' ? [
      ...game.tiebreakTeamIds.map((id) => ({ label: `فوز ${name(id)}`, winner: id as string | null })),
      { label: 'لا فائز', winner: null },
    ] : [
      { label: 'إجابة صحيحة', winner: t.initiatorId },
      { label: 'إجابة خاطئة', winner: null },
    ];
  const affected = game.teams.filter((x) => effect.deltas[x.id] !== undefined);
  return (
    <div className="decision">
      <div className={`decision-summary ${effect.positive ? 'good' : 'bad'}`}>
        <h3>{effect.title}</h3>
        <ul>{effect.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        {affected.length > 0 && (
          <div className="decision-deltas">
            {affected.map((x) => (
              <span key={x.id} className="dd" style={{ '--team': x.color } as CSSProperties}>
                {x.name}: {fmt(x.soldiers)} ← <b>{fmt(Math.max(0, x.soldiers + effect.deltas[x.id]))}</b> <Delta value={effect.deltas[x.id]} />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="ctrl-row">
        {!t.revealed && <button className="btn gold" onClick={() => dispatch({ type: 'REVEAL' })}><Icon name="eye" size={18} /> عرض الحل</button>}
        <div className="override" role="radiogroup" aria-label="تصحيح التحكيم">
          <span className="muted">تصحيح التحكيم:</span>
          {options.map((o) => (
            <button key={o.label} role="radio" aria-checked={t.winnerId === o.winner}
              className={`seg-btn ${t.winnerId === o.winner ? 'on' : ''}`} onClick={() => dispatch({ type: 'SET_WINNER', winnerId: o.winner })}>{o.label}</button>
          ))}
        </div>
        <button className="btn primary xl" disabled={confirming} onClick={onConfirm}>تأكيد النتيجة</button>
      </div>
    </div>
  );
}


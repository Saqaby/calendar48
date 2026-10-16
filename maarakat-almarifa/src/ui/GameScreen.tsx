import { CSSProperties, useEffect, useRef, useState } from 'react';
import type { AppApi } from '../App';
import {
  allowedOpponents, allowedStakes, clockElapsed, computeEffect, currentTeam, fmt, ranking,
} from '../engine/engine';
import {
  DIFFICULTY_LABEL, GameState, REFILL_SOLDIERS, Stake, STAKE_DIFFICULTY, STAKES, TeamState,
} from '../engine/types';
import { play } from '../audio';
import { Delta, Emblem, formatClock, Icon, useNow } from './common';
import { QuestionStage } from './QuestionStage';
import { Victory } from './Victory';

export function GameScreen({ api, game }: { api: AppApi; game: GameState }) {
  const { dispatch } = api;
  const timeMode = game.settings.endMode === 'time';
  const paused = game.clock.runningSince == null && game.phase !== 'finished';
  const now = useNow(!paused && game.phase !== 'finished', 500);

  /* فحص انتهاء وقت المباراة */
  useEffect(() => {
    if (timeMode && !game.endgame && !paused) dispatch({ type: 'CLOCK_CHECK', now });
  }, [now, timeMode, game.endgame, paused, dispatch]);

  /* المؤثرات الصوتية عند تغيّر الحالة (دون تشغيلها عند الاستعادة) */
  const turnKey = `${game.round}-${game.currentIndex}-${game.phase === 'choose_action'}`;
  const prevTurnKey = useRef(turnKey);
  const prevFlash = useRef(game.flash?.seq ?? 0);
  const [flash, setFlash] = useState<GameState['flash']>(null);
  useEffect(() => {
    if (game.flash && game.flash.seq !== prevFlash.current) {
      prevFlash.current = game.flash.seq;
      setFlash(game.flash);
      play(game.flash.positive ? 'correct' : 'wrong');
      const id = window.setTimeout(() => setFlash(null), 2600);
      return () => window.clearTimeout(id);
    }
    if (!game.flash) setFlash(null);
  }, [game.flash]);
  useEffect(() => {
    if (turnKey !== prevTurnKey.current) {
      prevTurnKey.current = turnKey;
      if (game.phase === 'choose_action') {
        const id = window.setTimeout(() => play('turn'), game.flash ? 1300 : 0);
        return () => window.clearTimeout(id);
      }
    }
  }, [turnKey, game.phase, game.flash]);

  const undo = () => api.confirm({
    title: 'تراجع عن آخر نتيجة؟',
    message: 'ستعود الأرصدة والدور وسجل الأحداث وحالة السؤال إلى ما كانت عليه قبل تأكيد آخر نتيجة. أي دور بدأ بعدها سيُلغى.',
    confirmLabel: 'تراجع',
    onConfirm: () => dispatch({ type: 'UNDO' }),
  });
  const endNow = () => api.confirm({
    title: 'إنهاء المباراة الآن؟',
    message: 'سيُعلن الفائز وفق الأرصدة الحالية (مع أسئلة فاصلة عند التعادل). يمكن التراجع عن ذلك لاحقًا.',
    confirmLabel: 'إنهاء المباراة', tone: 'danger',
    onConfirm: () => dispatch({ type: 'END_NOW', now: Date.now() }),
  });
  const resume = () => {
    const t = Date.now();
    dispatch({ type: 'CLOCK_RESUME', now: t });
    dispatch({ type: 'RESUME_TIMER', now: t });
  };
  const pauseAll = () => {
    const t = Date.now();
    dispatch({ type: 'CLOCK_PAUSE', now: t });
    dispatch({ type: 'PAUSE_TIMER', now: t });
  };

  if (game.phase === 'finished') return <Victory api={api} game={game} />;

  const elapsed = clockElapsed(game.clock, now);
  const limit = game.settings.matchMinutes * 60_000;

  return (
    <main className="game">
      <header className="topbar">
        <div className="brand-mini"><Emblem id="shield" color="#ffc233" size={38} /><span>معركة المعرفة</span></div>
        <div className="topbar-status">
          <span className="chip round">الجولة {fmt(game.round)}</span>
          {game.endgame && <span className="chip alert">الجولة الأخيرة</span>}
          {timeMode ? (
            <span className={`chip clock ${limit - elapsed < 60_000 ? 'warn' : ''}`} title="الوقت المتبقي للمباراة">
              <Icon name="clock" size={18} /> {formatClock(limit - elapsed)}
            </span>
          ) : (
            <span className="chip ghost-chip">الهدف: {fmt(game.settings.winTarget)} جندي</span>
          )}
        </div>
        <div className="topbar-tools">
          {paused
            ? <button className="btn sm primary" onClick={resume}><Icon name="play" size={18} /> استئناف</button>
            : <button className="btn sm ghost" onClick={pauseAll} title="إيقاف مؤقت للمباراة"><Icon name="pause" size={18} /> إيقاف مؤقت</button>}
          <button className="btn sm ghost" onClick={undo} disabled={game.history.length === 0}><Icon name="undo" size={18} /> تراجع عن آخر نتيجة</button>
          <button className="btn sm ghost danger-text" onClick={endNow}><Icon name="flag" size={18} /> إنهاء</button>
          <button className="btn sm ghost" onClick={() => api.go('home')} title="الرئيسية (المباراة محفوظة)"><Icon name="home" size={18} /></button>
        </div>
      </header>

      {paused && (
        <div className="paused-banner" role="status">
          <b>المباراة متوقفة مؤقتًا.</b> الأرصدة والدور محفوظة{game.turn?.timer ? '، ومؤقّت السؤال متوقف' : ''}.
          <button className="btn sm primary" onClick={resume}>استئناف المباراة</button>
        </div>
      )}

      <div className={`board ${game.phase === 'choose_action' || game.phase === 'tiebreak' ? '' : 'focus'}`}>
        <section className="armies" aria-label="الجيوش">
          <Armies game={game} flash={flash} />
        </section>

        <section className="command" aria-live="polite">
          {game.phase === 'question' && game.turn ? (
            <QuestionStage api={api} game={game} paused={paused} />
          ) : game.phase === 'tiebreak' ? (
            <TiebreakPanel game={game} onStart={() => dispatch({ type: 'START_TIEBREAK', now: Date.now() })} />
          ) : (
            <TurnPanel api={api} game={game} />
          )}
        </section>

        <aside className="log panel" aria-label="سجل الأحداث">
          <h2>سجل المعركة</h2>
          <ol>
            {[...game.log].reverse().slice(0, 40).map((e) => (
              <li key={e.id} className={`log-${e.kind}`}>
                <span className="log-round">ج{fmt(e.round)}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {flash && <FlashOverlay flash={flash} teams={game.teams} onClose={() => setFlash(null)} />}
    </main>
  );
}

/* ---------------- بطاقات الجيوش ---------------- */

function Armies({ game, flash }: { game: GameState; flash: GameState['flash'] }) {
  const ranks = ranking(game.teams);
  const rankOf = (id: string) => {
    const t = game.teams.find((x) => x.id === id)!;
    return ranks.findIndex((x) => x.soldiers === t.soldiers) + 1;
  };
  const target = game.settings.endMode === 'target' ? game.settings.winTarget : Math.max(...game.teams.map((t) => t.soldiers), 1);
  const activeId = game.phase === 'tiebreak' ? null : currentTeam(game).id;
  const t = game.turn;
  const involved = new Set(t ? [t.initiatorId, t.opponentId, ...(t.mode === 'tiebreak' ? t.contenders : [])].filter(Boolean) as string[] : game.phase === 'tiebreak' ? game.tiebreakTeamIds : []);
  return (
    <div className={`army-grid n${game.teams.length}`}>
      {game.teams.map((team) => (
        <TeamCard key={team.id} team={team} rank={rankOf(team.id)} target={target}
          active={team.id === activeId} involved={involved.has(team.id)} answering={t?.answeringTeamId === team.id}
          delta={flash?.deltas[team.id]} showTarget={game.settings.endMode === 'target'} />
      ))}
    </div>
  );
}

function TeamCard({ team, rank, target, active, involved, answering, delta, showTarget }: {
  team: TeamState; rank: number; target: number; active: boolean; involved: boolean; answering: boolean;
  delta: number | undefined; showTarget: boolean;
}) {
  const pct = Math.min(100, (team.soldiers / target) * 100);
  return (
    <article className={`team-card ${active ? 'active' : ''} ${involved ? 'involved' : ''} ${answering ? 'answering' : ''} ${team.soldiers === 0 ? 'zero' : ''}`}
      style={{ '--team': team.color } as CSSProperties} aria-current={active ? 'true' : undefined}>
      <div className="card-top">
        <span className={`rank r${rank}`} title="الترتيب">#{fmt(rank)}</span>
        {active && <span className="turn-tag">صاحب الدور</span>}
        {answering && <span className="turn-tag answer-tag">يجيب الآن</span>}
      </div>
      <div className="card-main">
        <Emblem id={team.emblem} color={team.color} size={active ? 70 : 58} />
        <div className="card-id">
          <h3>{team.name}</h3>
          <div className="soldiers"><span className="num">{fmt(team.soldiers)}</span><span className="unit">جندي</span></div>
        </div>
      </div>
      <Units soldiers={team.soldiers} />
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={team.soldiers}
        aria-label={showTarget ? 'التقدّم نحو رصيد الفوز' : 'مقارنة بالأعلى'}>
        <div className="bar" style={{ width: `${pct}%` }} />
        {showTarget && <span className="progress-label">{fmt(Math.round(pct))}٪</span>}
      </div>
      {team.soldiers === 0 && <div className="status-note">بحاجة إلى إعادة التعبئة</div>}
      {delta !== undefined && delta !== 0 && <div key={delta} className={`delta-pop ${delta > 0 ? 'up' : 'down'}`}><Delta value={delta} /></div>}
    </article>
  );
}

/** كل وحدة = ١٠ جنود، ونصف وحدة = ٥، بحد أقصى ٢٠ وحدة */
function Units({ soldiers }: { soldiers: number }) {
  const full = Math.floor(soldiers / 10);
  const half = soldiers % 10 >= 5 ? 1 : 0;
  const shown = Math.min(full, 20);
  return (
    <div className="units" aria-hidden="true" title="كل رمز = ١٠ جنود">
      {Array.from({ length: shown }, (_, i) => <span key={i} className="unit-token" />)}
      {full <= 20 && half > 0 && <span className="unit-token half" />}
      {full > 20 && <span className="units-more">+{fmt((full - 20) * 10)}</span>}
      {soldiers === 0 && <span className="units-empty">لا جنود في الميدان</span>}
    </div>
  );
}

/* ---------------- لوحة الدور ---------------- */

function TurnPanel({ api, game }: { api: AppApi; game: GameState }) {
  const { dispatch } = api;
  const team = currentTeam(game);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [stake, setStake] = useState<Stake | null>(null);
  useEffect(() => { setOpponentId(null); setStake(null); }, [game.phase, game.pendingMode, game.currentIndex, game.round]);

  const style = { '--team': team.color } as CSSProperties;
  const header = (
    <div className="turn-head" key={`${game.round}-${game.currentIndex}`}>
      <p className="eyebrow">حان دور جيشكم</p>
      <div className="turn-team">
        <Emblem id={team.emblem} color={team.color} size={96} />
        <div>
          <h2 className="turn-name">{team.name}</h2>
          <p className="turn-soldiers"><span className="num">{fmt(team.soldiers)}</span> جندي في الميدان</p>
        </div>
      </div>
      {game.endgame && <p className="endgame-note">{game.endgame.reason === 'time' ? 'انتهى وقت المباراة' : 'بلغ جيشٌ رصيد الفوز'} — تُستكمل الجولة الحالية ثم يُعلن الفائز.</p>}
    </div>
  );

  if (game.phase === 'choose_action' && team.soldiers === 0) {
    return (
      <div className="turn-panel" style={style}>
        {header}
        <div className="refill-card">
          <h3>إعادة التعبئة</h3>
          <p>سؤال سهل: الإجابة الصحيحة تعيدكم إلى الميدان بـ{fmt(REFILL_SOLDIERS)} جنود، والخاطئة تنتظرون بعدها دوركم التالي.</p>
          <button className="btn primary xl" onClick={() => dispatch({ type: 'START_REFILL', now: Date.now() })}>
            طرح سؤال إعادة التعبئة
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === 'choose_action') {
    return (
      <div className="turn-panel" style={style}>
        {header}
        <div className="main-actions">
          <button className="btn action reinforce" onClick={() => dispatch({ type: 'CHOOSE_MODE', mode: 'reinforce' })}>
            <span className="action-title">طلب تعزيزات</span>
            <span className="action-sub">أجيبوا وحدكم واكسبوا جنودًا</span>
          </button>
          <button className="btn action confront" onClick={() => dispatch({ type: 'CHOOSE_MODE', mode: 'confront' })}>
            <span className="action-title">شنّ هجوم</span>
            <span className="action-sub">خذوا أسرى من جيش منافس</span>
          </button>
        </div>
      </div>
    );
  }

  const mode = game.pendingMode!;
  const stakes = allowedStakes(team.soldiers);
  const opps = allowedOpponents(game, team.id);
  const opponent = game.teams.find((t) => t.id === opponentId) ?? null;

  const begin = (s: Stake) => {
    dispatch({ type: 'START_TURN', stake: s, opponentId: mode === 'confront' ? opponentId! : undefined, now: Date.now() });
    if (mode === 'confront') play('confront');
  };

  return (
    <div className={`turn-panel mode-${mode}`} style={style}>
      <div className="mission-head">
        <button className="btn ghost sm" onClick={() => dispatch({ type: 'BACK_TO_ACTION' })}>رجوع</button>
        <h2>{mode === 'reinforce' ? 'طلب تعزيزات' : 'شنّ هجوم'} — {team.name}</h2>
        <span className="chip">{fmt(team.soldiers)} جندي</span>
      </div>

      {mode === 'confront' && (
        <div className="step">
          <h3><span className="step-num">١</span> اختاروا الجيش الذي ستهاجمونه</h3>
          <div className="opponents">
            {game.teams.filter((t) => t.id !== team.id).map((t) => {
              const ok = opps.includes(t.id);
              return (
                <button key={t.id} className={`opp-btn ${opponentId === t.id ? 'on' : ''}`} disabled={!ok}
                  style={{ '--team': t.color } as CSSProperties} onClick={() => setOpponentId(t.id)} aria-pressed={opponentId === t.id}>
                  <Emblem id={t.emblem} color={t.color} size={44} />
                  <span className="opp-name">{t.name}</span>
                  <span className="opp-sub">{ok ? `${fmt(t.soldiers)} جندي` : t.soldiers === 0 ? 'لا جنود لأسرهم' : 'هاجمتموه في هجومكم السابق'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`step ${mode === 'confront' && !opponent ? 'dim' : ''}`}>
        <h3>{mode === 'confront' && <span className="step-num">٢</span>} اختاروا عدد الجنود المشاركين</h3>
        <div className="missions">
          {STAKES.map((s) => {
            const d = STAKE_DIFFICULTY[s];
            const tooMany = !stakes.includes(s);
            const disabled = tooMany || (mode === 'confront' && !opponent);
            return (
              <button key={s} className={`mission diff-${d} ${stake === s ? 'on' : ''}`} disabled={disabled}
                onClick={() => (mode === 'reinforce' ? begin(s) : setStake(s))} aria-pressed={stake === s}>
                <span className="mission-stake">{fmt(s)}</span>
                <span className="mission-unit">{s === 20 ? 'جنديًا' : 'جنود'}</span>
                <span className={`chip diff-${d}`}>{DIFFICULTY_LABEL[d]}</span>
                {mode === 'reinforce' && !tooMany && (
                  <span className="mission-preview">
                    <span className="good">صحيحة: {fmt(team.soldiers + s)}</span>
                    <span className="bad">خاطئة: {fmt(team.soldiers - s)}</span>
                  </span>
                )}
                {tooMany && <span className="mission-note">يتجاوز رصيدكم</span>}
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'confront' && opponent && stake && (
        <div className="confront-preview">
          <h3>أثر النتائج المحتملة</h3>
          <OutcomeTable game={game} stake={stake} initiator={team} opponent={opponent} />
          <button className="btn danger xl block" onClick={() => begin(stake)}>استعدوا للمواجهة</button>
        </div>
      )}
    </div>
  );
}

function OutcomeTable({ game, stake, initiator, opponent }: { game: GameState; stake: number; initiator: TeamState; opponent: TeamState }) {
  const base = { mode: 'confront' as const, stake, initiatorId: initiator.id, opponentId: opponent.id };
  const rows: [string, 'capture' | 'rescue', string | null][] = [
    [`أخطأ ${initiator.name} في سؤال الأسر`, 'capture', null],
    [`أسر ثم حسمها ${initiator.name} في الاستنقاذ (أو لم يُجب أحد)`, 'rescue', initiator.id],
    [`أسر ثم استنقذ ${opponent.name} جنوده`, 'rescue', opponent.id],
  ];
  return (
    <>
    <p className="flow-note">١) سؤال الأسر لـ{initiator.name} وحده. ٢) إن أصاب: سؤال الاستنقاذ للجيشين، والأسرع يحسم.</p>
    <table className="table outcome-table">
      <thead><tr><th>النتيجة</th><th>رصيد {initiator.name}</th><th>التغيير في {opponent.name}</th></tr></thead>
      <tbody>
        {rows.map(([label, step, w]) => {
          const e = computeEffect({ ...base, step }, w, game.teams);
          return (
            <tr key={label}>
              <td>{label}</td>
              <td>{fmt(initiator.soldiers + (e.deltas[initiator.id] ?? 0))} <Delta value={e.deltas[initiator.id] ?? 0} /></td>
              <td><Delta value={e.deltas[opponent.id] ?? 0} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </>
  );
}

function TiebreakPanel({ game, onStart }: { game: GameState; onStart: () => void }) {
  const tied = game.teams.filter((t) => game.tiebreakTeamIds.includes(t.id));
  return (
    <div className="turn-panel tiebreak-panel">
      <p className="eyebrow gold">تعادل على المركز الأول</p>
      <h2 className="turn-name">أسئلة فاصلة</h2>
      <div className="tied">
        {tied.map((t) => (
          <div key={t.id} className="tied-team" style={{ '--team': t.color } as CSSProperties}>
            <Emblem id={t.emblem} color={t.color} size={64} /><b>{t.name}</b><span>{fmt(t.soldiers)} جندي</span>
          </div>
        ))}
      </div>
      <p className="muted">اطرح سؤالًا متوسطًا من الكتاب للجيوش المتعادلة. أول جيش يجيب صحيحًا يفوز بالمعركة. الأرصدة لا تتغير.</p>
      <button className="btn gold xl" onClick={onStart}>طرح سؤال فاصل</button>
    </div>
  );
}

/* ---------------- الحركة بعد النتيجة ---------------- */

function FlashOverlay({ flash, teams, onClose }: { flash: NonNullable<GameState['flash']>; teams: TeamState[]; onClose: () => void }) {
  const items = teams.filter((t) => flash.deltas[t.id] !== undefined);
  return (
    <div className={`flash-overlay ${flash.positive ? 'good' : 'bad'}`} onClick={onClose} role="status">
      <div className="flash-card">
        <h2>{flash.title}</h2>
        <div className="flash-teams">
          {items.map((t) => (
            <div key={t.id} className="flash-team" style={{ '--team': t.color } as CSSProperties}>
              <Emblem id={t.emblem} color={t.color} size={56} />
              <b>{t.name}</b>
              <Delta value={flash.deltas[t.id]} />
              <span className="flash-total">{fmt(t.soldiers)} جندي</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


import { CSSProperties, useEffect, useRef } from 'react';
import type { AppApi } from '../App';
import { fmt, ranking } from '../engine/engine';
import { GameState } from '../engine/types';
import { play } from '../audio';
import { Emblem, Icon } from './common';

export function Victory({ api, game }: { api: AppApi; game: GameState }) {
  const ranked = ranking(game.teams, game.winnerId);
  const winner = ranked[0];
  const played = useRef(false);
  useEffect(() => {
    if (!played.current) { played.current = true; play('victory'); }
  }, []);
  const confetti = Array.from({ length: 36 }, (_, i) => i);
  const colors = ['#ffc233', '#1faf63', '#f04a32', '#ffffff', winner.color];

  return (
    <main className="victory" style={{ '--team': winner.color } as CSSProperties}>
      <div className="confetti" aria-hidden="true">
        {confetti.map((i) => (
          <span key={i} style={{
            left: `${(i * 37) % 100}%`, background: colors[i % colors.length],
            animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${2.2 + (i % 5) * 0.3}s`,
          } as CSSProperties} />
        ))}
      </div>

      <section className="crown-block">
        <p className="eyebrow gold">حُسمت المعركة</p>
        <div className="winner-emblem"><Emblem id={winner.emblem} color={winner.color} size={170} /></div>
        <h1 className="winner-name">{winner.name}</h1>
        <p className="winner-score"><span className="num">{fmt(winner.soldiers)}</span> جندي</p>
      </section>

      <section className="panel final-table">
        <h2>الترتيب النهائي والإحصاءات</h2>
        <table className="table">
          <thead>
            <tr><th>المركز</th><th>الجيش</th><th>الرصيد</th><th>إجابات صحيحة</th><th>مواجهات فاز بها</th><th>أكبر مكسب في دور</th></tr>
          </thead>
          <tbody>
            {ranked.map((t, i) => (
              <tr key={t.id} className={i === 0 ? 'first' : ''}>
                <td className="pos">{fmt(i + 1)}</td>
                <td><span className="team-inline" style={{ '--team': t.color } as CSSProperties}><Emblem id={t.emblem} color={t.color} size={32} /> {t.name}</span></td>
                <td className="num">{fmt(t.soldiers)}</td>
                <td>{fmt(t.stats.correct)}</td>
                <td>{fmt(t.stats.confrontWins)}</td>
                <td>{t.stats.biggestGain > 0 ? <span className="ltr-num">+{fmt(t.stats.biggestGain)}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">عدد الجولات: {fmt(game.round)}{game.tiebreakTeamIds.length === 0 && game.log.some((l) => l.text.includes('الأسئلة الفاصلة')) ? ' · حُسمت بالأسئلة الفاصلة' : ''}</p>
      </section>

      <div className="victory-actions">
        <button className="btn gold xl" onClick={() => api.startGame(game.settings)}>إعادة اللعب بالإعدادات نفسها</button>
        <button className="btn outline xl" onClick={() => api.go('setup')}>مباراة جديدة</button>
        <button className="btn ghost" onClick={() => api.confirm({
          title: 'تراجع عن آخر نتيجة؟', message: 'ستعود المباراة إلى ما قبل تأكيد آخر نتيجة.', confirmLabel: 'تراجع',
          onConfirm: () => api.dispatch({ type: 'UNDO' }),
        })} disabled={game.history.length === 0}><Icon name="undo" size={18} /> تراجع عن آخر نتيجة</button>
        <button className="btn ghost" onClick={() => api.go('home')}><Icon name="home" size={18} /> الرئيسية</button>
      </div>
    </main>
  );
}

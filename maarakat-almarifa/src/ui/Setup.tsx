import { useMemo, useState } from 'react';
import type { AppApi } from '../App';
import { Settings, TeamConfig } from '../engine/types';
import { availableQuestions, DIFFICULTIES, diffLabel } from '../engine/questions';
import { Emblem, EMBLEMS, Icon, TEAM_COLORS } from './common';

const DEFAULT_NAMES = ['فيلق الصقور', 'فيلق البرق', 'فيلق الجبال', 'فيلق النجوم', 'فيلق القلاع', 'فيلق الشعلة'];
const DEFAULT_EMBLEMS = ['chevrons', 'bolt', 'mountain', 'star', 'tower', 'flame'];

function defaultTeam(i: number): TeamConfig {
  return { id: `team-${i + 1}`, name: DEFAULT_NAMES[i], color: TEAM_COLORS[i].value, emblem: DEFAULT_EMBLEMS[i] };
}

export const DEFAULT_SETTINGS: Settings = {
  teams: [0, 1, 2, 3].map(defaultTeam),
  startSoldiers: 50,
  winTarget: 200,
  answerSeconds: 30,
  orderMode: 'manual',
  endMode: 'target',
  matchMinutes: 30,
};

export function Setup({ api, initial }: { api: AppApi; initial: Settings | null }) {
  const [s, setS] = useState<Settings>(() => initial ?? DEFAULT_SETTINGS);
  const [picker, setPicker] = useState<number | null>(null);
  const set = (patch: Partial<Settings>) => setS((x) => ({ ...x, ...patch }));
  const setTeam = (i: number, patch: Partial<TeamConfig>) =>
    setS((x) => ({ ...x, teams: x.teams.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));

  const setCount = (n: number) => {
    n = Math.max(2, Math.min(6, n));
    setS((x) => {
      const teams = x.teams.slice(0, n);
      for (let i = teams.length; i < n; i++) {
        const usedIds = new Set(teams.map((t) => t.id));
        const usedColors = new Set(teams.map((t) => t.color));
        const base = defaultTeam(i);
        let k = i;
        while (usedIds.has(base.id)) base.id = `team-${++k + 1}`;
        base.color = TEAM_COLORS.find((c) => !usedColors.has(c.value))?.value ?? base.color;
        teams.push(base);
      }
      return { ...x, teams };
    });
  };
  const move = (i: number, dir: -1 | 1) => setS((x) => {
    const teams = [...x.teams];
    const j = i + dir;
    if (j < 0 || j >= teams.length) return x;
    [teams[i], teams[j]] = [teams[j], teams[i]];
    return { ...x, teams };
  });

  const counts = useMemo(() => Object.fromEntries(DIFFICULTIES.map((d) => [d, availableQuestions(api.bank, [], d).length])), [api.bank]);

  const errors: string[] = [];
  const names = s.teams.map((t) => t.name.trim());
  if (names.some((n) => !n)) errors.push('اكتب اسمًا لكل جيش.');
  if (new Set(names).size !== names.length) errors.push('أسماء الجيوش يجب أن تكون مختلفة.');
  if (!Number.isFinite(s.startSoldiers) || s.startSoldiers < 5 || s.startSoldiers % 5 !== 0) errors.push('عدد الجنود عند البداية يجب أن يكون من مضاعفات ٥ (٥ فأكثر).');
  if (s.endMode === 'target' && !(s.winTarget > s.startSoldiers)) errors.push('رصيد الفوز يجب أن يكون أكبر من عدد الجنود عند البداية.');
  if (!(s.answerSeconds >= 5 && s.answerSeconds <= 300)) errors.push('مدة الإجابة بين ٥ و٣٠٠ ثانية.');
  if (s.endMode === 'time' && !(s.matchMinutes >= 1 && s.matchMinutes <= 300)) errors.push('مدة المباراة بين ١ و٣٠٠ دقيقة.');
  const warnings: string[] = [];
  if (new Set(s.teams.map((t) => t.color)).size !== s.teams.length) warnings.push('بعض الجيوش تحمل اللون نفسه؛ يُفضّل التمييز بينها.');
  DIFFICULTIES.forEach((d) => { if (counts[d] < s.teams.length * 2) warnings.push(`أسئلة المستوى «${diffLabel(d)}» قليلة (${counts[d].toLocaleString('ar-EG')}). قد تنفد أثناء المباراة.`); });

  const start = () => {
    if (errors.length) return;
    const clean = { ...s, teams: s.teams.map((t) => ({ ...t, name: t.name.trim() })) };
    if (api.game && api.game.phase !== 'finished') {
      api.confirm({
        title: 'استبدال المباراة المحفوظة؟',
        message: 'ستُحذف المباراة الجارية المحفوظة وتبدأ معركة جديدة بهذه الإعدادات.',
        confirmLabel: 'ابدأ المعركة', tone: 'danger',
        onConfirm: () => api.startGame(clean),
      });
    } else api.startGame(clean);
  };

  const num = (v: string) => (v === '' ? NaN : Number(v));

  return (
    <main className="page setup">
      <header className="page-head">
        <button className="btn ghost" onClick={() => api.go('home')}><Icon name="home" /> الرئيسية</button>
        <h1>إعداد المعركة</h1>
        <button className="btn ghost" onClick={() => setS(DEFAULT_SETTINGS)}>الإعدادات الافتراضية</button>
      </header>

      <div className="setup-layout">
        <section className="panel">
          <div className="section-title">
            <h2>الجيوش</h2>
            <div className="stepper" aria-label="عدد الفرق">
              <button className="icon-btn" onClick={() => setCount(s.teams.length - 1)} disabled={s.teams.length <= 2} aria-label="إنقاص">−</button>
              <span className="stepper-value">{s.teams.length.toLocaleString('ar-EG')} جيوش</span>
              <button className="icon-btn" onClick={() => setCount(s.teams.length + 1)} disabled={s.teams.length >= 6} aria-label="زيادة">+</button>
            </div>
          </div>
          <ol className="team-setup-list">
            {s.teams.map((t, i) => (
              <li key={t.id} className="team-setup" style={{ '--team': t.color } as React.CSSProperties}>
                <div className="order-col">
                  {s.orderMode === 'manual' ? (
                    <>
                      <button className="icon-btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="تقديم"><Icon name="up" size={18} /></button>
                      <span className="order-num">{(i + 1).toLocaleString('ar-EG')}</span>
                      <button className="icon-btn sm" onClick={() => move(i, 1)} disabled={i === s.teams.length - 1} aria-label="تأخير"><Icon name="down" size={18} /></button>
                    </>
                  ) : <span className="order-num"><Icon name="shuffle" size={18} /></span>}
                </div>
                <button className="emblem-btn" onClick={() => setPicker(picker === i ? null : i)} aria-label="اختيار الشعار" aria-expanded={picker === i}>
                  <Emblem id={t.emblem} color={t.color} size={58} />
                </button>
                <div className="team-fields">
                  <input className="input lg" value={t.name} maxLength={24} onChange={(e) => setTeam(i, { name: e.target.value })} aria-label={`اسم الجيش ${i + 1}`} />
                  <div className="swatches" role="radiogroup" aria-label="اللون">
                    {TEAM_COLORS.map((c) => (
                      <button key={c.value} role="radio" aria-checked={t.color === c.value} title={c.label}
                        className={`swatch ${t.color === c.value ? 'on' : ''}`} style={{ background: c.value }} onClick={() => setTeam(i, { color: c.value })} />
                    ))}
                  </div>
                  {picker === i && (
                    <div className="emblem-picker" role="radiogroup" aria-label="الشعار">
                      {EMBLEMS.map((e) => (
                        <button key={e.id} role="radio" aria-checked={t.emblem === e.id} title={e.label}
                          className={`emblem-opt ${t.emblem === e.id ? 'on' : ''}`} onClick={() => { setTeam(i, { emblem: e.id }); setPicker(null); }}>
                          <Emblem id={e.id} color={t.color} size={44} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel settings-panel">
          <h2>قواعد الاشتباك</h2>
          <label className="field">
            <span>عدد الجنود عند البداية</span>
            <input className="input" type="number" min={5} step={5} value={Number.isNaN(s.startSoldiers) ? '' : s.startSoldiers} onChange={(e) => set({ startSoldiers: num(e.target.value) })} />
          </label>
          <fieldset className="field">
            <legend>نهاية المباراة</legend>
            <div className="seg">
              <button className={s.endMode === 'target' ? 'on' : ''} onClick={() => set({ endMode: 'target' })}>حتى رصيد الفوز</button>
              <button className={s.endMode === 'time' ? 'on' : ''} onClick={() => set({ endMode: 'time' })}>لمدة محددة</button>
            </div>
          </fieldset>
          {s.endMode === 'target' ? (
            <label className="field">
              <span>رصيد الفوز (جنود)</span>
              <input className="input" type="number" min={10} step={5} value={Number.isNaN(s.winTarget) ? '' : s.winTarget} onChange={(e) => set({ winTarget: num(e.target.value) })} />
            </label>
          ) : (
            <label className="field">
              <span>مدة المباراة (دقائق)</span>
              <input className="input" type="number" min={1} max={300} value={Number.isNaN(s.matchMinutes) ? '' : s.matchMinutes} onChange={(e) => set({ matchMinutes: num(e.target.value) })} />
            </label>
          )}
          <label className="field">
            <span>مدة الإجابة في التعزيزات (ثوانٍ)</span>
            <input className="input" type="number" min={5} max={300} value={Number.isNaN(s.answerSeconds) ? '' : s.answerSeconds} onChange={(e) => set({ answerSeconds: num(e.target.value) })} />
            <small className="muted">وهي أيضًا مهلة طلب الإجابة في المواجهة. بعد الطلب: ٥ ثوانٍ للأسبق، ثم ١٠ للآخر.</small>
          </label>
          <fieldset className="field">
            <legend>ترتيب الأدوار</legend>
            <div className="seg">
              <button className={s.orderMode === 'manual' ? 'on' : ''} onClick={() => set({ orderMode: 'manual' })}>يدوي (كما في القائمة)</button>
              <button className={s.orderMode === 'random' ? 'on' : ''} onClick={() => set({ orderMode: 'random' })}>عشوائي عند البدء</button>
            </div>
          </fieldset>

          <div className="bank-summary">
            <h3>بنك الأسئلة</h3>
            <div className="chips">
              {DIFFICULTIES.map((d) => <span key={d} className={`chip diff-${d}`}>{diffLabel(d)}: {counts[d].toLocaleString('ar-EG')}</span>)}
            </div>
            <button className="btn ghost sm" onClick={() => api.go('bank')}>إدارة الأسئلة</button>
          </div>

          {errors.length > 0 && <ul className="form-errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {warnings.length > 0 && <ul className="form-warnings">{warnings.map((e) => <li key={e}>{e}</li>)}</ul>}

          <button className="btn primary xl block" onClick={start} disabled={errors.length > 0}>ابدأ المعركة</button>
        </section>
      </div>
    </main>
  );
}

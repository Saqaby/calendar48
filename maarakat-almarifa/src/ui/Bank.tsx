import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppApi } from '../App';
import { Difficulty, Question } from '../engine/types';
import { DIFFICULTIES, diffLabel, EXAMPLE_JSON, exportJson, ImportResult, newId, parseImport, validateQuestion } from '../engine/questions';
import { DEFAULT_CATEGORIES, SEED_QUESTIONS } from '../data/seed';
import { Icon, Modal } from './common';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Bank({ api }: { api: AppApi }) {
  const { bank, setBank } = api;
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<Difficulty | ''>('');
  const [cat, setCat] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const [editing, setEditing] = useState<Partial<Question> | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(id);
  }, [notice]);

  const categories = useMemo(() => Array.from(new Set([...DEFAULT_CATEGORIES, ...bank.map((q) => q.category)])), [bank]);
  const usedInGame = new Set(api.game && api.game.phase !== 'finished' ? api.game.usedQuestionIds : []);
  const filtered = bank.filter((q) => {
    if (level && q.difficulty !== level) return false;
    if (cat && q.category !== cat) return false;
    const s = query.trim();
    return !s || q.text.includes(s) || q.answer.includes(s) || q.id.includes(s) || q.category.includes(s);
  });
  const counts = Object.fromEntries(DIFFICULTIES.map((d) => [d, bank.filter((q) => q.difficulty === d).length]));

  const save = (q: Question) => {
    const exists = bank.some((x) => x.id === q.id);
    setBank(exists ? bank.map((x) => (x.id === q.id ? q : x)) : [...bank, q]);
    setNotice(exists ? 'حُفظت التعديلات.' : 'أُضيف السؤال.');
    setEditing(null);
  };
  const remove = (q: Question) => api.confirm({
    title: 'حذف السؤال؟', tone: 'danger', confirmLabel: 'حذف',
    message: <>سيُحذف: «{q.text}»{usedInGame.has(q.id) ? ' (استُخدم في المباراة الجارية، ولن يتأثر سجلها)' : ''}</>,
    onConfirm: () => { setBank(bank.filter((x) => x.id !== q.id)); setNotice('حُذف السؤال.'); },
  });
  const resetSeed = () => api.confirm({
    title: 'استعادة الأسئلة التجريبية؟', confirmLabel: 'استعادة', tone: 'danger',
    message: 'سيُستبدل البنك الحالي كاملًا بالأسئلة التجريبية الـ٤٥. صدّر أسئلتك أولًا إن أردت الاحتفاظ بها.',
    onConfirm: () => { setBank(SEED_QUESTIONS); setNotice('استُعيدت الأسئلة التجريبية.'); },
  });

  return (
    <main className="page bank">
      <header className="page-head">
        <button className="btn ghost" onClick={() => api.go(api.game && api.game.phase !== 'finished' ? 'game' : 'home')}>
          <Icon name="home" /> {api.game && api.game.phase !== 'finished' ? 'العودة إلى المباراة' : 'الرئيسية'}
        </button>
        <h1>بنك الأسئلة</h1>
        <div className="chips">
          {DIFFICULTIES.map((d) => <span key={d} className={`chip diff-${d}`}>{diffLabel(d)}: {counts[d].toLocaleString('ar-EG')}</span>)}
        </div>
      </header>

      <div className="toolbar panel">
        <input className="input" type="search" placeholder="ابحث في الأسئلة والإجابات…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="بحث" />
        <select className="input" value={level} onChange={(e) => setLevel(e.target.value as Difficulty | '')} aria-label="المستوى">
          <option value="">كل المستويات</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{diffLabel(d)}</option>)}
        </select>
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="التصنيف">
          <option value="">كل التصنيفات</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="toggle"><input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} /> إظهار الإجابات</label>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing({ difficulty: 'easy', category: DEFAULT_CATEGORIES[0] })}><Icon name="plus" size={18} /> إضافة سؤال</button>
        <button className="btn outline" onClick={() => setImporting(true)}>استيراد JSON</button>
        <button className="btn outline" onClick={() => download('maarakat-questions.json', exportJson(bank))}>تصدير JSON</button>
        <button className="btn ghost" onClick={resetSeed}>استعادة التجريبية</button>
      </div>

      {notice && <div className="notice" role="status">{notice}</div>}
      {!showAnswers && <p className="muted center">الإجابات مخفية حتى لا تظهر على شاشة العرض. فعّل «إظهار الإجابات» عند الحاجة.</p>}

      <div className="panel table-wrap">
        <table className="table bank-table">
          <thead><tr><th>المعرّف</th><th>السؤال</th><th>الإجابة</th><th>المستوى</th><th>التصنيف</th><th>إجراءات</th></tr></thead>
          <tbody>
            {filtered.map((q) => (
              <tr key={q.id}>
                <td className="mono">{q.id}{usedInGame.has(q.id) && <span className="chip tiny">استُخدم</span>}</td>
                <td className="q-cell">{q.text}{q.explanation && <small className="muted block">{q.explanation}</small>}</td>
                <td>{showAnswers ? q.answer : <span className="masked">••••••</span>}</td>
                <td><span className={`chip diff-${q.difficulty}`}>{diffLabel(q.difficulty)}</span></td>
                <td>{q.category}</td>
                <td className="row-actions">
                  <button className="icon-btn sm" onClick={() => setEditing(q)} aria-label="تعديل" title="تعديل"><Icon name="edit" size={18} /></button>
                  <button className="icon-btn sm danger-text" onClick={() => remove(q)} aria-label="حذف" title="حذف"><Icon name="trash" size={18} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="center muted">لا توجد أسئلة مطابقة.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <QuestionForm initial={editing} categories={categories} onSave={save} onClose={() => setEditing(null)} />}
      {importing && (
        <ImportDialog bank={bank} onClose={() => setImporting(false)} onImport={(qs, replace) => {
          setBank(replace ? qs : [...bank, ...qs]);
          setNotice(`استُورد ${qs.length.toLocaleString('ar-EG')} سؤالًا${replace ? ' (استُبدل البنك السابق)' : ''}.`);
          setImporting(false);
        }} />
      )}
    </main>
  );
}

function QuestionForm({ initial, categories, onSave, onClose }: {
  initial: Partial<Question>; categories: string[]; onSave: (q: Question) => void; onClose: () => void;
}) {
  const [q, setQ] = useState<Partial<Question>>(initial);
  const [tried, setTried] = useState(false);
  const errors = validateQuestion(q);
  const submit = () => {
    setTried(true);
    if (errors.length) return;
    const out: Question = {
      id: q.id || newId(), text: q.text!.trim(), answer: q.answer!.trim(), difficulty: q.difficulty!, category: q.category!.trim(),
    };
    if (q.explanation?.trim()) out.explanation = q.explanation.trim();
    onSave(out);
  };
  return (
    <Modal title={initial.id ? 'تعديل سؤال' : 'إضافة سؤال'} onClose={onClose} wide
      actions={<><button className="btn ghost" onClick={onClose}>إلغاء</button><button className="btn primary" onClick={submit}>حفظ</button></>}>
      <div className="form">
        {initial.id && <p className="muted">المعرّف: <span className="mono">{initial.id}</span></p>}
        <label className="field"><span>نص السؤال</span>
          <textarea className="input" rows={3} value={q.text ?? ''} onChange={(e) => setQ({ ...q, text: e.target.value })} autoFocus /></label>
        <label className="field"><span>الإجابة النموذجية</span>
          <input className="input" value={q.answer ?? ''} onChange={(e) => setQ({ ...q, answer: e.target.value })} /></label>
        <div className="field-row">
          <fieldset className="field"><legend>المستوى</legend>
            <div className="seg">
              {DIFFICULTIES.map((d) => <button key={d} className={q.difficulty === d ? 'on' : ''} onClick={() => setQ({ ...q, difficulty: d })}>{diffLabel(d)}</button>)}
            </div>
          </fieldset>
          <label className="field"><span>التصنيف</span>
            <input className="input" list="mk-cats" value={q.category ?? ''} onChange={(e) => setQ({ ...q, category: e.target.value })} />
            <datalist id="mk-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
        </div>
        <label className="field"><span>شرح قصير (اختياري)</span>
          <input className="input" value={q.explanation ?? ''} onChange={(e) => setQ({ ...q, explanation: e.target.value })} /></label>
        {tried && errors.length > 0 && <ul className="form-errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      </div>
    </Modal>
  );
}

function ImportDialog({ bank, onImport, onClose }: { bank: Question[]; onImport: (q: Question[], replace: boolean) => void; onClose: () => void }) {
  const [raw, setRaw] = useState('');
  const [replace, setReplace] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const check = (text: string, rep = replace) => { setRaw(text); setResult(text.trim() ? parseImport(text, rep ? [] : bank) : null); };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => check(String(r.result ?? ''));
    r.onerror = () => setResult({ questions: [], errors: ['تعذّرت قراءة الملف.'], skipped: [] });
    r.readAsText(f, 'utf-8');
  };
  const ok = result && result.questions.length > 0;
  return (
    <Modal title="استيراد أسئلة (JSON)" onClose={onClose} wide
      actions={<>
        <button className="btn ghost" onClick={onClose}>إلغاء</button>
        <button className="btn primary" disabled={!ok} onClick={() => ok && onImport(result.questions, replace)}>
          استيراد {ok ? result.questions.length.toLocaleString('ar-EG') : ''} سؤالًا
        </button>
      </>}>
      <div className="import-grid">
        <div>
          <div className="ctrl-row">
            <button className="btn outline" onClick={() => fileRef.current?.click()}>اختيار ملف .json</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <div className="seg sm">
              <button className={!replace ? 'on' : ''} onClick={() => { setReplace(false); check(raw, false); }}>إضافة إلى البنك</button>
              <button className={replace ? 'on' : ''} onClick={() => { setReplace(true); check(raw, true); }}>استبدال البنك</button>
            </div>
          </div>
          <label className="field"><span>أو الصق محتوى الملف هنا</span>
            <textarea className="input mono" dir="ltr" rows={10} value={raw} onChange={(e) => check(e.target.value)} placeholder='{ "questions": [ ... ] }' /></label>
          {result && (
            <div className="import-result" role="status">
              {result.questions.length > 0 && <p className="good">✓ جاهز للاستيراد: {result.questions.length.toLocaleString('ar-EG')} سؤالًا.</p>}
              {result.errors.length > 0 && <>
                <p className="bad">أخطاء ({result.errors.length.toLocaleString('ar-EG')}) — لن تُستورد هذه الأسئلة:</p>
                <ul className="form-errors">{result.errors.slice(0, 30).map((e) => <li key={e}>{e}</li>)}</ul>
              </>}
              {result.skipped.length > 0 && <>
                <p className="warn">ملاحظات ({result.skipped.length.toLocaleString('ar-EG')}):</p>
                <ul className="form-warnings">{result.skipped.slice(0, 30).map((e) => <li key={e}>{e}</li>)}</ul>
              </>}
            </div>
          )}
        </div>
        <div className="example">
          <h3>مثال على التنسيق</h3>
          <p className="muted">الحقول المطلوبة: <code>text</code> نص السؤال، <code>answer</code> الإجابة، <code>difficulty</code> (easy / medium / hard أو سهل / متوسط / صعب)، <code>category</code> التصنيف. الاختيارية: <code>id</code> معرّف فريد (يُولَّد تلقائيًا إن غاب)، <code>explanation</code> شرح قصير.</p>
          <pre dir="ltr" className="mono">{EXAMPLE_JSON}</pre>
          <button className="btn ghost sm" onClick={() => download('maarakat-example.json', EXAMPLE_JSON)}>تنزيل ملف المثال</button>
        </div>
      </div>
    </Modal>
  );
}

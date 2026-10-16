import { Difficulty, DIFFICULTY_LABEL, Question } from './types';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export function availableQuestions(bank: Question[], used: string[], difficulty: Difficulty): Question[] {
  const u = new Set(used);
  return bank.filter((q) => q.difficulty === difficulty && !u.has(q.id));
}

export function pickQuestion(
  bank: Question[], used: string[], difficulty: Difficulty, rng: () => number = Math.random,
): Question | null {
  const list = availableQuestions(bank, used, difficulty);
  if (list.length === 0) return null;
  return list[Math.floor(rng() * list.length)];
}

export function newId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const DIFF_ALIASES: Record<string, Difficulty> = {
  easy: 'easy', medium: 'medium', hard: 'hard',
  'سهل': 'easy', 'متوسط': 'medium', 'صعب': 'hard',
};

function normText(s: string) {
  return s.replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim();
}

export interface ImportResult {
  questions: Question[];
  errors: string[];
  skipped: string[];
}

/** التحقق من ملف JSON المستورد. existing يُستخدم لاكتشاف التكرار عند الدمج */
export function parseImport(raw: string, existing: Question[] = []): ImportResult {
  const errors: string[] = [];
  const skipped: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { questions: [], errors: ['الملف ليس بصيغة JSON صحيحة. تأكد من الأقواس والفواصل وعلامات التنصيص.'], skipped };
  }
  const list = Array.isArray(data) ? data : (data as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) {
    return { questions: [], errors: ['يجب أن يحتوي الملف على قائمة أسئلة: إما مصفوفة [ ... ] أو كائن فيه الحقل "questions".'], skipped };
  }
  if (list.length === 0) return { questions: [], errors: ['الملف لا يحتوي على أي سؤال.'], skipped };

  const ids = new Set(existing.map((q) => q.id));
  const texts = new Set(existing.map((q) => normText(q.text)));
  const out: Question[] = [];

  list.forEach((item, i) => {
    const n = `السؤال رقم ${(i + 1).toLocaleString('ar-EG')}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${n}: يجب أن يكون كائنًا بين قوسين { }.`);
      return;
    }
    const o = item as Record<string, unknown>;
    const problems: string[] = [];
    const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : typeof o[k] === 'number' ? String(o[k]) : '');
    const text = str('text');
    const answer = str('answer');
    const category = str('category');
    const diffRaw = str('difficulty').toLowerCase();
    const difficulty = DIFF_ALIASES[diffRaw];
    if (!text) problems.push('نص السؤال "text" مفقود أو فارغ');
    if (!answer) problems.push('الإجابة "answer" مفقودة أو فارغة');
    if (!category) problems.push('التصنيف "category" مفقود أو فارغ');
    if (!difficulty) problems.push(`المستوى "difficulty" يجب أن يكون easy أو medium أو hard (أو سهل/متوسط/صعب)، والقيمة الحالية: «${diffRaw || 'فارغة'}»`);
    if (o.explanation != null && typeof o.explanation !== 'string') problems.push('الشرح "explanation" يجب أن يكون نصًا');
    if (o.id != null && typeof o.id !== 'string' && typeof o.id !== 'number') problems.push('المعرّف "id" يجب أن يكون نصًا');
    if (problems.length) {
      errors.push(`${n}: ${problems.join('؛ ')}.`);
      return;
    }
    let id = o.id != null ? String(o.id).trim() : '';
    const nt = normText(text);
    if (texts.has(nt)) {
      skipped.push(`${n}: مكرر (النص موجود مسبقًا) — «${text.slice(0, 40)}»`);
      return;
    }
    if (!id) id = newId();
    if (ids.has(id)) {
      skipped.push(`${n}: المعرّف «${id}» مستخدم مسبقًا — أُعطي معرّفًا جديدًا`);
      id = newId();
    }
    ids.add(id);
    texts.add(nt);
    const q: Question = { id, text, answer, difficulty, category };
    const ex = str('explanation');
    if (ex) q.explanation = ex;
    out.push(q);
  });
  return { questions: out, errors, skipped };
}

export function exportJson(bank: Question[]): string {
  return JSON.stringify({ format: 'maarakat-almarifa/questions', version: 1, questions: bank }, null, 2);
}

export const EXAMPLE_JSON = JSON.stringify({
  questions: [
    {
      id: 'geo-001',
      text: 'ما عاصمة مصر؟',
      answer: 'القاهرة',
      difficulty: 'easy',
      category: 'معلومات عامة',
      explanation: 'اختياري: شرح قصير يظهر مع الحل.',
    },
    { text: 'كم يساوي ١٢ × ١٢؟', answer: '١٤٤', difficulty: 'medium', category: 'رياضيات' },
  ],
}, null, 2);

export function validateQuestion(q: Partial<Question>): string[] {
  const e: string[] = [];
  if (!q.text?.trim()) e.push('اكتب نص السؤال');
  if (!q.answer?.trim()) e.push('اكتب الإجابة النموذجية');
  if (!q.category?.trim()) e.push('اختر التصنيف أو اكتبه');
  if (!q.difficulty || !DIFFICULTIES.includes(q.difficulty)) e.push('اختر مستوى الصعوبة');
  return e;
}

export function diffLabel(d: Difficulty) {
  return DIFFICULTY_LABEL[d];
}

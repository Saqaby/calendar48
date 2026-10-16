import { describe, expect, it } from 'vitest';
import { allowedOpponents, computeEffect, createGame, freeze, reducer, timerRemaining } from './engine';
import { availableQuestions, parseImport, pickQuestion } from './questions';
import { Action, Difficulty, GameState, Question, Settings, Stake } from './types';
import { SEED_QUESTIONS } from '../data/seed';

const NOW = 1_000_000;

function settings(n = 2, patch: Partial<Settings> = {}): Settings {
  const names = ['ألف', 'باء', 'جيم', 'دال', 'هاء', 'واو'];
  return {
    teams: names.slice(0, n).map((name, i) => ({ id: `t${i}`, name, color: '#fff', emblem: 'star' })),
    startSoldiers: 50, winTarget: 200, answerSeconds: 30, orderMode: 'manual', endMode: 'target', matchMinutes: 20,
    ...patch,
  };
}

const bank = SEED_QUESTIONS;
const q = (s: GameState, d: Difficulty) => pickQuestion(bank, s.usedQuestionIds, d, () => 0)!;
const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s);
const diffOf: Record<Stake, Difficulty> = { 5: 'easy', 10: 'medium', 20: 'hard' };

function reinforce(s: GameState, stake: Stake, correct: boolean): GameState {
  s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
  s = run(s, { type: 'START_TURN', stake, question: q(s, diffOf[stake]), now: NOW });
  s = run(s, { type: 'BEGIN', now: NOW }, { type: 'MARK', result: correct ? 'correct' : 'wrong', now: NOW });
  return run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
}

/** outcome: الفريق الفائز أو null للإخفاق */
function confront(s: GameState, stake: Stake, oppId: string, outcome: 'init' | 'opp' | 'none'): GameState {
  const initId = s.teams[s.currentIndex].id;
  s = run(s, { type: 'CHOOSE_MODE', mode: 'confront' });
  s = run(s, { type: 'START_TURN', stake, opponentId: oppId, question: q(s, diffOf[stake]), now: NOW });
  s = run(s, { type: 'BEGIN', now: NOW });
  if (outcome === 'init') s = run(s, { type: 'BUZZ', teamId: initId, now: NOW }, { type: 'MARK', result: 'correct', now: NOW });
  if (outcome === 'opp') s = run(s, { type: 'BUZZ', teamId: initId, now: NOW }, { type: 'MARK', result: 'wrong', now: NOW }, { type: 'MARK', result: 'correct', now: NOW });
  if (outcome === 'none') s = run(s, { type: 'BUZZ', teamId: oppId, now: NOW }, { type: 'MARK', result: 'wrong', now: NOW }, { type: 'MARK', result: 'timeout', now: NOW });
  return run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
}

const soldiers = (s: GameState) => Object.fromEntries(s.teams.map((t) => [t.name, t.soldiers]));

describe('التعزيزات', () => {
  it('الإجابة الصحيحة: ٥٠ ← ٦٠', () => {
    const s = reinforce(createGame(settings(), NOW), 10, true);
    expect(soldiers(s)['ألف']).toBe(60);
  });
  it('الإجابة الخاطئة: ٥٠ ← ٤٠', () => {
    const s = reinforce(createGame(settings(), NOW), 10, false);
    expect(soldiers(s)['ألف']).toBe(40);
  });
  it('انتهاء الوقت يُحتسب خطأ', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
    s = run(s, { type: 'START_TURN', stake: 20, question: q(s, 'hard'), now: NOW }, { type: 'BEGIN', now: NOW });
    expect(run(s, { type: 'TIMEOUT', now: NOW + 10_000 }).turn!.stage).toBe('answering'); // مؤقّت لم ينتهِ بعد
    s = run(s, { type: 'TIMEOUT', now: NOW + 30_000 });
    expect(s.turn!.stage).toBe('decided');
    s = run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
    expect(soldiers(s)['ألف']).toBe(30);
  });
  it('لا يجوز اختيار عدد يتجاوز الرصيد', () => {
    let s = createGame(settings(2, { startSoldiers: 10 }), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
    const after = run(s, { type: 'START_TURN', stake: 20, question: q(s, 'hard'), now: NOW });
    expect(after).toBe(s);
  });
  it('سؤال بمستوى لا يطابق العدد يُرفض', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
    expect(run(s, { type: 'START_TURN', stake: 5, question: q(s, 'hard'), now: NOW })).toBe(s);
  });
});

describe('المواجهة (مثال ألف ضد باء بـ١٠ جنود)', () => {
  it('فوز ألف: ٧٠ وباء بلا تغيير', () => {
    const s = confront(createGame(settings(), NOW), 10, 't1', 'init');
    expect(soldiers(s)).toEqual({ 'ألف': 70, 'باء': 50 });
    expect(s.teams[0].stats.confrontWins).toBe(1);
  });
  it('فوز باء: ألف ٤٠ وباء +١٠', () => {
    const s = confront(createGame(settings(), NOW), 10, 't1', 'opp');
    expect(soldiers(s)).toEqual({ 'ألف': 40, 'باء': 60 });
    expect(s.teams[1].stats.confrontWins).toBe(1);
  });
  it('إخفاق الفريقين: ألف ٤٠ وباء بلا تغيير', () => {
    const s = confront(createGame(settings(), NOW), 10, 't1', 'none');
    expect(soldiers(s)).toEqual({ 'ألف': 40, 'باء': 50 });
  });
  it('الأسبق يحصل على ٥ ثوانٍ ثم الآخر ١٠ ثوانٍ', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'confront' });
    s = run(s, { type: 'START_TURN', stake: 5, opponentId: 't1', question: q(s, 'easy'), now: NOW });
    expect(run(s, { type: 'BUZZ', teamId: 't0', now: NOW })).toBe(s); // لا طلب إجابة قبل بدء المواجهة
    s = run(s, { type: 'BEGIN', now: NOW }, { type: 'BUZZ', teamId: 't1', now: NOW });
    expect(s.turn!.answeringTeamId).toBe('t1');
    expect(s.turn!.timer!.durationMs).toBe(5000);
    s = run(s, { type: 'TIMEOUT', now: NOW + 5000 });
    expect(s.turn!.answeringTeamId).toBe('t0');
    expect(s.turn!.timer!.durationMs).toBe(10000);
  });
  it('مهلة طلب الإجابة دون أي طلب = إخفاق الفريقين', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'confront' });
    s = run(s, { type: 'START_TURN', stake: 5, opponentId: 't1', question: q(s, 'easy'), now: NOW }, { type: 'BEGIN', now: NOW });
    s = run(s, { type: 'TIMEOUT', now: NOW + 30_000 });
    expect(s.turn!.stage).toBe('decided');
    expect(s.turn!.winnerId).toBeNull();
  });
  it('لا يجوز مواجهة النفس', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'confront' });
    expect(run(s, { type: 'START_TURN', stake: 5, opponentId: 't0', question: q(s, 'easy'), now: NOW })).toBe(s);
  });
  it('منع الخصم نفسه في مواجهتين متتاليتين عند ٣ فرق فأكثر', () => {
    let s = createGame(settings(3), NOW);
    s = confront(s, 5, 't1', 'init');
    s = reinforce(s, 5, true); // باء
    s = reinforce(s, 5, true); // جيم
    expect(allowedOpponents(s, 't0')).toEqual(['t2']);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'confront' });
    expect(run(s, { type: 'START_TURN', stake: 5, opponentId: 't1', question: q(s, 'easy'), now: NOW })).toBe(s);
  });
  it('مع فريقين فقط يُسمح بالخصم نفسه', () => {
    let s = createGame(settings(2), NOW);
    s = confront(s, 5, 't1', 'init');
    s = reinforce(s, 5, true);
    expect(allowedOpponents(s, 't0')).toEqual(['t1']);
  });
  it('استبدال السؤال يحافظ على الأرصدة ولا يعيد السؤال القديم', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'confront' });
    s = run(s, { type: 'START_TURN', stake: 10, opponentId: 't1', question: q(s, 'medium'), now: NOW }, { type: 'BEGIN', now: NOW });
    const oldId = s.turn!.question.id;
    s = run(s, { type: 'REPLACE_QUESTION', question: q(s, 'medium') });
    expect(s.turn!.question.id).not.toBe(oldId);
    expect(s.turn!.stage).toBe('reading');
    expect(s.usedQuestionIds).toContain(oldId);
    expect(soldiers(s)).toEqual({ 'ألف': 50, 'باء': 50 });
  });
});

describe('الحماية من الأخطاء', () => {
  it('التأكيد المكرر لا يحتسب مرتين', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
    s = run(s, { type: 'START_TURN', stake: 10, question: q(s, 'medium'), now: NOW }, { type: 'BEGIN', now: NOW }, { type: 'MARK', result: 'correct', now: NOW });
    const seq = s.turn!.seq;
    s = run(s, { type: 'CONFIRM', seq, now: NOW }, { type: 'CONFIRM', seq, now: NOW });
    expect(soldiers(s)['ألف']).toBe(60);
    expect(s.currentIndex).toBe(1);
  });
  it('لا أرصدة سالبة', () => {
    const e = computeEffect({ mode: 'reinforce', stake: 20, initiatorId: 'a', opponentId: null }, null,
      [{ id: 'a', name: 'أ', soldiers: 5 } as never]);
    expect(e.deltas.a).toBe(-5);
  });
  it('الإجابة لا تُكشف قبل انتهاء الإجابة', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
    s = run(s, { type: 'START_TURN', stake: 5, question: q(s, 'easy'), now: NOW }, { type: 'BEGIN', now: NOW });
    expect(run(s, { type: 'REVEAL' }).turn!.revealed).toBe(false);
    s = run(s, { type: 'MARK', result: 'wrong', now: NOW }, { type: 'REVEAL' });
    expect(s.turn!.revealed).toBe(true);
  });
  it('تصحيح التحكيم يدويًا قبل التأكيد', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
    s = run(s, { type: 'START_TURN', stake: 5, question: q(s, 'easy'), now: NOW }, { type: 'BEGIN', now: NOW }, { type: 'MARK', result: 'wrong', now: NOW });
    s = run(s, { type: 'SET_WINNER', winnerId: 't0' });
    s = run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
    expect(soldiers(s)['ألف']).toBe(55);
  });
});

describe('الأدوار والعودة', () => {
  it('تتناوب الأدوار وتزيد الجولة بعد آخر فريق', () => {
    let s = createGame(settings(3), NOW);
    s = reinforce(s, 5, true);
    s = reinforce(s, 5, true);
    expect(s.round).toBe(1);
    s = reinforce(s, 5, true);
    expect(s.round).toBe(2);
    expect(s.currentIndex).toBe(0);
  });
  it('الرصيد صفر: إعادة التعبئة بسؤال سهل، الصحيح يعيده بـ١٠', () => {
    let s = createGame(settings(2, { startSoldiers: 5 }), NOW);
    s = reinforce(s, 5, false); // ألف = ٠
    s = reinforce(s, 5, true);
    expect(s.teams[0].soldiers).toBe(0);
    expect(run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' })).toBe(s); // لا يختار مهمة
    expect(run(s, { type: 'START_REFILL', question: q(s, 'medium'), now: NOW })).toBe(s);
    s = run(s, { type: 'START_REFILL', question: q(s, 'easy'), now: NOW }, { type: 'BEGIN', now: NOW }, { type: 'MARK', result: 'correct', now: NOW });
    s = run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
    expect(s.teams[0].soldiers).toBe(10);
  });
  it('إعادة تعبئة خاطئة: يبقى صفرًا وينتقل الدور', () => {
    let s = createGame(settings(2, { startSoldiers: 5 }), NOW);
    s = reinforce(s, 5, false);
    s = reinforce(s, 5, true);
    s = run(s, { type: 'START_REFILL', question: q(s, 'easy'), now: NOW }, { type: 'BEGIN', now: NOW }, { type: 'MARK', result: 'wrong', now: NOW });
    s = run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
    expect(s.teams[0].soldiers).toBe(0);
    expect(s.currentIndex).toBe(1);
  });
});

describe('نهاية المباراة', () => {
  it('بلوغ رصيد الفوز يبدأ الجولة الأخيرة ثم يفوز الأعلى بعد تساوي الأدوار', () => {
    let s = createGame(settings(3, { winTarget: 60 }), NOW);
    s = reinforce(s, 10, true); // ألف ٦٠
    expect(s.endgame?.reason).toBe('target');
    expect(s.phase).toBe('choose_action');
    s = reinforce(s, 20, true); // باء ٧٠
    expect(s.phase).toBe('choose_action');
    s = reinforce(s, 5, true); // جيم ٥٥ — نهاية الجولة
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('t1');
    expect(s.teams.every((t) => t.turnsPlayed === 1)).toBe(true);
  });
  it('إذا بلغ آخر فريق في الجولة الرصيد تنتهي المباراة فورًا', () => {
    let s = createGame(settings(2, { winTarget: 60 }), NOW);
    s = reinforce(s, 5, true);
    s = reinforce(s, 10, true);
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('t1');
  });
  it('التعادل يؤدي إلى أسئلة فاصلة حتى يبقى فائز واحد', () => {
    let s = createGame(settings(3, { winTarget: 60 }), NOW);
    s = reinforce(s, 10, true); // ٦٠
    s = reinforce(s, 10, true); // ٦٠
    s = reinforce(s, 5, false); // ٤٥
    expect(s.phase).toBe('tiebreak');
    expect(s.tiebreakTeamIds).toEqual(['t0', 't1']);
    // سؤال فاصل لا يجيب عنه أحد
    s = run(s, { type: 'START_TIEBREAK', question: q(s, 'medium'), now: NOW }, { type: 'BEGIN', now: NOW });
    expect(run(s, { type: 'BUZZ', teamId: 't2', now: NOW })).toBe(s); // غير متعادل
    s = run(s, { type: 'NO_BUZZ' });
    s = run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
    expect(s.phase).toBe('tiebreak');
    // سؤال ثانٍ: باء يخطئ ثم ألف يصيب
    s = run(s, { type: 'START_TIEBREAK', question: q(s, 'medium'), now: NOW }, { type: 'BEGIN', now: NOW });
    s = run(s, { type: 'BUZZ', teamId: 't1', now: NOW }, { type: 'MARK', result: 'wrong', now: NOW });
    expect(s.turn!.answeringTeamId).toBe('t0');
    s = run(s, { type: 'MARK', result: 'correct', now: NOW });
    s = run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('t0');
    expect(s.teams.map((t) => t.soldiers)).toEqual([60, 60, 45]); // الفاصل لا يغيّر الأرصدة
  });
  it('فاصل بين ثلاثة: بعد خطأ يعود الاختيار للمقدّم', () => {
    let s = createGame(settings(3), NOW);
    s = run(s, { type: 'END_NOW', now: NOW });
    expect(s.tiebreakTeamIds.length).toBe(3);
    s = run(s, { type: 'START_TIEBREAK', question: q(s, 'medium'), now: NOW }, { type: 'BEGIN', now: NOW });
    s = run(s, { type: 'BUZZ', teamId: 't2', now: NOW }, { type: 'MARK', result: 'wrong', now: NOW });
    expect(s.turn!.stage).toBe('buzz');
    expect(s.turn!.contenders).toEqual(['t0', 't1']);
  });
  it('وضع الوقت: انتهاء الوقت يكمل الجولة ثم يحدد الفائز', () => {
    let s = createGame(settings(2, { endMode: 'time', matchMinutes: 1 }), NOW);
    s = reinforce(s, 10, true);
    s = run(s, { type: 'CLOCK_CHECK', now: NOW + 61_000 });
    expect(s.endgame?.reason).toBe('time');
    expect(s.phase).toBe('choose_action');
    s = reinforce(s, 5, true);
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('t0');
  });
});

describe('التراجع', () => {
  it('يعيد الأرصدة والدور والسجل والسؤال', () => {
    let s = createGame(settings(3), NOW);
    s = reinforce(s, 10, true);
    const before = s;
    s = run(s, { type: 'CHOOSE_MODE', mode: 'confront' });
    s = run(s, { type: 'START_TURN', stake: 10, opponentId: 't0', question: q(s, 'medium'), now: NOW }, { type: 'BEGIN', now: NOW });
    s = run(s, { type: 'BUZZ', teamId: 't0', now: NOW }, { type: 'MARK', result: 'correct', now: NOW });
    const decided = s;
    s = run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
    expect(soldiers(s)).toEqual({ 'ألف': 70, 'باء': 40, 'جيم': 50 });
    s = run(s, { type: 'UNDO' });
    expect(soldiers(s)).toEqual(soldiers(before));
    expect(s.currentIndex).toBe(1);
    expect(s.phase).toBe('question');
    expect(s.turn!.question.id).toBe(decided.turn!.question.id);
    expect(s.turn!.stage).toBe('decided');
    expect(s.usedQuestionIds).toEqual(decided.usedQuestionIds);
    expect(s.teams.map((t) => t.stats)).toEqual(decided.teams.map((t) => t.stats));
    expect(s.log.slice(0, -1)).toEqual(decided.log);
    // تراجع مرة ثانية يعود إلى ما قبل نتيجة الفريق الأول
    s = run(s, { type: 'UNDO' });
    expect(soldiers(s)['ألف']).toBe(50);
    expect(s.currentIndex).toBe(0);
  });
  it('التراجع عن نهاية المباراة يعيد الجولة الأخيرة', () => {
    let s = createGame(settings(2, { winTarget: 55 }), NOW);
    s = reinforce(s, 5, true);
    s = reinforce(s, 5, false);
    expect(s.phase).toBe('finished');
    s = run(s, { type: 'UNDO' });
    expect(s.phase).toBe('question');
    expect(s.winnerId).toBeNull();
    expect(s.currentIndex).toBe(1);
  });
});

describe('الأسئلة', () => {
  it('البنك التجريبي: ٤٥ سؤالًا بالتساوي ومعرّفات فريدة', () => {
    expect(bank.length).toBe(45);
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) expect(bank.filter((x) => x.difficulty === d).length).toBe(15);
    expect(new Set(bank.map((x) => x.id)).size).toBe(45);
    expect(new Set(bank.map((x) => x.category)).size).toBe(4);
  });
  it('لا تكرار للأسئلة في المباراة بما فيها العودة والفواصل', () => {
    let s = createGame(settings(2, { startSoldiers: 5, winTarget: 1000 }), NOW);
    let refills = 0;
    for (let i = 0; i < 15; i++) {
      const team = s.teams[s.currentIndex];
      const question = pickQuestion(bank, s.usedQuestionIds, 'easy')!;
      expect(question).not.toBeNull();
      if (team.soldiers === 0) {
        refills++;
        s = run(s, { type: 'START_REFILL', question, now: NOW });
      } else {
        s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' }, { type: 'START_TURN', stake: 5, question, now: NOW });
      }
      s = run(s, { type: 'BEGIN', now: NOW }, { type: 'MARK', result: i % 3 === 0 ? 'correct' : 'wrong', now: NOW });
      s = run(s, { type: 'CONFIRM', seq: s.turn!.seq, now: NOW });
    }
    expect(refills).toBeGreaterThan(0);
    expect(s.usedQuestionIds.length).toBe(15);
    expect(new Set(s.usedQuestionIds).size).toBe(15);
    expect(pickQuestion(bank, s.usedQuestionIds, 'easy')).toBeNull();
  });
  it('نفاد المستوى يعيد null ولا يغيّر المستوى', () => {
    const used = bank.filter((x) => x.difficulty === 'easy').map((x) => x.id);
    expect(pickQuestion(bank, used, 'easy')).toBeNull();
    expect(availableQuestions(bank, used, 'medium').length).toBe(15);
  });
  it('السؤال المستخدم يُرفض حتى لو مُرّر يدويًا', () => {
    let s = createGame(settings(), NOW);
    s = reinforce(s, 5, true);
    const usedQ = bank.find((x) => x.id === s.usedQuestionIds[0]) as Question;
    s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
    expect(run(s, { type: 'START_TURN', stake: 5, question: usedQ, now: NOW })).toBe(s);
  });
  it('التحقق من ملف الاستيراد', () => {
    expect(parseImport('{bad').errors[0]).toMatch('JSON');
    const r = parseImport(JSON.stringify([
      { text: 'س١', answer: 'ج', difficulty: 'سهل', category: 'عام' },
      { text: 'س٢', difficulty: 'expert', category: 'عام' },
      { text: 'ما عاصمة اليابان؟', answer: 'طوكيو', difficulty: 'easy', category: 'عام' },
    ]), bank);
    expect(r.questions.length).toBe(1);
    expect(r.questions[0].difficulty).toBe('easy');
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toMatch('answer');
    expect(r.skipped.length).toBe(1);
  });
});

describe('الحفظ', () => {
  it('المؤقّت يُحفظ متوقفًا بالوقت المتبقي', () => {
    let s = createGame(settings(), NOW);
    s = run(s, { type: 'CHOOSE_MODE', mode: 'reinforce' });
    s = run(s, { type: 'START_TURN', stake: 5, question: q(s, 'easy'), now: NOW }, { type: 'BEGIN', now: NOW });
    const f = freeze(s, NOW + 12_000);
    expect(f.turn!.timer!.endsAt).toBeNull();
    expect(timerRemaining(f.turn!.timer, NOW + 99_999)).toBe(18_000);
    const restored = JSON.parse(JSON.stringify(f)) as GameState;
    const resumed = run(restored, { type: 'RESUME_TIMER', now: NOW + 50_000 });
    expect(timerRemaining(resumed.turn!.timer, NOW + 50_000)).toBe(18_000);
  });
});

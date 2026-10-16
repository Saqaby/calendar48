import {
  Action, AttemptResult, FIRST_ANSWER_MS, GameCore, GameState, HISTORY_LIMIT, LogKind,
  REFILL_SOLDIERS, SECOND_ANSWER_MS, Settings, Stake, STAKE_DIFFICULTY, STAKES, TeamState, TIEBREAK_DIFFICULTY,
  TimerState, Turn, DIFFICULTY_LABEL,
} from './types';

/* ------------------------------------------------------------------ */
/*  قواعد الاحتساب (دوال نقية)                                         */
/* ------------------------------------------------------------------ */

export interface Effect {
  deltas: Record<string, number>;
  title: string;
  lines: string[];
  positive: boolean;
}

/** أثر نتيجة الدور على الأرصدة. winnerId = الفريق الذي أجاب صحيحًا، أو null عند الإخفاق */
export function computeEffect(
  turn: Pick<Turn, 'mode' | 'stake' | 'initiatorId' | 'opponentId'>,
  winnerId: string | null,
  teams: TeamState[],
): Effect {
  const name = (id: string | null) => teams.find((t) => t.id === id)?.name ?? '';
  const soldiers = (id: string | null) => teams.find((t) => t.id === id)?.soldiers ?? 0;
  const init = turn.initiatorId;
  const s = turn.stake;
  const deltas: Record<string, number> = {};
  switch (turn.mode) {
    case 'reinforce':
      if (winnerId === init) {
        deltas[init!] = s;
        return { deltas, positive: true, title: 'وصلت التعزيزات', lines: [`${name(init)} يحتفظ بجنوده ويكسب ${fmt(s)} جنديًا`] };
      }
      deltas[init!] = -Math.min(s, soldiers(init));
      return { deltas, positive: false, title: 'فشلت المهمة', lines: [`${name(init)} يخسر ${fmt(-deltas[init!])} جنديًا`] };
    case 'refill':
      if (winnerId === init) {
        deltas[init!] = REFILL_SOLDIERS;
        return { deltas, positive: true, title: 'عاد الجيش إلى الميدان', lines: [`${name(init)} يعود بـ${fmt(REFILL_SOLDIERS)} جنود`] };
      }
      return { deltas, positive: false, title: 'لم تنجح إعادة التعبئة', lines: [`${name(init)} ينتظر دوره التالي`] };
    case 'confront': {
      // الجيش الذي يجيب صحيحًا يأخذ جنود المواجهة من الجيش الآخر
      const opp = turn.opponentId!;
      if (winnerId === init) {
        const taken = Math.min(s, soldiers(opp));
        deltas[init!] = taken;
        deltas[opp] = -taken;
        return {
          deltas, positive: true, title: 'حُسمت المعركة',
          lines: taken > 0
            ? [`${name(opp)} يخسر ${fmt(taken)} جنديًا`, `تنتقل إلى ${name(init)} فيكسب ${fmt(taken)} جنديًا`]
            : [`${name(opp)} لا يملك جنودًا لتنتقل`, `${name(init)} لا يكسب شيئًا`],
        };
      }
      const lost = Math.min(s, soldiers(init));
      deltas[init!] = -lost;
      if (winnerId === opp) {
        deltas[opp] = lost;
        return {
          deltas, positive: false, title: 'حُسمت المعركة',
          lines: [`${name(init)} يخسر ${fmt(lost)} جنديًا`, `تنتقل إلى ${name(opp)} فيكسب ${fmt(lost)} جنديًا`],
        };
      }
      deltas[opp] = 0;
      return {
        deltas, positive: false, title: 'أخفق الجيشان',
        lines: [`${name(init)} يخسر ${fmt(lost)} جنديًا`, `${name(opp)} لا يحصل على شيء`],
      };
    }
    case 'tiebreak':
      return {
        deltas, positive: !!winnerId,
        title: winnerId ? 'حُسم الفاصل' : 'لا فائز في هذا السؤال',
        lines: [winnerId ? `${name(winnerId)} يفوز بالسؤال الفاصل` : 'سيُطرح سؤال فاصل جديد'],
      };
  }
}

export function fmt(n: number): string {
  return n.toLocaleString('ar-EG');
}

/** الأعداد المتاحة للمهمة بحسب الرصيد */
export function allowedStakes(soldiers: number): Stake[] {
  return STAKES.filter((s) => s <= soldiers);
}

/** الخصوم المسموح بهم للفريق المبادر */
export function allowedOpponents(state: GameCore, initiatorId: string): string[] {
  const init = state.teams.find((t) => t.id === initiatorId);
  return state.teams
    .filter((t) => t.id !== initiatorId)
    .filter((t) => !(state.teams.length >= 3 && init?.lastOpponentId === t.id))
    .map((t) => t.id);
}

export function currentTeam(state: GameCore): TeamState {
  return state.teams[state.currentIndex];
}

export function ranking(teams: TeamState[], winnerId: string | null = null): TeamState[] {
  return [...teams].sort((a, b) => {
    if (winnerId) {
      if (a.id === winnerId) return -1;
      if (b.id === winnerId) return 1;
    }
    return b.soldiers - a.soldiers || b.stats.correct - a.stats.correct;
  });
}

export function clockElapsed(clock: GameCore['clock'], now: number): number {
  return clock.elapsedMs + (clock.runningSince != null ? now - clock.runningSince : 0);
}

export function timerRemaining(t: TimerState | null, now: number): number {
  if (!t) return 0;
  return t.endsAt != null ? Math.max(0, t.endsAt - now) : t.remainingMs;
}

/* ------------------------------------------------------------------ */
/*  إنشاء المباراة                                                    */
/* ------------------------------------------------------------------ */

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGame(settings: Settings, now: number, rng: () => number = Math.random): GameState {
  const order = settings.orderMode === 'random' ? shuffle(settings.teams, rng) : settings.teams;
  const teams: TeamState[] = order.map((t) => ({
    ...t,
    soldiers: settings.startSoldiers,
    turnsPlayed: 0,
    lastOpponentId: null,
    stats: { correct: 0, confrontWins: 0, biggestGain: 0 },
  }));
  const g: GameState = {
    version: 2,
    id: `g${now.toString(36)}${Math.floor(rng() * 1e6).toString(36)}`,
    settings,
    teams,
    currentIndex: 0,
    round: 1,
    phase: 'choose_action',
    pendingMode: null,
    turn: null,
    turnSeq: 0,
    questionCount: 0,
    log: [],
    logSeq: 0,
    endgame: null,
    tiebreakTeamIds: [],
    winnerId: null,
    clock: { elapsedMs: 0, runningSince: now },
    flash: null,
    history: [],
  };
  const orderText = teams.map((t) => t.name).join(' ← ');
  return log(g, 'info', `بدأت المعركة. ترتيب الأدوار: ${orderText}`);
}

/* ------------------------------------------------------------------ */
/*  المساعدات الداخلية                                                */
/* ------------------------------------------------------------------ */

function log<T extends GameCore>(s: T, kind: LogKind, text: string): T {
  const id = s.logSeq + 1;
  return { ...s, logSeq: id, log: [...s.log, { id, round: s.round, kind, text }].slice(-200) };
}

function core(s: GameState): GameCore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { history: _h, ...rest } = s;
  return rest;
}

function startTimer(ms: number, now: number): TimerState {
  return { durationMs: ms, remainingMs: ms, endsAt: now + ms };
}

function teamName(s: GameCore, id: string | null) {
  return s.teams.find((t) => t.id === id)?.name ?? '';
}

function newTurn(
  s: GameState,
  partial: Pick<Turn, 'mode' | 'stake' | 'difficulty' | 'initiatorId' | 'opponentId' | 'contenders'>,
): GameState {
  const seq = s.turnSeq + 1;
  const turn: Turn = {
    ...partial,
    seq,
    questionNo: s.questionCount + 1,
    stage: 'reading',
    attempts: [],
    answeringTeamId: null,
    winnerId: null,
    overridden: false,
    timer: null,
  };
  return {
    ...s,
    turnSeq: seq,
    turn,
    phase: 'question',
    pendingMode: null,
    flash: null,
    questionCount: s.questionCount + 1,
  };
}

function withTurn(s: GameState, patch: Partial<Turn>): GameState {
  return { ...s, turn: { ...s.turn!, ...patch } };
}

/** تسجيل محاولة إجابة للفريق الذي يجيب حاليًا */
function applyAttempt(s: GameState, result: AttemptResult, now: number): GameState {
  const t = s.turn!;
  const teamId = t.answeringTeamId!;
  const attempts = [...t.attempts, { teamId, result }];
  if (result === 'correct') {
    return withTurn(s, { attempts, stage: 'decided', winnerId: teamId, timer: null, answeringTeamId: null });
  }
  const contenders = t.contenders.filter((c) => c !== teamId);
  if (t.mode === 'reinforce' || t.mode === 'refill' || contenders.length === 0) {
    return withTurn(s, { attempts, contenders, stage: 'decided', winnerId: null, timer: null, answeringTeamId: null });
  }
  if (contenders.length === 1) {
    // الفريق الآخر يحصل على فرصته فورًا
    return withTurn(s, {
      attempts, contenders, stage: 'answering', answeringTeamId: contenders[0], timer: startTimer(SECOND_ANSWER_MS, now),
    });
  }
  // أسئلة فاصلة بين أكثر من فريقين: يعود المقدّم لاختيار الفريق التالي
  return withTurn(s, { attempts, contenders, stage: 'buzz', answeringTeamId: null, timer: null });
}

function advanceTurn(s: GameState, now: number): GameState {
  let g = s;
  // بداية نهاية الجولة
  if (!g.endgame) {
    const target = g.settings.endMode === 'target' && g.teams.some((t) => t.soldiers >= g.settings.winTarget);
    const timeUp = g.settings.endMode === 'time' && clockElapsed(g.clock, now) >= g.settings.matchMinutes * 60_000;
    if (target || timeUp) {
      g = { ...g, endgame: { reason: target ? 'target' : 'time', round: g.round } };
      g = log(g, 'alert', target
        ? 'بلغ جيشٌ رصيد الفوز — بدأت الجولة الأخيرة. تُستكمل أدوار هذه الجولة ثم يُعلن الفائز.'
        : 'انتهى وقت المباراة — تُستكمل الجولة الحالية ثم يُعلن الفائز.');
    }
  }
  const next = g.currentIndex + 1;
  if (next < g.teams.length) {
    return { ...g, currentIndex: next, phase: 'choose_action', turn: null, pendingMode: null };
  }
  if (g.endgame) return finalize(g, now);
  g = { ...g, currentIndex: 0, round: g.round + 1, phase: 'choose_action', turn: null, pendingMode: null };
  return log(g, 'info', `بدأت الجولة ${fmt(g.round)}`);
}

function finalize(s: GameState, now: number): GameState {
  const top = Math.max(...s.teams.map((t) => t.soldiers));
  const tied = s.teams.filter((t) => t.soldiers === top);
  const clock = { elapsedMs: clockElapsed(s.clock, now), runningSince: null };
  if (tied.length === 1) {
    const g = { ...s, clock, phase: 'finished' as const, turn: null, winnerId: tied[0].id, tiebreakTeamIds: [] };
    return log(g, 'end', `حُسمت المعركة: ${tied[0].name} يفوز بـ${fmt(top)} جنديًا`);
  }
  const g = { ...s, phase: 'tiebreak' as const, turn: null, tiebreakTeamIds: tied.map((t) => t.id) };
  return log(g, 'alert', `تعادل على المركز الأول بين: ${tied.map((t) => t.name).join('، ')} — أسئلة فاصلة`);
}

/* ------------------------------------------------------------------ */
/*  المخفِّض الرئيس                                                    */
/* ------------------------------------------------------------------ */

export function reducer(s: GameState, a: Action): GameState {
  const t = s.turn;
  switch (a.type) {
    case 'CHOOSE_MODE': {
      if (s.phase !== 'choose_action' && s.phase !== 'choose_stake') return s;
      if (currentTeam(s).soldiers < STAKES[0]) return s;
      return { ...s, phase: 'choose_stake', pendingMode: a.mode, flash: null };
    }
    case 'BACK_TO_ACTION':
      if (s.phase !== 'choose_stake') return s;
      return { ...s, phase: 'choose_action', pendingMode: null };

    case 'START_TURN': {
      if (s.phase !== 'choose_stake' || !s.pendingMode) return s;
      const team = currentTeam(s);
      if (!allowedStakes(team.soldiers).includes(a.stake)) return s;
      const difficulty = STAKE_DIFFICULTY[a.stake];
      if (s.pendingMode === 'confront') {
        if (!a.opponentId || !allowedOpponents(s, team.id).includes(a.opponentId)) return s;
        let g = newTurn(s, {
          mode: 'confront', stake: a.stake, difficulty, initiatorId: team.id, opponentId: a.opponentId,
          contenders: [team.id, a.opponentId],
        });
        g = { ...g, teams: g.teams.map((x) => (x.id === team.id ? { ...x, lastOpponentId: a.opponentId! } : x)) };
        return log(g, 'confront', `استعدوا للمواجهة: ${team.name} ضد ${teamName(s, a.opponentId)} بـ${fmt(a.stake)} جنود (${DIFFICULTY_LABEL[difficulty]})`);
      }
      const g = newTurn(s, {
        mode: 'reinforce', stake: a.stake, difficulty, initiatorId: team.id, opponentId: null, contenders: [team.id],
      });
      return log(g, 'info', `${team.name} طلب تعزيزات بـ${fmt(a.stake)} جنود (${DIFFICULTY_LABEL[difficulty]})`);
    }
    case 'START_REFILL': {
      const team = currentTeam(s);
      if (s.phase !== 'choose_action' || team.soldiers !== 0) return s;
      const g = newTurn(s, {
        mode: 'refill', stake: 0, difficulty: 'easy', initiatorId: team.id, opponentId: null, contenders: [team.id],
      });
      return log(g, 'info', `${team.name} يحاول إعادة التعبئة`);
    }
    case 'START_TIEBREAK': {
      if (s.phase !== 'tiebreak') return s;
      return newTurn(s, {
        mode: 'tiebreak', stake: 0, difficulty: TIEBREAK_DIFFICULTY, initiatorId: null, opponentId: null,
        contenders: [...s.tiebreakTeamIds],
      });
    }
    case 'REPLACE_QUESTION': {
      if (s.phase !== 'question' || !t || t.attempts.length > 0 || t.stage === 'decided' || t.stage === 'answering') return s;
      const g = {
        ...withTurn(s, { questionNo: s.questionCount + 1, stage: 'reading', timer: null }),
        questionCount: s.questionCount + 1,
      };
      return log(g, 'info', `استُبدل السؤال بسؤال آخر من المستوى نفسه (رقم ${fmt(g.questionCount)}) دون تغيير الأرصدة`);
    }
    case 'BEGIN': {
      if (s.phase !== 'question' || !t || t.stage !== 'reading') return s;
      if (t.mode === 'reinforce' || t.mode === 'refill') {
        return withTurn(s, {
          stage: 'answering', answeringTeamId: t.initiatorId, timer: startTimer(s.settings.answerSeconds * 1000, a.now),
        });
      }
      // مهلة طلب الإجابة تساوي مدة الإجابة العامة
      return withTurn(s, { stage: 'buzz', timer: startTimer(s.settings.answerSeconds * 1000, a.now) });
    }
    case 'BUZZ': {
      if (s.phase !== 'question' || !t || t.stage !== 'buzz' || !t.contenders.includes(a.teamId)) return s;
      const ms = t.attempts.length === 0 ? FIRST_ANSWER_MS : SECOND_ANSWER_MS;
      return withTurn(s, { stage: 'answering', answeringTeamId: a.teamId, timer: startTimer(ms, a.now) });
    }
    case 'MARK': {
      if (s.phase !== 'question' || !t || t.stage !== 'answering') return s;
      return applyAttempt(s, a.result, a.now);
    }
    case 'NO_BUZZ': {
      if (s.phase !== 'question' || !t || t.stage !== 'buzz') return s;
      return withTurn(s, { stage: 'decided', winnerId: null, timer: null, answeringTeamId: null });
    }
    case 'TIMEOUT': {
      if (s.phase !== 'question' || !t || !t.timer || t.timer.endsAt == null) return s;
      if (a.now < t.timer.endsAt - 50) return s; // حماية من مؤقّت قديم
      if (t.stage === 'answering') return applyAttempt(s, 'timeout', a.now);
      if (t.stage === 'buzz') return withTurn(s, { stage: 'decided', winnerId: null, timer: null });
      return s;
    }
    case 'PAUSE_TIMER': {
      if (!t?.timer || t.timer.endsAt == null) return s;
      return withTurn(s, { timer: { ...t.timer, remainingMs: Math.max(0, t.timer.endsAt - a.now), endsAt: null } });
    }
    case 'RESUME_TIMER': {
      if (!t?.timer || t.timer.endsAt != null) return s;
      return withTurn(s, { timer: { ...t.timer, endsAt: a.now + t.timer.remainingMs } });
    }
    case 'SET_WINNER': {
      if (s.phase !== 'question' || !t || t.stage !== 'decided') return s;
      const valid = a.winnerId === null || (t.mode === 'tiebreak'
        ? s.tiebreakTeamIds.includes(a.winnerId)
        : a.winnerId === t.initiatorId || a.winnerId === t.opponentId);
      if (!valid) return s;
      return withTurn(s, { winnerId: a.winnerId, overridden: true });
    }
    case 'CONFIRM': {
      if (s.phase !== 'question' || !t || t.stage !== 'decided' || t.seq !== a.seq) return s;
      return confirm(s, a.now);
    }
    case 'UNDO': {
      const prev = s.history[s.history.length - 1];
      if (!prev) return s;
      // ساعة المباراة لا تعود إلى الوراء؛ يُستعاد كل ما عداها
      const restored: GameState = { ...prev, clock: s.clock, flash: null, history: s.history.slice(0, -1) };
      return log(restored, 'info', 'تراجع المقدّم عن آخر نتيجة');
    }
    case 'CLOCK_PAUSE':
      if (s.clock.runningSince == null) return s;
      return { ...s, clock: { elapsedMs: clockElapsed(s.clock, a.now), runningSince: null } };
    case 'CLOCK_RESUME':
      if (s.clock.runningSince != null || s.phase === 'finished') return s;
      return { ...s, clock: { ...s.clock, runningSince: a.now } };
    case 'CLOCK_CHECK': {
      if (s.settings.endMode !== 'time' || s.endgame || s.phase === 'finished') return s;
      if (clockElapsed(s.clock, a.now) < s.settings.matchMinutes * 60_000) return s;
      const g = { ...s, endgame: { reason: 'time' as const, round: s.round } };
      return log(g, 'alert', 'انتهى وقت المباراة — تُستكمل الجولة الحالية ثم يُعلن الفائز.');
    }
    case 'END_NOW': {
      if (s.phase === 'finished') return s;
      let g: GameState = { ...s, history: [...s.history, core(s)].slice(-HISTORY_LIMIT), endgame: { reason: 'manual', round: s.round } };
      g = log(g, 'alert', 'أنهى المقدّم المباراة');
      return finalize(g, a.now);
    }
  }
  return s;
}

function confirm(s: GameState, now: number): GameState {
  const t = s.turn!;
  const snapshot = core(s);
  const effect = computeEffect(t, t.winnerId, s.teams);
  const teams = s.teams.map((team) => {
    const d = effect.deltas[team.id] ?? 0;
    const correct = t.winnerId === team.id ? 1 : 0;
    const confrontWin = t.mode === 'confront' && t.winnerId === team.id ? 1 : 0;
    const isActor = team.id === t.initiatorId;
    return {
      ...team,
      soldiers: Math.max(0, team.soldiers + d),
      turnsPlayed: team.turnsPlayed + (isActor ? 1 : 0),
      stats: {
        correct: team.stats.correct + correct,
        confrontWins: team.stats.confrontWins + confrontWin,
        biggestGain: Math.max(team.stats.biggestGain, d),
      },
    };
  });
  let g: GameState = {
    ...s,
    teams,
    history: [...s.history, snapshot].slice(-HISTORY_LIMIT),
    flash: { seq: t.seq, mode: t.mode, title: effect.title, deltas: effect.deltas, positive: effect.positive },
  };
  const kind: LogKind = t.mode === 'confront' ? 'confront' : effect.positive ? 'gain' : 'loss';
  const reason = t.overridden ? ' (بتحكيم يدوي)' : '';
  g = log(g, kind, `${effect.title}: ${effect.lines.join('، ')}${reason}`);

  if (t.mode === 'tiebreak') {
    if (t.winnerId) {
      const winner = teams.find((x) => x.id === t.winnerId)!;
      g = {
        ...g, phase: 'finished', turn: null, winnerId: t.winnerId, tiebreakTeamIds: [],
        clock: { elapsedMs: clockElapsed(g.clock, now), runningSince: null },
      };
      return log(g, 'end', `حُسمت المعركة: ${winner.name} يفوز بعد الأسئلة الفاصلة`);
    }
    return { ...g, phase: 'tiebreak', turn: null };
  }
  return advanceTurn(g, now);
}

/* ------------------------------------------------------------------ */
/*  حفظ واستعادة                                                       */
/* ------------------------------------------------------------------ */

/** نسخة قابلة للحفظ: المؤقّتات تُحفظ متوقفة بالوقت المتبقي الفعلي */
export function freeze<T extends GameCore>(s: T, now: number): T {
  const t = s.turn;
  return {
    ...s,
    clock: { elapsedMs: clockElapsed(s.clock, now), runningSince: null },
    turn: t && t.timer && t.timer.endsAt != null
      ? { ...t, timer: { ...t.timer, remainingMs: Math.max(0, t.timer.endsAt - now), endsAt: null } }
      : t,
    flash: null,
  };
}

export function isValidGame(x: unknown): x is GameState {
  const g = x as GameState;
  return !!g && g.version === 2 && Array.isArray(g.teams) && g.teams.length >= 2 && !!g.settings
    && typeof g.questionCount === 'number' && Array.isArray(g.history) && typeof g.phase === 'string';
}

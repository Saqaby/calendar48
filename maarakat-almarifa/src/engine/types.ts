export type Difficulty = 'easy' | 'medium' | 'hard';
export type Stake = 5 | 10 | 20;

export const STAKES: Stake[] = [5, 10, 20];
export const STAKE_DIFFICULTY: Record<Stake, Difficulty> = { 5: 'easy', 10: 'medium', 20: 'hard' };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

/** مدة الإجابة للفريق الأسبق في المواجهة، ثم فرصة الفريق الآخر */
export const FIRST_ANSWER_MS = 5_000;
export const SECOND_ANSWER_MS = 10_000;
/** رصيد العودة بعد الإجابة الصحيحة في «إعادة التعبئة» */
export const REFILL_SOLDIERS = 10;
/** مستوى أسئلة الفاصل عند التعادل */
export const TIEBREAK_DIFFICULTY: Difficulty = 'medium';
export const HISTORY_LIMIT = 30;

export interface TeamConfig {
  id: string;
  name: string;
  color: string;
  emblem: string;
}

export interface Settings {
  teams: TeamConfig[];
  startSoldiers: number;
  winTarget: number;
  answerSeconds: number;
  orderMode: 'manual' | 'random';
  endMode: 'target' | 'time';
  matchMinutes: number;
}

export interface TeamStats {
  correct: number;
  confrontWins: number;
  biggestGain: number;
}

export interface TeamState extends TeamConfig {
  soldiers: number;
  turnsPlayed: number;
  /** آخر خصم واجهه هذا الفريق بصفته مبادرًا */
  lastOpponentId: string | null;
  stats: TeamStats;
}

export type TurnMode = 'reinforce' | 'confront' | 'refill' | 'tiebreak';
export type Stage = 'reading' | 'buzz' | 'answering' | 'decided';
/** مرحلتا الهجوم: سؤال الأسر للمهاجم وحده، ثم سؤال الاستنقاذ للفريقين */
export type ConfrontStep = 'capture' | 'rescue';
export type AttemptResult = 'correct' | 'wrong' | 'timeout';

export interface TimerState {
  durationMs: number;
  remainingMs: number;
  /** وقت الانتهاء المطلق عند التشغيل، أو null عند الإيقاف المؤقت */
  endsAt: number | null;
}

export interface Turn {
  seq: number;
  mode: TurnMode;
  /** في المواجهة فقط؛ null لغيرها */
  step: ConfrontStep | null;
  stake: number;
  difficulty: Difficulty;
  /** null في الأسئلة الفاصلة */
  initiatorId: string | null;
  opponentId: string | null;
  /** رقم السؤال المتسلسل في المباراة، ليتتبّع المقدّم موضعه في الكتاب */
  questionNo: number;
  stage: Stage;
  /** الفرق التي ما زال يحق لها الإجابة */
  contenders: string[];
  attempts: { teamId: string; result: AttemptResult }[];
  answeringTeamId: string | null;
  winnerId: string | null;
  /** هل غيّر المقدّم النتيجة يدويًا */
  overridden: boolean;
  timer: TimerState | null;
}

export type Phase = 'choose_action' | 'choose_stake' | 'question' | 'tiebreak' | 'finished';

export type LogKind = 'gain' | 'loss' | 'info' | 'confront' | 'alert' | 'end';

export interface LogEntry {
  id: number;
  round: number;
  kind: LogKind;
  text: string;
}

export interface ResultFlash {
  seq: number;
  mode: TurnMode;
  title: string;
  deltas: Record<string, number>;
  positive: boolean;
}

export interface Clock {
  elapsedMs: number;
  runningSince: number | null;
}

export interface GameCore {
  version: 2;
  id: string;
  settings: Settings;
  teams: TeamState[];
  currentIndex: number;
  round: number;
  phase: Phase;
  pendingMode: 'reinforce' | 'confront' | null;
  turn: Turn | null;
  turnSeq: number;
  questionCount: number;
  log: LogEntry[];
  logSeq: number;
  endgame: null | { reason: 'target' | 'time' | 'manual'; round: number };
  tiebreakTeamIds: string[];
  winnerId: string | null;
  clock: Clock;
  flash: ResultFlash | null;
}

export interface GameState extends GameCore {
  history: GameCore[];
}

export type Action =
  | { type: 'CHOOSE_MODE'; mode: 'reinforce' | 'confront' }
  | { type: 'BACK_TO_ACTION' }
  | { type: 'START_TURN'; stake: Stake; opponentId?: string; now: number }
  | { type: 'START_REFILL'; now: number }
  | { type: 'START_TIEBREAK'; now: number }
  | { type: 'REPLACE_QUESTION' }
  | { type: 'BEGIN'; now: number }
  | { type: 'BUZZ'; teamId: string; now: number }
  | { type: 'MARK'; result: AttemptResult; now: number }
  | { type: 'NO_BUZZ' }
  | { type: 'TIMEOUT'; now: number }
  | { type: 'PAUSE_TIMER'; now: number }
  | { type: 'RESUME_TIMER'; now: number }
  | { type: 'SET_WINNER'; winnerId: string | null }
  | { type: 'CANCEL_CAPTURE' }
  | { type: 'CONFIRM'; seq: number; now: number }
  | { type: 'UNDO' }
  | { type: 'CLOCK_PAUSE'; now: number }
  | { type: 'CLOCK_RESUME'; now: number }
  | { type: 'CLOCK_CHECK'; now: number }
  | { type: 'END_NOW'; now: number };

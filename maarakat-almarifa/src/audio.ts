/** مؤثرات صوتية مولّدة بالمتصفح (دون ملفات خارجية). لا تعمل إلا بعد أول تفاعل للمستخدم */
let ctx: AudioContext | null = null;
let muted = false;
let unlocked = false;

export function setMuted(m: boolean) { muted = m; }

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  } catch { ctx = null; }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, slideTo?: number) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export type Sfx = 'turn' | 'tick' | 'correct' | 'wrong' | 'confront' | 'victory' | 'click';

export function play(s: Sfx) {
  if (muted || !ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  switch (s) {
    case 'turn': tone(440, 0, 0.16, 'triangle'); tone(660, 0.14, 0.24, 'triangle'); break;
    case 'tick': tone(980, 0, 0.07, 'square', 0.06); break;
    case 'correct': tone(523, 0, 0.14, 'triangle'); tone(659, 0.1, 0.14, 'triangle'); tone(784, 0.2, 0.3, 'triangle'); break;
    case 'wrong': tone(220, 0, 0.35, 'sawtooth', 0.09, 140); break;
    case 'confront': tone(110, 0, 0.3, 'triangle', 0.25, 70); tone(330, 0.18, 0.12, 'square', 0.06); tone(330, 0.34, 0.2, 'square', 0.06); break;
    case 'victory':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.14, 0.22, 'triangle', 0.16));
      tone(784, 0.6, 0.18, 'triangle', 0.14); tone(1046, 0.76, 0.6, 'triangle', 0.18);
      break;
    case 'click': tone(700, 0, 0.04, 'sine', 0.05); break;
  }
}
